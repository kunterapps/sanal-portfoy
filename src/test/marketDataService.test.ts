import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchUpdatePortfolioPrices, fetchLivePriceForAsset, fetchMarketIndices, mergeMarketIndices, MarketIndex, fundPricedToday, hasPlaceholderName, needsFxExposure, tidyAssetName, parseTurkishNumber, quoteInCurrency } from '../services/marketDataService';
import { makeAsset, RATES } from './fixtures';

describe('parseTurkishNumber', () => {
  it.each([
    ['6.384,76', 6384.76],
    ['$3.996,40', 3996.4],
    ['49,7746', 49.7746],
    [12.5, 12.5],
    [undefined, 0],
    ['abc', 0],
  ])('%s -> %s', (input, expected) => {
    expect(parseTurkishNumber(input)).toBe(expected);
  });
});

describe('fetchLivePriceForAsset (offline categories)', () => {
  it('returns Ons Altın held in USD in USD, not TRY', async () => {
    const asset = makeAsset({ category: 'COMMODITY', goldType: 'ONS_GOLD', symbol: 'ONS_GOLD', currentCurrency: 'USD' });
    const result = await fetchLivePriceForAsset(asset, RATES);
    expect(result).toEqual({ price: 3110, success: true });
  });

  it('prices gram gold held in TRY', async () => {
    const asset = makeAsset({ category: 'COMMODITY', goldType: 'GRAM_24', symbol: 'GRAM_24' });
    expect(await fetchLivePriceForAsset(asset, RATES)).toEqual({ price: 4000, success: true });
  });

  it('prices cash from exchange rates', async () => {
    const asset = makeAsset({ category: 'CASH', symbol: 'EUR', currentCurrency: 'TRY', currentPrice: 1 });
    expect(await fetchLivePriceForAsset(asset, RATES)).toEqual({ price: 44, success: true });
  });

  it('keeps the existing price for unknown cash', async () => {
    const asset = makeAsset({ category: 'CASH', symbol: 'CHF', name: 'Frank', currentPrice: 48 });
    expect(await fetchLivePriceForAsset(asset, RATES)).toEqual({ price: 48, success: false });
  });
});

describe('batchUpdatePortfolioPrices', () => {
  it('flags assets whose price could not be fetched and clears the flag on success', async () => {
    const unknownCash = makeAsset({ id: 'x', category: 'CASH', symbol: 'CHF', name: 'Frank', currentPrice: 48 });
    const gold = makeAsset({ id: 'g', category: 'COMMODITY', goldType: 'GRAM_24', symbol: 'GRAM_24', priceStale: true });
    const result = await batchUpdatePortfolioPrices([unknownCash, gold], RATES);
    expect(result.failedCount).toBe(1);
    expect(result.updatedAssets[0]).toMatchObject({ currentPrice: 48, priceStale: true });
    expect(result.updatedAssets[1]).toMatchObject({ currentPrice: 4000, priceStale: false });
  });
});

describe('fundPricedToday', () => {
  const now = new Date(2026, 9, 25, 15, 0);
  it('skips funds priced live earlier today, unless the price is stale', () => {
    const fund = makeAsset({ category: 'TEFAS', priceFetchedAt: new Date(2026, 9, 25, 9, 0).toISOString() });
    expect(fundPricedToday(fund, now)).toBe(true);
    expect(fundPricedToday({ ...fund, priceStale: true }, now)).toBe(false);
    expect(fundPricedToday({ ...fund, priceFetchedAt: new Date(2026, 9, 24, 22, 0).toISOString() }, now)).toBe(false);
    expect(fundPricedToday({ ...fund, priceFetchedAt: undefined }, now)).toBe(false);
    expect(fundPricedToday({ ...fund, category: 'BIST' }, now)).toBe(false);
  });
});

describe('quoteInCurrency', () => {
  it('converts a quote into the asset currency', () => {
    const q = { price: 10, currency: 'EUR', source: 'yahoo', asOf: '' };
    expect(quoteInCurrency(q, 'TRY', RATES)).toBe(440);
    expect(quoteInCurrency(q, 'EUR', RATES)).toBe(10);
    expect(quoteInCurrency({ ...q, currency: 'JPY' }, 'TRY', RATES)).toBe(10);
  });
});

