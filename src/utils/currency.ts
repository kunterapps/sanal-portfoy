import { Currency, ExchangeRates, PortfolioAsset } from '../types/portfolio';

/**
 * Detects which currency a CASH asset actually holds, from its symbol or name
 * (e.g. "USD", "DOLAR", "Euro Hesabı", "TL"). Returns null when it can't tell.
 */
export function detectCashCurrency(asset: Pick<PortfolioAsset, 'symbol' | 'name'>): Currency | null {
  const sym = (asset.symbol || '').toUpperCase().trim();
  const name = (asset.name || '').toLocaleLowerCase('tr-TR');

  if (sym.includes('USD') || sym.includes('DOLAR') || name.includes('dolar')) return 'USD';
  if (sym.includes('EUR') || sym.includes('AVRO') || name.includes('euro') || name.includes('avro')) return 'EUR';
  if (sym.includes('GBP') || sym.includes('STERL') || name.includes('sterlin')) return 'GBP';
  if (sym.includes('TRY') || sym.includes('TL') || name.includes('lira')) return 'TRY';
  return null;
}

/** Value of one unit of `from` expressed in `to`. */
export function crossRate(from: Currency, to: Currency, rates: ExchangeRates): number {
  if (from === to) return 1;
  const inTRY: Record<Currency, number> = {
    TRY: 1,
    USD: rates.USD_TRY,
    EUR: rates.EUR_TRY,
    GBP: rates.GBP_TRY,
  };
  return inTRY[to] > 0 ? inTRY[from] / inTRY[to] : 0;
}

/**
 * Unit price of a CASH asset in its currentCurrency, or null if the held
 * currency can't be detected.
 */
export function getCashUnitPrice(asset: PortfolioAsset, rates: ExchangeRates): number | null {
  const held = detectCashCurrency(asset);
  if (!held) return null;
  return crossRate(held, asset.currentCurrency, rates);
}
