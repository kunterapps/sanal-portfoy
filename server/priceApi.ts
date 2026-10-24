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

/** Extracts the latest fund price from a TEFAS BindHistoryInfo response. */
export function parseTefasHistory(data: unknown): Quote | null {
  const rows = (data as { data?: unknown[] })?.data;
  if (!Array.isArray(rows)) return null;
  let best: { time: number; price: number } | null = null;
  for (const row of rows) {
    const r = row as { TARIH?: string | number; FIYAT?: number | string };
    const time = Number(r.TARIH);
    const price = typeof r.FIYAT === 'string' ? parseFloat(r.FIYAT) : r.FIYAT;
    if (!Number.isFinite(time) || typeof price !== 'number' || !(price > 0)) continue;
    if (!best || time > best.time) best = { time, price };
  }
  if (!best) return null;
  return { price: best.price, currency: 'TRY', source: 'tefas', asOf: new Date(best.time).toISOString() };
}

export interface FundAttempt {
  source: string;
  status: number;
  ok: boolean;
  note?: string;
}

const TEFAS = 'https://www.tefas.gov.tr';
const TEFAS_HEADERS = {
  'User-Agent': USER_AGENT,
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  Origin: TEFAS,
  Referer: `${TEFAS}/TarihselVeriler.aspx`,
  Accept: 'application/json, text/javascript, */*; q=0.01',
};

function snippet(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function errorNote(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 120) : 'error';
}

/** Turns Set-Cookie response headers into a Cookie request header. */
export function cookieHeader(headers: Headers): string {
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/);
  return list
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c.includes('='))
    .join('; ');
}

/** Reads "Son Fiyat (TL)" from a TEFAS FonAnaliz page. */
export function parseTefasFundPage(html: string, nowMs: number = Date.now()): Quote | null {
  const match = html.match(/Son Fiyat[^<]*(?:<[^>]+>\s*)*?([\d.]*\d,\d+)/i);
  if (!match) return null;
  const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  if (!(price > 0)) return null;
  return { price, currency: 'TRY', source: 'tefas', asOf: new Date(nowMs).toISOString() };
}

function tefasDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
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
    // Funds price once per business day; two weeks covers weekends and holidays
    const body = new URLSearchParams({
      fontip: kind,
      fonkod: fund,
      bastarih: tefasDate(new Date(now() - 14 * 86_400_000)),
      bittarih: tefasDate(new Date(now())),
    }).toString();

    const postHistory = async (source: string, cookie?: string) => {
      try {
        const res = await fetchWithTimeout(fetchFn, `${TEFAS}/api/DB/BindHistoryInfo`, {
          method: 'POST',
          headers: { ...TEFAS_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
          body,
        });
        const text = await res.text();
        let quote: Quote | null = null;
        try {
          quote = res.ok ? parseTefasHistory(JSON.parse(text)) : null;
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

    // 1. History API directly
    let quote = await postHistory('tefas-api');
    if (quote) return { quote, attempts };

    // 2. Same API with the session cookies the site sets on its own page
    let cookie = '';
    try {
      const page = await fetchWithTimeout(fetchFn, `${TEFAS}/TarihselVeriler.aspx`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      cookie = cookieHeader(page.headers);
      await page.text();
    } catch (err) {
      attempts.push({ source: 'tefas-cookie', status: 0, ok: false, note: errorNote(err) });
    }
    if (cookie) {
      quote = await postHistory('tefas-api+cookie', cookie);
      if (quote) return { quote, attempts };
    }

    // 3. Fund analysis page, which shows the latest price
    try {
      const res = await fetchWithTimeout(fetchFn, `${TEFAS}/FonAnaliz.aspx?FonKod=${encodeURIComponent(fund)}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}) },
      });
      const html = await res.text();
      quote = res.ok ? parseTefasFundPage(html, now()) : null;
      attempts.push({ source: 'tefas-page', status: res.status, ok: !!quote, ...(quote ? {} : { note: snippet(html) }) });
    } catch (err) {
      attempts.push({ source: 'tefas-page', status: 0, ok: false, note: errorNote(err) });
    }
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

  return { getStockQuote, getFundQuote, getFundAttempts };
}

export interface ApiResult {
  status: number;
  body: unknown;
}

type PriceService = Pick<ReturnType<typeof createPriceService>, 'getStockQuote' | 'getFundQuote'> &
  Partial<Pick<ReturnType<typeof createPriceService>, 'getFundAttempts'>>;

/**
 * Shared request logic for the Node middleware and the Cloudflare Worker:
 *   GET /api/quote?symbol=THYAO.IS
 *   GET /api/fund?code=TCD&kind=YAT|EMK
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
