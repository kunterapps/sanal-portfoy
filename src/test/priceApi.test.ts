import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createPriceMiddleware,
  createPriceService,
  handlePriceRequest,
  parseTefasAllocation,
  parseTefasFunds,
  parseYahooChart,
} from '../../server/priceApi';

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

describe('parseTefasFunds', () => {
  it('picks the most recent price', () => {
    const q = parseTefasFunds({
      resultList: [
        { tarih: '2026-10-22', fonKodu: 'IJC', fiyat: 14.8 },
        { tarih: '2026-10-23', fonKodu: 'IJC', fiyat: 14.9 },
        { tarih: '2026-10-21', fonKodu: 'IJC', fiyat: 14.7 },
      ],
    });
    expect(q).toEqual({ price: 14.9, currency: 'TRY', source: 'tefas', asOf: new Date(Date.UTC(2026, 9, 23)).toISOString() });
  });

  it('accepts other date and number formats', () => {
    expect(parseTefasFunds({ resultList: [{ tarih: '20261023', fiyat: '1.234,5' }] })?.price).toBe(1234.5);
    expect(parseTefasFunds({ resultList: [{ tarih: '23.10.2026', fiyat: '2.75' }] })?.price).toBe(2.75);
    expect(parseTefasFunds({ resultList: [{ tarih: 1761264000000, fiyat: 3 }] })?.asOf).toBe(new Date(1761264000000).toISOString());
  });

  it('ignores rows for other funds', () => {
    expect(parseTefasFunds({ resultList: [{ tarih: '2026-10-23', fonKodu: 'TMG', fiyat: 5 }] }, 'IJC')).toBeNull();
  });

  it('returns null without usable rows', () => {
    expect(parseTefasFunds({ resultList: [] })).toBeNull();
    expect(parseTefasFunds({ resultList: [{ tarih: 'x', fiyat: 0 }] })).toBeNull();
    expect(parseTefasFunds({ errorMessage: 'Sistem Hatası!!' })).toBeNull();
    expect(parseTefasFunds(null)).toBeNull();
  });
});

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
}

const htmlResponse = (html: string, status = 200, headers: HeadersInit = {}) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html', ...headers } });

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

  it('posts the fund code to the TEFAS price endpoint', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ resultList: [{ tarih: '2026-10-23', fonKodu: 'VEB', fiyat: 0.42 }] }));
    const service = createPriceService(fetchFn as unknown as typeof fetch);
    expect((await service.getFundQuote('veb', 'EMK'))?.price).toBe(0.42);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ fonKodu: 'VEB', dil: 'TR', periyod: 1 });
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

describe('fund allocation', () => {
  it('sums foreign-currency, gold and foreign-security shares of the latest row', () => {
    const data = {
      resultList: [
        { fonKodu: 'AFT', tarih: '2026-10-22', yhs: 50 },
        { fonKodu: 'AFT', tarih: '2026-10-23', hs: 10, r: 5, yhs: '70,5', ybyf: 4, eut: 3, vmd: 2, km: 5.5, d: null },
        { fonKodu: 'XYZ', tarih: '2026-10-24', yhs: 100 },
      ],
    };
    expect(parseTefasAllocation(data, 'AFT')).toEqual({ fxPct: 85, source: 'tefas', asOf: '2026-10-23T00:00:00.000Z' });
    expect(parseTefasAllocation({ resultList: [] }, 'AFT')).toBeNull();
  });

  it('posts to the TEFAS allocation endpoint and serves the result', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ resultList: [{ fonKodu: 'AFT', tarih: '2026-10-23', yhs: 90 }] }));
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => new Date(2026, 9, 24).getTime());
    const result = await handlePriceRequest(new URL('http://x/api/fund-allocation?code=aft&kind=YAT'), 'GET', service);
    expect(result).toMatchObject({ status: 200, body: { fxPct: 90 } });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.tefas.gov.tr/api/funds/dagilimSiraliGetirT');
    expect(JSON.parse(String(init.body))).toMatchObject({ fonTipi: 'YAT', fonKodu: null, basTarih: '20261024', bitTarih: '20261024', bitSira: 100000 });
    await service.getFundAllocation('AFT', 'YAT');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('walks back over empty days and caches every fund in a full list', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultList: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          resultList: [
            { fonKodu: 'AAA', tarih: '2026-10-23', yhs: 10 },
            { fonKodu: 'TTE', tarih: '2026-10-23', yhs: 40, eut: 2 },
          ],
        })
      );
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => new Date(2026, 9, 24).getTime());
    expect((await service.getFundAllocation('TTE', 'YAT'))?.fxPct).toBe(42);
    expect(JSON.parse(String((fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body)).basTarih).toBe('20261023');
    expect((await service.getFundAllocation('AAA', 'YAT'))?.fxPct).toBe(10);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('shares one TEFAS request between concurrent lookups', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ resultList: [{ fonKodu: 'IJC', tarih: '2026-10-23', yhs: 5 }, { fonKodu: 'TMG', tarih: '2026-10-23', eut: 4 }] })
    );
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => new Date(2026, 9, 24).getTime());
    const [ijc, tmg] = await Promise.all([service.getFundAllocation('IJC', 'YAT'), service.getFundAllocation('TMG', 'YAT')]);
    expect([ijc?.fxPct, tmg?.fxPct]).toEqual([5, 4]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('TEFAS fallbacks', () => {
  it('falls back to the fund info endpoint with type and date range', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultList: [] }))
      .mockResolvedValueOnce(jsonResponse({ resultList: [{ tarih: '2026-10-23', fonKodu: 'VEB', fiyat: 0.5 }] }));
    const service = createPriceService(fetchFn as unknown as typeof fetch, () => new Date(2026, 9, 24).getTime());
    expect((await service.getFundQuote('VEB', 'EMK'))?.price).toBe(0.5);
    const [url, init] = fetchFn.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir');
    expect(JSON.parse(String(init.body))).toMatchObject({ fonTipi: 'EMK', fonKodu: 'VEB', basTarih: '20261010', bitTarih: '20261024' });
  });

  it('reports what each source answered when all fail', async () => {
    const fetchFn = vi.fn(async () => htmlResponse('<html><body>Access denied</body></html>', 403));
    const service = createPriceService(fetchFn as unknown as typeof fetch);
    const result = await handlePriceRequest(new URL('http://x/api/fund?code=TCD'), 'GET', service);
    expect(result?.status).toBe(404);
    const details = (result?.body as { details: { source: string; status: number; note?: string }[] }).details;
    expect(details.map((d) => d.source)).toEqual(['tefas-fiyat', 'tefas-bilgi']);
    expect(details[0]).toMatchObject({ status: 403, note: 'Access denied' });
  });
});
