/**
 * Server-side price lookups. Runs outside the browser (Vite dev/preview
 * middleware locally, a Cloudflare Worker in production), so it can call
 * Yahoo Finance and TEFAS directly instead of going through public CORS
 * proxies that see every symbol in the portfolio.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Quote {
  price: number;
  /** ISO currency as reported by the source, normalized (GBp → GBP) */
  currency: string;
  source: 'yahoo' | 'tefas';
  /** Source timestamp, ISO */
  asOf: string;
}

type FetchFn = typeof fetch;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const SYMBOL_RE = /^[A-Z0-9.\-^=]{1,20}$/;
const FUND_RE = /^[A-Z0-9]{2,6}$/;

async function fetchWithTimeout(fetchFn: FetchFn, url: string, init: RequestInit = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts the latest price from a Yahoo v8 chart response. */
export function parseYahooChart(data: unknown): Quote | null {
  const result = (data as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | {
        meta?: { regularMarketPrice?: number; currency?: string; regularMarketTime?: number };
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }
    | undefined;
  if (!result) return null;

  let price = result.meta?.regularMarketPrice;
  if (typeof price !== 'number' || !(price > 0)) {
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    price = [...closes].reverse().find((c): c is number => typeof c === 'number' && c > 0);
  }
  if (typeof price !== 'number' || !(price > 0)) return null;

  let currency = (result.meta?.currency || '').trim();
  // London listings are quoted in pence
  if (currency === 'GBp' || currency === 'GBX') {
    price = price / 100;
    currency = 'GBP';
  }
  const time = result.meta?.regularMarketTime;
  return {
    price,
    currency: currency.toUpperCase(),
    source: 'yahoo',
    asOf: typeof time === 'number' ? new Date(time * 1000).toISOString() : new Date().toISOString(),
  };
}

/** Parses a TEFAS date: ISO / YYYY-MM-DD, YYYYMMDD, DD.MM.YYYY or epoch ms. */
function parseTefasDate(value: unknown): number {
  if (typeof value === 'number') return value > 1e11 ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const v = value.trim();
  let m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return /^\d{11,}$/.test(v) ? Number(v) : NaN;
}

function parseTefasPrice(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const v = value.trim();
  // Turkish formatting: 1.234,567890
  return parseFloat(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
}

/** Extracts the latest fund price from a tefas.gov.tr /api/funds/* response. */
export function parseTefasFunds(data: unknown, fund?: string): Quote | null {
  const rows = (data as { resultList?: unknown[] })?.resultList;
  if (!Array.isArray(rows)) return null;
  let best: { time: number; price: number } | null = null;
  for (const row of rows) {
    const r = row as { tarih?: unknown; fiyat?: unknown; fonKodu?: unknown };
    if (fund && typeof r.fonKodu === 'string' && r.fonKodu.toUpperCase() !== fund) continue;
    const time = parseTefasDate(r.tarih);
    const price = parseTefasPrice(r.fiyat);
    if (!Number.isFinite(time) || !(price > 0)) continue;
    if (!best || time > best.time) best = { time, price };
  }
  if (!best) return null;
  return { price: best.price, currency: 'TRY', source: 'tefas', asOf: new Date(best.time).toISOString() };
}

/**
 * dagilimSiraliGetirT fields (percent of the fund's portfolio) that are
 * exposed to foreign currency: FX/eurobond debt, FX and gold deposits and
 * participation accounts, FX lease certificates, precious metals and foreign
 * securities. Gold counts as USD exposure, like gold held directly.
 */
const FX_ALLOCATION_FIELDS = [
  'eut', 'kibd', 'osdb', 'kba', 'dot', 'db',
  'vmd', 'vmau', 'khd', 'khau',
  'kksd', 'kksyd', 'oksyd',
  'km', 'kmbyf', 'kmkba', 'kmkks',
  'ymk', 'yba', 'ybkb', 'ybosb', 'yhs', 'ybyf',
];

export interface FundAllocation {
  /** Share of the fund's portfolio exposed to foreign currency or gold, 0–100 */
  fxPct: number;
  source: 'tefas';
  asOf: string;
}

/** Latest foreign-currency share per fund code in a dagilimSiraliGetirT response. */
export function parseTefasAllocations(data: unknown): Map<string, FundAllocation> {
  const latest = new Map<string, { time: number; row: Record<string, unknown> }>();
  const rows = (data as { resultList?: unknown[] })?.resultList;
  if (!Array.isArray(rows)) return new Map();
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    if (typeof r.fonKodu !== 'string') continue;
    const code = r.fonKodu.trim().toUpperCase();
    const time = parseTefasDate(r.tarih);
    if (!Number.isFinite(time)) continue;
    const prev = latest.get(code);
    if (!prev || time > prev.time) latest.set(code, { time, row: r });
  }
  const result = new Map<string, FundAllocation>();
  for (const [code, { time, row }] of latest) {
    const fxPct = FX_ALLOCATION_FIELDS.reduce((sum, key) => {
      const v = parseTefasPrice(row[key]);
      return Number.isFinite(v) && v > 0 ? sum + v : sum;
    }, 0);
    result.set(code, {
      fxPct: Math.round(Math.min(100, fxPct) * 10) / 10,
      source: 'tefas',
      asOf: new Date(time).toISOString(),
    });
  }
  return result;
}

/** Latest foreign-currency share of one fund in a dagilimSiraliGetirT response. */
export function parseTefasAllocation(data: unknown, fund: string): FundAllocation | null {
  return parseTefasAllocations(data).get(fund.trim().toUpperCase()) ?? null;
}

export interface FundAttempt {
  source: string;
  status: number;
  ok: boolean;
  note?: string;
}

// TEFAS retired the old BindHistoryInfo API in 2026; the site now uses these JSON endpoints.
const TEFAS = 'https://www.tefas.gov.tr';
const TEFAS_HEADERS = {
  'User-Agent': USER_AGENT,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  Origin: TEFAS,
  Referer: `${TEFAS}/tr/fon-verileri`,
};

function snippet(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function errorNote(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 120) : 'error';
}

function compactDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Request body for TEFAS's sorted fund lists; two weeks covers weekends and holidays. */
function fundListBody(fund: string, kind: 'YAT' | 'EMK', nowMs: number, days = 14, maxRows = 100) {
  return {
    fonTipi: kind,
    fonKodu: fund,
    aramaMetni: null,
    fonTurKod: null,
    fonGrubu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    kurucuKod: null,
    basTarih: compactDate(new Date(nowMs - days * 86_400_000)),
    bitTarih: compactDate(new Date(nowMs)),
    basSira: 1,
    bitSira: maxRows,
    dil: 'TR',
    sFonTurKod: '',
    fonKod: '',
    fonGrup: '',
    fonUnvanTip: '',
  };
}

export function createPriceService(fetchFn: FetchFn = fetch, now: () => number = Date.now) {
  const cache = new Map<string, { expires: number; value: Quote | null }>();

  async function cached(key: string, ttlMs: number, load: () => Promise<Quote | null>): Promise<Quote | null> {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;
    const value = await load();
    // Cache misses briefly so a bad symbol doesn't hammer the source
    cache.set(key, { value, expires: now() + (value ? ttlMs : 30_000) });
    return value;
  }

  async function getStockQuote(symbol: string): Promise<Quote | null> {
    const sym = symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(sym)) return null;
    return cached(`yahoo:${sym}`, 60_000, async () => {
      for (const host of ['query1', 'query2']) {
        try {
          const res = await fetchWithTimeout(
            fetchFn,
            `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`,
            { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }
          );
          if (!res.ok) continue;
          const quote = parseYahooChart(await res.json());
          if (quote) return quote;
        } catch {
          // try the next host
        }
      }
      return null;
    });
  }

  const fundDetails = new Map<string, FundAttempt[]>();

  async function loadFund(fund: string, kind: 'YAT' | 'EMK'): Promise<{ quote: Quote | null; attempts: FundAttempt[] }> {
    const attempts: FundAttempt[] = [];

    const post = async (source: string, path: string, body: object) => {
      try {
        const res = await fetchWithTimeout(fetchFn, `${TEFAS}${path}`, {
          method: 'POST',
          headers: TEFAS_HEADERS,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let quote: Quote | null = null;
        try {
          quote = res.ok ? parseTefasFunds(JSON.parse(text), fund) : null;
        } catch {
          // Not JSON: usually a firewall / bot-check page
        }
        attempts.push({ source, status: res.status, ok: !!quote, ...(quote ? {} : { note: snippet(text) }) });
        return quote;
      } catch (err) {
        attempts.push({ source, status: 0, ok: false, note: errorNote(err) });
        return null;
      }
    };

    // 1. Price history for the last month
    let quote = await post('tefas-fiyat', '/api/funds/fonFiyatBilgiGetir', { fonKodu: fund, dil: 'TR', periyod: 1 });
    if (quote) return { quote, attempts };

    // 2. General fund info
    quote = await post('tefas-bilgi', '/api/funds/fonGnlBlgSiraliGetir', fundListBody(fund, kind, now()));
    return { quote, attempts };
  }

  async function getFundQuote(code: string, kind: 'YAT' | 'EMK'): Promise<Quote | null> {
    const fund = code.trim().toUpperCase();
    if (!FUND_RE.test(fund)) return null;
    const key = `tefas:${kind}:${fund}`;
    return cached(key, 10 * 60_000, async () => {
      const { quote, attempts } = await loadFund(fund, kind);
      fundDetails.set(key, attempts);
      return quote;
    });
  }

  /** What happened on the last lookup of a fund (for error responses). */
  function getFundAttempts(code: string, kind: 'YAT' | 'EMK'): FundAttempt[] | undefined {
    return fundDetails.get(`tefas:${kind}:${code.trim().toUpperCase()}`);
  }

  // TEFAS breakdowns are monthly reports; one fetch a day is plenty
  const ALLOCATION_TTL = 24 * 3_600_000;
  const allocationLists = new Map<string, { expires: number; funds: Map<string, FundAllocation> }>();
  const allocationLoads = new Map<string, Promise<Map<string, FundAllocation>>>();

  /**
   * Every fund's foreign-currency share for one fund type. TEFAS's
   * dagilimSiraliGetirT ignores the fund filter and returns the whole list,
   * so fetch it once (latest day with data, walking back over weekends and
   * holidays) and share it between concurrent requests.
   */
  async function loadAllocations(kind: 'YAT' | 'EMK'): Promise<Map<string, FundAllocation>> {
    const cached = allocationLists.get(kind);
    if (cached && cached.expires > now()) return cached.funds;
    const pending = allocationLoads.get(kind);
    if (pending) return pending;

    const load = (async () => {
      let funds = new Map<string, FundAllocation>();
      for (let back = 0; back < 7 && funds.size === 0; back++) {
        try {
          const res = await fetchWithTimeout(fetchFn, `${TEFAS}/api/funds/dagilimSiraliGetirT`, {
            method: 'POST',
            headers: TEFAS_HEADERS,
            body: JSON.stringify({ ...fundListBody('', kind, now() - back * 86_400_000, 0, 100_000), fonKodu: null }),
          }, 20_000);
          if (!res.ok) break;
          funds = parseTefasAllocations(await res.json());
        } catch {
          // Not JSON or unreachable; treated as unknown
          break;
        }
      }
      allocationLists.set(kind, { funds, expires: now() + (funds.size ? ALLOCATION_TTL : 60_000) });
      return funds;
    })();
    allocationLoads.set(kind, load);
    try {
      return await load;
    } finally {
      allocationLoads.delete(kind);
    }
  }

  /** Foreign-currency share of a fund's portfolio; TEFAS updates it daily. */
  async function getFundAllocation(code: string, kind: 'YAT' | 'EMK'): Promise<FundAllocation | null> {
    const fund = code.trim().toUpperCase();
    if (!FUND_RE.test(fund)) return null;
    return (await loadAllocations(kind)).get(fund) ?? null;
  }

  return { getStockQuote, getFundQuote, getFundAttempts, getFundAllocation };
}

export interface ApiResult {
  status: number;
  body: unknown;
}

type PriceService = Pick<ReturnType<typeof createPriceService>, 'getStockQuote' | 'getFundQuote'> &
  Partial<Pick<ReturnType<typeof createPriceService>, 'getFundAttempts' | 'getFundAllocation'>>;

/**
 * Shared request logic for the Node middleware and the Cloudflare Worker:
 *   GET /api/quote?symbol=THYAO.IS
 *   GET /api/fund?code=TCD&kind=YAT|EMK
 *   GET /api/fund-allocation?code=TCD&kind=YAT|EMK
 * Returns null for paths outside /api/.
 */
export async function handlePriceRequest(url: URL, method: string, service: PriceService): Promise<ApiResult | null> {
  if (!url.pathname.startsWith('/api/')) return null;
  if (method !== 'GET') return { status: 405, body: { error: 'Yalnızca GET desteklenir' } };

  try {
    if (url.pathname === '/api/quote') {
      const symbol = url.searchParams.get('symbol') || '';
      if (!SYMBOL_RE.test(symbol.trim().toUpperCase())) return { status: 400, body: { error: 'Geçersiz sembol' } };
      const quote = await service.getStockQuote(symbol);
      return quote ? { status: 200, body: quote } : { status: 404, body: { error: 'Fiyat bulunamadı' } };
    }

    if (url.pathname === '/api/fund') {
      const code = url.searchParams.get('code') || '';
      const kind = url.searchParams.get('kind') === 'EMK' ? 'EMK' : 'YAT';
      if (!FUND_RE.test(code.trim().toUpperCase())) return { status: 400, body: { error: 'Geçersiz fon kodu' } };
      const quote = await service.getFundQuote(code, kind);
      if (quote) return { status: 200, body: quote };
      // Include what each source answered so a failing setup can be diagnosed from the browser
      const details = service.getFundAttempts?.(code, kind);
      return { status: 404, body: { error: 'Fiyat bulunamadı', ...(details ? { details } : {}) } };
    }

    if (url.pathname === '/api/fund-allocation' && service.getFundAllocation) {
      const code = url.searchParams.get('code') || '';
      const kind = url.searchParams.get('kind') === 'EMK' ? 'EMK' : 'YAT';
      if (!FUND_RE.test(code.trim().toUpperCase())) return { status: 400, body: { error: 'Geçersiz fon kodu' } };
      const allocation = await service.getFundAllocation(code, kind);
      return allocation
        ? { status: 200, body: allocation }
        : { status: 404, body: { error: 'Portföy dağılımı bulunamadı' } };
    }

    return { status: 404, body: { error: 'Bilinmeyen uç nokta' } };
  } catch (err) {
    console.error('Price API error', err);
    return { status: 502, body: { error: 'Fiyat kaynağına ulaşılamadı' } };
  }
}

/** Connect-style middleware used by the Vite dev and preview servers. */
export function createPriceMiddleware(service: PriceService = createPriceService()) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const result = await handlePriceRequest(new URL(req.url || '/', 'http://localhost'), req.method || 'GET', service);
    if (!result) return next();
    res.statusCode = result.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(result.body));
  };
}
