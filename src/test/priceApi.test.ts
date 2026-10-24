import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPriceMiddleware, createPriceService, parseTefasHistory, parseYahooChart } from '../../server/priceApi';

const yahoo = (meta: object, closes: (number | null)[] = []) => ({
  chart: { result: [{ meta, indicators: { quote: [{ close: closes }] } }] },
});

describe('parseYahooChart', () => {
  it('reads the regular market price and currency', () => {
    expect(parseYahooChart(yahoo({ regularMarketPrice: 312.5, currency: 'TRY', regularMarketTime: 1_700_000_000 }))).toEqual({
      price: 312.5,
      currency: 'TRY',
      source: 'yahoo',
      asOf: new Date(1_700_000_000_000).toISOString(),
    });
  });

  it('converts London pence to pounds', () => {
    expect(parseYahooChart(yahoo({ regularMarketPrice: 5000, currency: 'GBp' }))).toMatchObject({ price: 50, currency: 'GBP' });
  });

  it('falls back to the last close', () => {
    expect(parseYahooChart(yahoo({ currency: 'USD' }, [10, 11, null]))?.price).toBe(11);
  });

  it('returns null for empty or malformed data', () => {
    expect(parseYahooChart({ chart: { result: null } })).toBeNull();
    expect(parseYahooChart(yahoo({ currency: 'USD' }, [null]))).toBeNull();
    expect(parseYahooChart('nope')).toBeNull();
  });
});

describe('parseTefasHistory', () => {
  it('picks the most recent price', () => {
    const q = parseTefasHistory({
      data: [
        { TARIH: '1761177600000', FIYAT: 14.8 },
        { TARIH: '1761264000000', FIYAT: 14.9 },
        { TARIH: '1761091200000', FIYAT: 14.7 },
      ],
    });
    expect(q).toEqual({ price: 14.9, currency: 'TRY', source: 'tefas', asOf: new Date(1761264000000).toISOString() });
  });

  it('returns null without usable rows', () => {
    expect(parseTefasHistory({ data: [] })).toBeNull();
    expect(parseTefasHistory({ data: [{ TARIH: 'x', FIYAT: 0 }] })).toBeNull();
    expect(parseTefasHistory(null)).toBeNull();
  });
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('createPriceService', () => {
  it('fetches a stock quote once and serves it from cache', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(yahoo({ regularMarketPrice: 100, currency: 'USD' })));
    let t = 0;
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => t);
    expect((await service.getStockQuote('nvda'))?.price).toBe(100);
    expect(await service.getStockQuote('NVDA')).not.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String((fetchFn.mock.calls[0] as unknown[])[0])).toContain('/chart/NVDA?');
    t = 61_000;
    await service.getStockQuote('NVDA');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('tries the second Yahoo host when the first fails', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse(yahoo({ regularMarketPrice: 5, currency: 'EUR' })));
    const service = createPriceService(fetchFn as unknown as typeof fetch);
    expect((await service.getStockQuote('VWCE.DE'))?.currency).toBe('EUR');
    expect(String(fetchFn.mock.calls[1][0])).toContain('query2');
  });

  it('posts the fund code and type to TEFAS', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ data: [{ TARIH: '1761264000000', FIYAT: 0.42 }] }));
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => new Date(2026, 9, 24).getTime());
    expect((await service.getFundQuote('veb', 'EMK'))?.price).toBe(0.42);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('fontip=EMK');
    expect(String(init.body)).toContain('fonkod=VEB');
    expect(String(init.body)).toContain('bittarih=24.10.2026');
  });

  it('rejects malformed symbols without calling out', async () => {
    const fetchFn = vi.fn();
    const service = createPriceService(fetchFn as unknown as typeof fetch);
    expect(await service.getStockQuote('../etc/passwd')).toBeNull();
    expect(await service.getFundQuote('TOO-LONG-CODE', 'YAT')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns null when the source is unreachable', async () => {
    const service = createPriceService((async () => {
      throw new Error('network');
    }) as unknown as typeof fetch);
    expect(await service.getStockQuote('THYAO.IS')).toBeNull();
    expect(await service.getFundQuote('TCD', 'YAT')).toBeNull();
  });
});

describe('createPriceMiddleware', () => {
  function call(url: string, method = 'GET') {
    const service = {
      getStockQuote: vi.fn(async (s: string) => (s === 'THYAO.IS' ? { price: 312, currency: 'TRY', source: 'yahoo' as const, asOf: 'x' } : null)),
      getFundQuote: vi.fn(async () => ({ price: 14.9, currency: 'TRY', source: 'tefas' as const, asOf: 'x' })),
    };
    const res = { statusCode: 0, headers: {} as Record<string, string>, body: '' };
    const response = {
      set statusCode(v: number) { res.statusCode = v; },
      setHeader: (k: string, v: string) => { res.headers[k] = v; },
      end: (b: string) => { res.body = b; },
    } as unknown as ServerResponse;
    const next = vi.fn();
    const done = createPriceMiddleware(service)({ url, method } as IncomingMessage, response, next);
    return done.then(() => ({ ...res, json: res.body ? JSON.parse(res.body) : null, next, service }));
  }

  it('passes non-API requests through', async () => {
    expect((await call('/index.html')).next).toHaveBeenCalled();
  });

  it('serves quotes and funds', async () => {
    const q = await call('/api/quote?symbol=THYAO.IS');
    expect(q.statusCode).toBe(200);
    expect(q.json.price).toBe(312);
    const f = await call('/api/fund?code=TCD&kind=EMK');
    expect(f.json.price).toBe(14.9);
    expect(f.service.getFundQuote).toHaveBeenCalledWith('TCD', 'EMK');
  });

  it('answers 404 / 400 / 405 appropriately', async () => {
    expect((await call('/api/quote?symbol=NOPE')).statusCode).toBe(404);
    expect((await call('/api/quote?symbol=%3Cscript%3E')).statusCode).toBe(400);
    expect((await call('/api/quote?symbol=X', 'POST')).statusCode).toBe(405);
    expect((await call('/api/other')).statusCode).toBe(404);
  });
});