describe('fetchLivePriceForAsset (crypto)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBinance(prices: Record<string, number>) {
    const fetchMock = vi.fn(async (url: string) => {
      const symbol = new URL(url).searchParams.get('symbol') || '';
      return symbol in prices
        ? new Response(JSON.stringify({ symbol, price: String(prices[symbol]) }))
        : new Response('{"code":-1121,"msg":"Invalid symbol."}', { status: 400 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('prices USDT from the USDT/TRY pair', async () => {
    const fetchMock = stubBinance({ USDTTRY: 41.5 });
    const asset = makeAsset({ category: 'CRYPTO', symbol: 'USDT', currentCurrency: 'TRY' });
    expect(await fetchLivePriceForAsset(asset, RATES)).toEqual({ price: 41.5, success: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain('symbol=USDTTRY');
  });

  it('converts USDT into a USD-held asset', async () => {
    stubBinance({ USDTTRY: RATES.USD_TRY });
    const asset = makeAsset({ category: 'CRYPTO', symbol: 'USDT', currentCurrency: 'USD' });
    expect((await fetchLivePriceForAsset(asset, RATES)).price).toBeCloseTo(1);
  });

  it('still strips a USDT suffix from other coins', async () => {
    const fetchMock = stubBinance({ BTCUSDT: 100_000 });
    const asset = makeAsset({ category: 'CRYPTO', symbol: 'BTCUSDT', currentCurrency: 'USD' });
    expect(await fetchLivePriceForAsset(asset, RATES)).toEqual({ price: 100_000, success: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain('symbol=BTCUSDT');
  });
});

describe('needsFxExposure', () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  it('asks for funds with no share or a week-old one, never for other assets', () => {
    expect(needsFxExposure(makeAsset({ category: 'TEFAS' }), now)).toBe(true);
    expect(
      needsFxExposure(makeAsset({ category: 'BEFAS', fxExposurePct: 40, fxExposureUpdatedAt: '2026-10-20T12:00:00Z' }), now)
    ).toBe(false);
    expect(
      needsFxExposure(makeAsset({ category: 'TEFAS', fxExposurePct: 40, fxExposureUpdatedAt: '2026-10-17T12:00:00Z' }), now)
    ).toBe(true);
    expect(needsFxExposure(makeAsset({ category: 'TEFAS', fxExposurePct: 40 }), now)).toBe(true);
    expect(needsFxExposure(makeAsset({ category: 'BIST' }), now)).toBe(false);
  });
});

describe('asset names', () => {
  it('spots stocks and funds that only show their code', () => {
    expect(hasPlaceholderName(makeAsset({ symbol: 'MGROS', name: 'MGROS' }))).toBe(true);
    expect(hasPlaceholderName(makeAsset({ category: 'FOREIGN_STOCK', symbol: 'APLIB', name: 'APLIB.F' }))).toBe(true);
    expect(hasPlaceholderName(makeAsset({ category: 'TEFAS', symbol: 'IJC', name: '' }))).toBe(true);
    expect(hasPlaceholderName(makeAsset({ symbol: 'SISE', name: 'Türkiye Şişe ve Cam' }))).toBe(false);
    expect(hasPlaceholderName(makeAsset({ category: 'CRYPTO', symbol: 'BTC', name: 'BTC' }))).toBe(false);
  });

  it('turns all-caps names into Turkish title case and keeps mixed case', () => {
    expect(tidyAssetName('İŞ PORTFÖY YABANCI HİSSE SENEDİ FONU')).toBe('İş Portföy Yabancı Hisse Senedi Fonu');
    expect(tidyAssetName('TEKNOLOJİ VE  İNOVASYON')).toBe('Teknoloji ve İnovasyon');
    expect(tidyAssetName('Migros Ticaret A.S.')).toBe('Migros Ticaret A.S.');
  });
});

describe('market indices', () => {
  afterEach(() => vi.unstubAllGlobals());

  const idx = (key: string, price: number): MarketIndex => ({ key, label: key, unit: '', price, changePct: null, asOf: '2026-10-28T10:00:00Z' });

  it('fetches indices from the price API and Bitcoin from Binance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url, 'http://localhost');
        if (u.hostname === 'api.binance.com') {
          return new Response(JSON.stringify({ lastPrice: '110000.5', priceChangePercent: '-1.25' }));
        }
        const symbol = u.searchParams.get('symbol');
        if (symbol === 'XU100.IS') {
          return new Response(JSON.stringify({ price: 10200, previousClose: 10000, currency: 'TRY', source: 'yahoo', asOf: '2026-10-28T10:00:00Z' }));
        }
        if (symbol === '^GSPC') {
          return new Response(JSON.stringify({ price: 6800, currency: 'USD', source: 'yahoo', asOf: '2026-10-27T20:00:00Z' }));
        }
        return new Response('null', { status: 404 });
      })
    );
    const result = await fetchMarketIndices();
    expect(result.map((r) => r.key)).toEqual(['XU100', 'SPX', 'BTC']);
    expect(result[0].changePct).toBeCloseTo(2);
    expect(result[1].changePct).toBeNull();
    expect(result[2]).toMatchObject({ price: 110000.5, changePct: -1.25, unit: '$' });
  });

  it('keeps the last value of an index whose lookup failed, in display order', () => {
    const merged = mergeMarketIndices([idx('BTC', 2), idx('XU100', 3)], [idx('XU030', 1), idx('XU100', 9), idx('OLD', 5)]);
    expect(merged.map((m) => [m.key, m.price])).toEqual([
      ['XU100', 3],
      ['XU030', 1],
      ['BTC', 2],
    ]);
  });
});
