import { describe, expect, it } from 'vitest';
import {
  calculateCategorySummaries,
  calculateCurrencySummaries,
  calculatePortfolioTotals,
  convertToTRY,
  convertToUSD,
  getAssetProfitLoss,
  getExposureCurrency,
} from '../utils/portfolioCalculations';
import { makeAsset, RATES } from './fixtures';

describe('currency conversion', () => {
  it('converts to TRY and USD', () => {
    expect(convertToTRY(10, 'USD', RATES)).toBe(400);
    expect(convertToTRY(10, 'TRY', RATES)).toBe(10);
    expect(convertToUSD(400, 'TRY', RATES)).toBe(10);
    expect(convertToUSD(10, 'EUR', RATES)).toBe(11);
  });
});

describe('getAssetProfitLoss', () => {
  it('computes profit in TRY and percent', () => {
    const pl = getAssetProfitLoss(makeAsset(), RATES);
    expect(pl.costTRY).toBe(1000);
    expect(pl.valueTRY).toBe(1500);
    expect(pl.profitTRY).toBe(500);
    expect(pl.profitPercent).toBe(50);
    expect(pl.profitUSD).toBe(12.5);
  });

  it('handles cost and current price in different currencies', () => {
    const asset = makeAsset({ quantity: 2, costPrice: 1000, costCurrency: 'TRY', currentPrice: 30, currentCurrency: 'USD' });
    const pl = getAssetProfitLoss(asset, RATES);
    expect(pl.costTRY).toBe(2000);
    expect(pl.valueTRY).toBe(2400);
    expect(pl.profitPercent).toBe(20);
  });

  it('returns 0% for zero-cost assets', () => {
    expect(getAssetProfitLoss(makeAsset({ costPrice: 0 }), RATES).profitPercent).toBe(0);
  });
});

describe('portfolio summaries', () => {
  const assets = [
    makeAsset({ id: '1' }),
    makeAsset({ id: '2', category: 'FOREIGN_STOCK', symbol: 'NVDA', quantity: 1, costPrice: 100, costCurrency: 'USD', currentPrice: 125, currentCurrency: 'USD' }),
    makeAsset({ id: '3', category: 'CASH', symbol: 'USD', quantity: 100, costPrice: 40, currentPrice: 40, currentCurrency: 'TRY' }),
  ];

  it('totals all assets', () => {
    const t = calculatePortfolioTotals(assets, RATES);
    expect(t.totalCostTRY).toBe(1000 + 4000 + 4000);
    expect(t.totalValueTRY).toBe(1500 + 5000 + 4000);
    expect(t.assetCount).toBe(3);
  });

  it('groups by category and drops empty categories', () => {
    const cats = calculateCategorySummaries(assets, RATES).map((c) => c.category);
    expect(cats.sort()).toEqual(['BIST', 'CASH', 'FOREIGN_STOCK']);
  });

  it('counts USD cash held in TRY as USD exposure', () => {
    const byCurrency = Object.fromEntries(calculateCurrencySummaries(assets, RATES).map((c) => [c.currency, c.valueTRY]));
    expect(byCurrency).toEqual({ TRY: 1500, USD: 9000 });
  });

  it('counts every gold type as USD exposure, but not silver', () => {
    const metals = [
      makeAsset({ id: 'g1', category: 'COMMODITY', goldType: 'CEYREK', quantity: 1, currentPrice: 2000 }),
      makeAsset({ id: 'g2', category: 'COMMODITY', goldType: 'GRAM_24', quantity: 1, currentPrice: 3000 }),
      makeAsset({ id: 's1', category: 'COMMODITY', goldType: 'GUMUS_GRAM', quantity: 1, currentPrice: 500 }),
    ];
    expect(getExposureCurrency(metals[0])).toBe('USD');
    const byCurrency = Object.fromEntries(calculateCurrencySummaries(metals, RATES).map((c) => [c.currency, c.valueTRY]));
    expect(byCurrency).toEqual({ TRY: 500, USD: 5000 });
  });
});
