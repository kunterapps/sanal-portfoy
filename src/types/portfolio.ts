export type AssetCategory = 
  | 'FOREIGN_STOCK' 
  | 'BIST' 
  | 'TEFAS' 
  | 'BEFAS' 
  | 'COMMODITY' 
  | 'CASH'
  | 'CRYPTO';

export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';

export type GoldType = 
  | 'GRAM_24' 
  | 'CEYREK' 
  | 'YARIM' 
  | 'TAM' 
  | 'ATA_CUMHURIYET' 
  | 'BILEZIK_22' 
  | 'ONS_GOLD' 
  | 'GUMUS_GRAM';

export type TransactionType = 'BUY' | 'SELL';

/** A buy or sell. Prices and fees are in the asset's costCurrency. */
export interface AssetTransaction {
  id: string;
  type: TransactionType;
  date: string;            // YYYY-MM-DD
  quantity: number;
  price: number;           // Per unit
  fee?: number;            // Total commission for this transaction
  notes?: string;
  createdAt: number;       // Tie-breaker for same-day ordering
}

export interface PortfolioAsset {
  id: string;
  category: AssetCategory;
  symbol: string;
  name: string;
  quantity: number;        // Derived from transactions when present
  costPrice: number;       // Per unit in costCurrency (weighted average when derived from transactions)
  costCurrency: Currency;
  currentPrice: number;    // Per unit in currentCurrency
  currentCurrency: Currency;
  lastUpdated: string;     // ISO String
  goldType?: GoldType;
  notes?: string;
  purchaseDate?: string;
  /** True when the last live refresh couldn't fetch a price for this asset */
  priceStale?: boolean;
  transactions?: AssetTransaction[];
  /** Realized P/L from sales in costCurrency, derived from transactions */
  realizedProfit?: number;
  /** TEFAS/BEFAS funds: share of the fund's portfolio in FX, gold or foreign securities (0–100) */
  fxExposurePct?: number;
}

export interface ExchangeRates {
  USD_TRY: number;
  EUR_TRY: number;
  GBP_TRY: number;
  EUR_USD: number;
  GBP_USD: number;
  GRAM_GOLD_TRY: number;
  ONS_GOLD_USD: number;
  SILVER_GRAM_TRY: number;
  lastUpdated: string;
  // Specific live Turkish physical gold prices (Kapalıçarşı / Serbest Piyasa)
  CEYREK_GOLD_TRY?: number;
  YARIM_GOLD_TRY?: number;
  TAM_GOLD_TRY?: number;
  ATA_GOLD_TRY?: number;
  BILEZIK_22_TRY?: number;
}

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface PortfolioSnapshot {
  date: string;            // Local day, YYYY-MM-DD
  timestamp: number;
  totalValueTRY: number;
  totalValueUSD: number;
  totalCostTRY: number;
  totalCostUSD: number;
  /** Cumulative realized P/L at snapshot time (absent in older snapshots) */
  realizedProfitTRY?: number;
  realizedProfitUSD?: number;
}

export interface CategorySummary {
  category: AssetCategory;
  label: string;
  valueTRY: number;
  valueUSD: number;
  costTRY: number;
  profitTRY: number;
  profitPercentage: number;
  assetCount: number;
  color: string;
}

export interface CurrencySummary {
  currency: Currency;
  label: string;
  valueTRY: number;
  percentage: number;
  color: string;
}
