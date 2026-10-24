import { describe, expect, it } from 'vitest';
import { fetchLivePriceForAsset, parseTurkishNumber } from '../services/marketDataService';
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
