/**
 * Server-side price lookups. Runs in Node (Vite dev/preview middleware), so it
 * can call Yahoo Finance and TEFAS directly instead of going through public
 * CORS proxies that see every symbol in the portfolio.
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

  async function getFundQuote(code: string, kind: 'YAT' | 'EMK'): Promise<Quote | null> {
    const fund = code.trim().toUpperCase();
    if (!FUND_RE.test(fund)) return null;
    return cached(`tefas:${kind}:${fund}`, 10 * 60_000, async () => {
      // Funds price once per business day; two weeks covers weekends and holidays
      const end = new Date(now());
      const start = new Date(now() - 14 * 86_400_000);
      const body = new URLSearchParams({
        fontip: kind,
        fonkod: fund,
        bastarih: tefasDate(start),
        bittarih: tefasDate(end),
      });
      try {
        const res = await fetchWithTimeout(fetchFn, 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
          method: 'POST',
          headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Origin: 'https://www.tefas.gov.tr',
            Referer: 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
            Accept: 'application/json, text/javascript, */*; q=0.01',
          },
          body: body.toString(),
        });
        if (!res.ok) return null;
        return parseTefasHistory(await res.json());
      } catch {
        return null;
      }
    });
  }

  return { getStockQuote, getFundQuote };
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Connect-style middleware for:
 *   GET /api/quote?symbol=THYAO.IS
 *   GET /api/fund?code=TCD&kind=YAT|EMK
 */
export function createPriceMiddleware(service = createPriceService()) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Yalnızca GET desteklenir' });

    try {
      if (url.pathname === '/api/quote') {
        const symbol = url.searchParams.get('symbol') || '';
        if (!SYMBOL_RE.test(symbol.trim().toUpperCase())) return sendJson(res, 400, { error: 'Geçersiz sembol' });
        const quote = await service.getStockQuote(symbol);
        return quote ? sendJson(res, 200, quote) : sendJson(res, 404, { error: 'Fiyat bulunamadı' });
      }

      if (url.pathname === '/api/fund') {
        const code = url.searchParams.get('code') || '';
        const kind = url.searchParams.get('kind') === 'EMK' ? 'EMK' : 'YAT';
        if (!FUND_RE.test(code.trim().toUpperCase())) return sendJson(res, 400, { error: 'Geçersiz fon kodu' });
        const quote = await service.getFundQuote(code, kind);
        return quote ? sendJson(res, 200, quote) : sendJson(res, 404, { error: 'Fiyat bulunamadı' });
      }

      return sendJson(res, 404, { error: 'Bilinmeyen uç nokta' });
    } catch (err) {
      console.error('Price API error', err);
      return sendJson(res, 502, { error: 'Fiyat kaynağına ulaşılamadı' });
    }
  };
}
