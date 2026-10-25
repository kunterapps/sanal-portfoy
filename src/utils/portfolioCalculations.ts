import { 
  PortfolioAsset, 
  ExchangeRates, 
  CategorySummary, 
  CurrencySummary, 
  Currency, 
  AssetCategory 
} from '../types/portfolio';
import { detectCashCurrency } from './currency';

export const CATEGORY_METADATA: Record<AssetCategory, { label: string; color: string; shortLabel: string }> = {
  FOREIGN_STOCK: { label: 'Yabancı Hisse & ETF', shortLabel: 'Yabancı Hisse', color: '#6366F1' }, // Indigo
  BIST: { label: 'BIST Hisseleri', shortLabel: 'BIST', color: '#0EA5E9' },           // Sky Blue
  TEFAS: { label: 'TEFAS Menkul Fonları', shortLabel: 'TEFAS', color: '#10B981' },   // Emerald
  BEFAS: { label: 'BEFAS Emeklilik Fonları', shortLabel: 'BEFAS', color: '#14B8A6' }, // Teal
  COMMODITY: { label: 'Altın & Kıymetli Maden', shortLabel: 'Altın/Emtia', color: '#F59E0B' }, // Amber/Gold
  CASH: { label: 'Nakit & Döviz', shortLabel: 'Nakit', color: '#8B5CF6' },            // Purple
  CRYPTO: { label: 'Kripto Varlıklar', shortLabel: 'Kripto', color: '#F97316' },      // Orange (Bitcoin)
};

export const CURRENCY_METADATA: Record<Currency, { label: string; symbol: string; color: string }> = {
  TRY: { label: 'Türk Lirası', symbol: '₺', color: '#0EA5E9' },
  USD: { label: 'Amerikan Doları', symbol: '$', color: '#10B981' },
  EUR: { label: 'Euro', symbol: '€', color: '#F59E0B' },
  GBP: { label: 'İngiliz Sterlini', symbol: '£', color: '#8B5CF6' },
};

/**
 * Converts any currency amount to TRY using live exchange rates
 */
export function convertToTRY(amount: number, currency: Currency, rates: ExchangeRates): number {
  if (!amount || amount === 0) return 0;
  switch (currency) {
    case 'TRY': return amount;
    case 'USD': return amount * rates.USD_TRY;
    case 'EUR': return amount * rates.EUR_TRY;
    case 'GBP': return amount * rates.GBP_TRY;
    default: return amount;
  }
}

/**
 * Converts any currency amount to USD using live exchange rates
 */
export function convertToUSD(amount: number, currency: Currency, rates: ExchangeRates): number {
  if (!amount || amount === 0) return 0;
  const inTRY = convertToTRY(amount, currency, rates);
  return rates.USD_TRY > 0 ? inTRY / rates.USD_TRY : 0;
}

/**
 * Calculates current market value of an individual asset in its currentCurrency
 */
export function getAssetCurrentValue(asset: PortfolioAsset): number {
  return asset.quantity * asset.currentPrice;
}

/**
 * Calculates total cost of an individual asset in its costCurrency
 */
export function getAssetCostValue(asset: PortfolioAsset): number {
  return asset.quantity * asset.costPrice;
}

/**
 * Calculates profit/loss in TRY and % for an individual asset
 */
export function getAssetProfitLoss(
  asset: PortfolioAsset,
  rates: ExchangeRates
): {
  costTRY: number;
  valueTRY: number;
  costUSD: number;
  valueUSD: number;
  profitTRY: number;
  profitUSD: number;
  profitPercent: number;
} {
  const costTRY = convertToTRY(getAssetCostValue(asset), asset.costCurrency, rates);
  const valueTRY = convertToTRY(getAssetCurrentValue(asset), asset.currentCurrency, rates);
  const costUSD = convertToUSD(getAssetCostValue(asset), asset.costCurrency, rates);
  const valueUSD = convertToUSD(getAssetCurrentValue(asset), asset.currentCurrency, rates);

  const profitTRY = valueTRY - costTRY;
  const profitUSD = valueUSD - costUSD;
  const profitPercent = costTRY > 0 ? (profitTRY / costTRY) * 100 : 0;

  return {
    costTRY,
    valueTRY,
    costUSD,
    valueUSD,
    profitTRY,
    profitUSD,
    profitPercent,
  };
}

/**
 * Generates overall portfolio executive totals
 */
