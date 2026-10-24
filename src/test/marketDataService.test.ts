import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchUpdatePortfolioPrices, fetchLivePriceForAsset, parseTurkishNumber, quoteInCurrency } from '../services/marketDataService';
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
