import { ExchangeRates, PortfolioAsset } from '../types/portfolio';

export const RATES: ExchangeRates = {
  USD_TRY: 40,
  EUR_TRY: 44,
  GBP_TRY: 52,
  EUR_USD: 1.1,
  GBP_USD: 1.3,
  GRAM_GOLD_TRY: 4000,
  ONS_GOLD_USD: 3110,
  SILVER_GRAM_TRY: 50,
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

export function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  return {
    id: 'a1',
    category: 'BIST',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    quantity: 10,
    costPrice: 100,
    costCurrency: 'TRY',
    currentPrice: 150,
    currentCurrency: 'TRY',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