export function calculatePortfolioTotals(assets: PortfolioAsset[], rates: ExchangeRates) {
  let totalValueTRY = 0;
  let totalCostTRY = 0;
  let totalValueUSD = 0;
  let totalCostUSD = 0;
  let realizedProfitTRY = 0;
  let realizedProfitUSD = 0;
  let openCount = 0;

  assets.forEach((asset) => {
    const pl = getAssetProfitLoss(asset, rates);
    totalValueTRY += pl.valueTRY;
    totalCostTRY += pl.costTRY;
    totalValueUSD += pl.valueUSD;
    totalCostUSD += pl.costUSD;
    // Realized P/L is kept in costCurrency; converted at today's rates
    realizedProfitTRY += convertToTRY(asset.realizedProfit || 0, asset.costCurrency, rates);
    realizedProfitUSD += convertToUSD(asset.realizedProfit || 0, asset.costCurrency, rates);
    if (asset.quantity > 0) openCount++;
  });

  const totalProfitTRY = totalValueTRY - totalCostTRY;
  const totalProfitUSD = totalValueUSD - totalCostUSD;
  const totalProfitPercent = totalCostTRY > 0 ? (totalProfitTRY / totalCostTRY) * 100 : 0;

  return {
    totalValueTRY,
    totalValueUSD,
    totalCostTRY,
    totalCostUSD,
    totalProfitTRY,
    totalProfitUSD,
    totalProfitPercent,
    realizedProfitTRY,
    realizedProfitUSD,
    assetCount: openCount,
  };
}

/**
 * Computes breakdown by asset category
 */
export function calculateCategorySummaries(
  assets: PortfolioAsset[],
  rates: ExchangeRates
): CategorySummary[] {
  const categories: AssetCategory[] = [
    'FOREIGN_STOCK',
    'BIST',
    'COMMODITY',
    'CRYPTO',
    'TEFAS',
    'BEFAS',
    'CASH',
  ];

  return categories.map((cat) => {
    const catAssets = assets.filter((a) => a.category === cat);
    let valueTRY = 0;
    let costTRY = 0;
    let valueUSD = 0;

    catAssets.forEach((asset) => {
      const pl = getAssetProfitLoss(asset, rates);
      valueTRY += pl.valueTRY;
      costTRY += pl.costTRY;
      valueUSD += pl.valueUSD;
    });

    const profitTRY = valueTRY - costTRY;
    const profitPercentage = costTRY > 0 ? (profitTRY / costTRY) * 100 : 0;

    return {
      category: cat,
      label: CATEGORY_METADATA[cat].label,
      valueTRY,
      valueUSD,
      costTRY,
      profitTRY,
      profitPercentage,
      assetCount: catAssets.length,
      color: CATEGORY_METADATA[cat].color,
    };
  }).filter((c) => c.valueTRY > 0 || c.assetCount > 0);
}

/**
 * Currency an asset is actually exposed to. CASH is detected from its
 * symbol/name; gold and silver track USD ounce prices even when priced in
 * TRY; everything else follows its price currency.
 */
export function getExposureCurrency(asset: PortfolioAsset): Currency {
  if (asset.category === 'CASH') return detectCashCurrency(asset) || asset.currentCurrency;
  if (asset.category === 'COMMODITY' && asset.goldType) return 'USD';
  return asset.currentCurrency;
}

/**
 * How an asset's value splits across currencies, as fractions summing to 1.
 * TRY funds with a known foreign-currency share count that share as USD.
 */
export function getExposureSplit(asset: PortfolioAsset): Partial<Record<Currency, number>> {
  const main = getExposureCurrency(asset);
  const fx = (asset.category === 'TEFAS' || asset.category === 'BEFAS') && main === 'TRY'
    ? Math.min(100, Math.max(0, asset.fxExposurePct ?? 0)) / 100
    : 0;
  if (fx === 0) return { [main]: 1 };
  if (fx === 1) return { USD: 1 };
  return { TRY: 1 - fx, USD: fx };
}

/**
 * Computes currency risk breakdown
 */
export function calculateCurrencySummaries(
  assets: PortfolioAsset[],
  rates: ExchangeRates
): CurrencySummary[] {
  const totals = calculatePortfolioTotals(assets, rates);
  const currencies: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];

  const summaries = currencies.map((curr) => {
    let valueTRY = 0;
    assets.forEach((asset) => {
      const share = getExposureSplit(asset)[curr];
      if (share) valueTRY += getAssetProfitLoss(asset, rates).valueTRY * share;
    });

    const percentage = totals.totalValueTRY > 0 ? (valueTRY / totals.totalValueTRY) * 100 : 0;

    return {
      currency: curr,
      label: CURRENCY_METADATA[curr].label,
      valueTRY,
      percentage: Math.round(percentage * 10) / 10,
      color: CURRENCY_METADATA[curr].color,
    };
  });

  return summaries.filter((s) => s.valueTRY > 0);
}

/**
 * Format currency with locale and symbol
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'TRY',
  decimals = 2
): string {
  const sym = CURRENCY_METADATA[currency]?.symbol || '';
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${sym}${formatted}`;
}

export function formatPercent(percent: number, showSign = true): string {
  const sign = percent > 0 && showSign ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
