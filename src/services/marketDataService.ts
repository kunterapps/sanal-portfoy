import { Currency, ExchangeRates, PortfolioAsset } from '../types/portfolio';
import { calculateGoldUnitPrice } from '../utils/goldCalculations';
import { crossRate, getCashUnitPrice } from '../utils/currency';

// Robust helper to parse Turkish currency and number strings (e.g. "6.384,76", "$3.996,40", "49,7746")
export function parseTurkishNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;
  const clean = val.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Current baseline rates updated to current 2026 market standards
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD_TRY: 49.75,
  EUR_TRY: 55.80,
  GBP_TRY: 66.65,
  EUR_USD: 1.122,
  GBP_USD: 1.339,
  GRAM_GOLD_TRY: 6385,
  ONS_GOLD_USD: 3996,
  SILVER_GRAM_TRY: 86.2,
  CEYREK_GOLD_TRY: 10560,
  YARIM_GOLD_TRY: 21120,
  TAM_GOLD_TRY: 42112,
  ATA_GOLD_TRY: 43484,
  BILEZIK_22_TRY: 5890,
  lastUpdated: new Date().toISOString(),
};

/**
 * Fetches real-time market exchange rates and Turkish gold prices.
 * Strategy:
 * 1. Primary: Direct fetch to open-CORS Turkish finance feed (finans.truncgil.com/today.json)
 *    which gives exact Kapalıçarşı / Serbest Piyasa prices for Has Gram, Çeyrek, Yarım, Tam, Ata, Bilezik, Ons, Gümüş, USD, EUR, GBP.
 * 2. Secondary: Binance direct PAXG ticker (PAXGTRY / PAXGUSDT) + open.er-api.com for 24/7 global gold backing.
 * 3. Fallback: Robust updated baseline defaults.
 */
export async function fetchLiveExchangeRates(): Promise<ExchangeRates> {
  // --- Strategy 1: Truncgil Turkish Market Feed (Direct open CORS) ---
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch('https://finans.truncgil.com/today.json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const usdTry = parseTurkishNumber(data.USD?.Satış);
      const eurTry = parseTurkishNumber(data.EUR?.Satış);
      const gbpTry = parseTurkishNumber(data.GBP?.Satış);
      const gramGoldTry = parseTurkishNumber(data['gram-altin']?.Satış || data['gram-has-altin']?.Satış);
      const ceyrekTry = parseTurkishNumber(data['ceyrek-altin']?.Satış);
      const yarimTry = parseTurkishNumber(data['yarim-altin']?.Satış);
      const tamTry = parseTurkishNumber(data['tam-altin']?.Satış);
      const ataTry = parseTurkishNumber(data['cumhuriyet-altini']?.Satış || data['ata-altin']?.Satış);
      const bilezikTry = parseTurkishNumber(data['22-ayar-bilezik']?.Satış);
      const onsUsd = parseTurkishNumber(data.ons?.Satış);
      const silverTry = parseTurkishNumber(data.gumus?.Satış);

      if (gramGoldTry > 1000 && usdTry > 10) {
        return {
          USD_TRY: Math.round(usdTry * 10000) / 10000,
          EUR_TRY: Math.round((eurTry || usdTry * 1.12) * 10000) / 10000,
          GBP_TRY: Math.round((gbpTry || usdTry * 1.34) * 10000) / 10000,
          EUR_USD: usdTry > 0 && eurTry > 0 ? Math.round((eurTry / usdTry) * 10000) / 10000 : 1.122,
          GBP_USD: usdTry > 0 && gbpTry > 0 ? Math.round((gbpTry / usdTry) * 10000) / 10000 : 1.339,
          GRAM_GOLD_TRY: Math.round(gramGoldTry * 100) / 100,
          ONS_GOLD_USD: onsUsd > 1000 ? Math.round(onsUsd * 100) / 100 : Math.round(((gramGoldTry * 31.1034768) / usdTry) * 100) / 100,
          SILVER_GRAM_TRY: silverTry > 0 ? Math.round(silverTry * 100) / 100 : 86.2,
          CEYREK_GOLD_TRY: ceyrekTry > 0 ? Math.round(ceyrekTry * 100) / 100 : Math.round(1.754 * 0.916 * gramGoldTry * 1.035),
          YARIM_GOLD_TRY: yarimTry > 0 ? Math.round(yarimTry * 100) / 100 : Math.round(3.508 * 0.916 * gramGoldTry * 1.035),
          TAM_GOLD_TRY: tamTry > 0 ? Math.round(tamTry * 100) / 100 : Math.round(7.016 * 0.916 * gramGoldTry * 1.035),
          ATA_GOLD_TRY: ataTry > 0 ? Math.round(ataTry * 100) / 100 : Math.round(7.216 * 0.916 * gramGoldTry * 1.04),
          BILEZIK_22_TRY: bilezikTry > 0 ? Math.round(bilezikTry * 100) / 100 : Math.round(gramGoldTry * 0.916),
          lastUpdated: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('Truncgil live gold feed was unreachable, trying secondary global sources...', err);
  }

  // --- Strategy 2: Binance PAXG (Gold backed 1:1) + Open Exchange Rates ---
  try {
    // 2.1 Fetch exchange rates
    let usdTry = DEFAULT_EXCHANGE_RATES.USD_TRY;
    let eurTry = DEFAULT_EXCHANGE_RATES.EUR_TRY;
    let gbpTry = DEFAULT_EXCHANGE_RATES.GBP_TRY;
    let eurUsd = DEFAULT_EXCHANGE_RATES.EUR_USD;
    let gbpUsd = DEFAULT_EXCHANGE_RATES.GBP_USD;

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        const r = data.rates || {};
        if (r.TRY) {
          usdTry = r.TRY;
          eurUsd = 1 / (r.EUR || 0.89);
          gbpUsd = 1 / (r.GBP || 0.75);
          eurTry = usdTry * eurUsd;
          gbpTry = usdTry * gbpUsd;
        }
      }
    } catch {}

    // 2.2 Fetch real-time gold price from Binance PAXG (Gold backed token, 1 PAXG = 1 Fine Troy Ounce)
    let gramGoldTry = DEFAULT_EXCHANGE_RATES.GRAM_GOLD_TRY;
    let onsGoldUsd = DEFAULT_EXCHANGE_RATES.ONS_GOLD_USD;

    try {
      // First try direct PAXGTRY
      const paxgTryRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGTRY');
      if (paxgTryRes.ok) {
        const paxgData = await paxgTryRes.json();
        const paxgTryPrice = parseFloat(paxgData.price);
        if (paxgTryPrice > 10000) {
          gramGoldTry = Math.round((paxgTryPrice / 31.1034768) * 100) / 100;
          onsGoldUsd = Math.round((paxgTryPrice / usdTry) * 100) / 100;
        }
      }
    } catch {}

    // If PAXGTRY didn't fire, try PAXGUSDT * USD/TRY
    if (gramGoldTry === DEFAULT_EXCHANGE_RATES.GRAM_GOLD_TRY) {
      try {
        const paxgUsdRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        if (paxgUsdRes.ok) {
          const paxgData = await paxgUsdRes.json();
          const p = parseFloat(paxgData.price);
          if (p > 1000) {
            onsGoldUsd = p;
            gramGoldTry = Math.round(((p / 31.1034768) * usdTry) * 100) / 100;
          }
        }
      } catch {}
    }

    const ceyrekTry = Math.round(1.754 * 0.916 * gramGoldTry * 1.035);
    const yarimTry = Math.round(3.508 * 0.916 * gramGoldTry * 1.035);
    const tamTry = Math.round(7.016 * 0.916 * gramGoldTry * 1.035);
    const ataTry = Math.round(7.216 * 0.916 * gramGoldTry * 1.04);
    const bilezikTry = Math.round(gramGoldTry * 0.916);

    return {
      USD_TRY: Math.round(usdTry * 10000) / 10000,
      EUR_TRY: Math.round(eurTry * 10000) / 10000,
      GBP_TRY: Math.round(gbpTry * 10000) / 10000,
      EUR_USD: Math.round(eurUsd * 10000) / 10000,
      GBP_USD: Math.round(gbpUsd * 10000) / 10000,
      GRAM_GOLD_TRY: gramGoldTry,
      ONS_GOLD_USD: onsGoldUsd,
      SILVER_GRAM_TRY: 86.2,
      CEYREK_GOLD_TRY: ceyrekTry,
      YARIM_GOLD_TRY: yarimTry,
      TAM_GOLD_TRY: tamTry,
      ATA_GOLD_TRY: ataTry,
      BILEZIK_22_TRY: bilezikTry,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Could not fetch secondary live rates, using updated baseline rates', err);
    return {
      ...DEFAULT_EXCHANGE_RATES,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export interface ServerQuote {
  price: number;
  currency: string;
  source: string;
  asOf: string;
  name?: string;
  previousClose?: number;
}

// Price API location: same origin in local dev/preview, the Cloudflare Worker
// URL in the GitHub Pages build (set via VITE_PRICE_API_URL at build time).
const PRICE_API_BASE = (import.meta.env.VITE_PRICE_API_URL || '').replace(/\/+$/, '');

/**
 * Fetches a quote from the app's price API (see server/priceApi.ts),
 * which calls Yahoo Finance / TEFAS server-side.
 */
async function fetchServerQuote(path: string): Promise<ServerQuote | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${PRICE_API_BASE}${path}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.price === 'number' && data.price > 0 ? data : null;
  } catch {
    return null;
  }
}

export function fetchStockQuote(symbol: string): Promise<ServerQuote | null> {
  return fetchServerQuote(`/api/quote?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`);
}

export function fetchFundQuote(code: string, kind: 'YAT' | 'EMK'): Promise<ServerQuote | null> {
  return fetchServerQuote(`/api/fund?code=${encodeURIComponent(code.trim().toUpperCase())}&kind=${kind}`);
}

export interface MarketIndex {
  key: string;
  label: string;
  /** Unit shown before the value ('$' for oil and Bitcoin, empty for index points) */
  unit: string;
  price: number;
  /** Change since the previous close, in percent (24 h rolling for Bitcoin) */
  changePct: number | null;
  asOf: string;
}

/** Indices and benchmarks shown in the header strip, in display order */
export const MARKET_INDICES: { key: string; label: string; unit: string; yahoo: string; binance?: string }[] = [
  { key: 'XU100', label: 'BIST 100', unit: '', yahoo: 'XU100.IS' },
  { key: 'XU030', label: 'BIST 30', unit: '', yahoo: 'XU030.IS' },
  { key: 'SPX', label: 'S&P 500', unit: '', yahoo: '^GSPC' },
  { key: 'NDX', label: 'Nasdaq', unit: '', yahoo: '^IXIC' },
  // Yahoo's Brent is NYMEX's thin copy of ICE Brent, so it can sit a few dollars off other sites
  { key: 'BRENT', label: 'Petrol', unit: '$', yahoo: 'BZ=F' },
  { key: 'BTC', label: 'Bitcoin', unit: '$', yahoo: 'BTC-USD', binance: 'BTCUSDT' },
];

function changePct(price: number, previousClose: number | undefined): number | null {
  return previousClose && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null;
}

async function fetchBinance24h(pair: string): Promise<{ price: number; changePct: number | null } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data.lastPrice);
    const pct = parseFloat(data.priceChangePercent);
    return price > 0 ? { price, changePct: isNaN(pct) ? null : pct } : null;
  } catch {
    return null;
  }
}

/**
 * Fetches the header strip's indices: Bitcoin from Binance (Yahoo as
 * fallback), the rest from Yahoo via the price API. Failed lookups are left out.
 */
export async function fetchMarketIndices(): Promise<MarketIndex[]> {
  const results = await Promise.all(
    MARKET_INDICES.map(async (def): Promise<MarketIndex | null> => {
      const base = { key: def.key, label: def.label, unit: def.unit };
      if (def.binance) {
        const t = await fetchBinance24h(def.binance);
        if (t) return { ...base, ...t, asOf: new Date().toISOString() };
      }
      const q = await fetchStockQuote(def.yahoo);
      return q && { ...base, price: q.price, changePct: changePct(q.price, q.previousClose), asOf: q.asOf };
    })
  );
  return results.filter((x): x is MarketIndex => !!x);
}

/**
 * Puts fresh index values over the previous ones in display order, so an index
 * whose lookup failed keeps its last value instead of vanishing from the strip.
 */
export function mergeMarketIndices(fresh: MarketIndex[], previous: MarketIndex[]): MarketIndex[] {
  return MARKET_INDICES.map(
    (def) => fresh.find((x) => x.key === def.key) ?? previous.find((x) => x.key === def.key)
  ).filter((x): x is MarketIndex => !!x);
}

/**
 * TEFAS/BEFAS funds get one price a day, so a fund already priced live today
 * (local day) doesn't need another lookup.
 */
export function fundPricedToday(asset: PortfolioAsset, now = new Date()): boolean {
  if (asset.category !== 'TEFAS' && asset.category !== 'BEFAS') return false;
  if (asset.priceStale || !asset.priceFetchedAt || hasPlaceholderName(asset)) return false;
  const fetched = new Date(asset.priceFetchedAt);
  return fetched.toDateString() === now.toDateString();
}

/** A fund's foreign-currency share is re-fetched at most this often. */
export const FX_EXPOSURE_MAX_AGE_MS = 7 * 86_400_000;

/** True for a TEFAS/BEFAS fund whose foreign-currency share is missing or older than a week. */
export function needsFxExposure(asset: PortfolioAsset, nowMs = Date.now()): boolean {
  if (asset.category !== 'TEFAS' && asset.category !== 'BEFAS') return false;
  if (asset.fxExposurePct === undefined || !asset.fxExposureUpdatedAt) return true;
  const fetched = Date.parse(asset.fxExposureUpdatedAt);
  return !(fetched > nowMs - FX_EXPOSURE_MAX_AGE_MS);
}

/** True when a stock or fund still shows its code instead of a real name. */
export function hasPlaceholderName(asset: PortfolioAsset): boolean {
  if (!['BIST', 'FOREIGN_STOCK', 'TEFAS', 'BEFAS'].includes(asset.category)) return false;
  const base = (v: string) => v.trim().toUpperCase().split('.')[0];
  return !asset.name?.trim() || base(asset.name) === base(asset.symbol);
}

const TR_SMALL_WORDS = new Set(['ve', 'ile', 'veya']);

/** "İŞ PORTFÖY YABANCI HİSSE FONU" → "İş Portföy Yabancı Hisse Fonu"; mixed-case names are kept. */
export function tidyAssetName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (n !== n.toLocaleUpperCase('tr-TR')) return n;
  return n
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map((w, i) =>
      i > 0 && TR_SMALL_WORDS.has(w) ? w : w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1)
    )
    .join(' ');
}

/** Foreign-currency share (0–100) of a fund's portfolio and the fund's name, or null if unknown. */
export async function fetchFundFxExposure(
  code: string,
  kind: 'YAT' | 'EMK'
): Promise<{ fxPct: number; name?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      `${PRICE_API_BASE}/api/fund-allocation?code=${encodeURIComponent(code.trim().toUpperCase())}&kind=${kind}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const pct = data?.fxPct;
    if (!(typeof pct === 'number' && pct >= 0 && pct <= 100)) return null;
    return { fxPct: pct, ...(typeof data.name === 'string' && data.name.trim() && { name: data.name }) };
  } catch {
    return null;
  }
}

const KNOWN_CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];

/** Converts a quote into the asset's price currency when both are known. */
export function quoteInCurrency(quote: ServerQuote, target: Currency, rates: ExchangeRates): number {
  const from = quote.currency as Currency;
  return KNOWN_CURRENCIES.includes(from) ? quote.price * crossRate(from, target, rates) : quote.price;
}

/**
 * Smart price fetcher for any asset in the portfolio
 */
export async function fetchLivePriceForAsset(
  asset: PortfolioAsset,
  rates: ExchangeRates
): Promise<{ price: number; success: boolean; name?: string }> {
  try {
    // 1. Precious Metals & Turkish Gold
    if (asset.category === 'COMMODITY' && asset.goldType) {
      const unitPrice = calculateGoldUnitPrice(
        asset.goldType,
        rates.GRAM_GOLD_TRY,
        rates.SILVER_GRAM_TRY,
        rates
      );
      if (unitPrice > 0) {
        // calculateGoldUnitPrice is TRY-based; e.g. Ons Altın is usually held in USD
        return { price: unitPrice * crossRate('TRY', asset.currentCurrency, rates), success: true };
      }
    }

    // 2. Cash Currencies (USD, EUR, GBP, TRY)
    if (asset.category === 'CASH') {
      const price = getCashUnitPrice(asset, rates);
      if (price !== null && price > 0) return { price, success: true };
    }

    // 3. BIST Stocks (THYAO -> THYAO.IS)
    if (asset.category === 'BIST') {
      const symbolWithSuffix = asset.symbol.toUpperCase().endsWith('.IS') 
        ? asset.symbol.toUpperCase() 
        : `${asset.symbol.toUpperCase()}.IS`;
      const quote = await fetchStockQuote(symbolWithSuffix);
      if (quote) return { price: quoteInCurrency(quote, asset.currentCurrency, rates), success: true, name: quote.name };
    }

    // 4. Foreign Stocks & ETFs (NVDA, VWCE.DE, CSPX.L etc.)
    if (asset.category === 'FOREIGN_STOCK') {
      const quote = await fetchStockQuote(asset.symbol);
      if (quote) return { price: quoteInCurrency(quote, asset.currentCurrency, rates), success: true, name: quote.name };
    }

    // 5. TEFAS & BEFAS Funds (Automatic Live Price Fetching)
    if (asset.category === 'TEFAS' || asset.category === 'BEFAS') {
      const fundCode = asset.symbol.trim().toUpperCase();
      const kind = asset.category === 'BEFAS' ? 'EMK' : 'YAT';

      const quote = await fetchFundQuote(fundCode, kind);
      if (quote) return { price: quoteInCurrency(quote, asset.currentCurrency, rates), success: true, name: quote.name };
    }

    // 6. Cryptocurrencies (BTC, ETH, SOL, AVAX, etc.)
    if (asset.category === 'CRYPTO') {
      const raw = asset.symbol.trim().toUpperCase().replace(/-USD$/, '');
      // "BTCUSDT" → "BTC", but "USDT" itself stays "USDT"
      const sym = raw.length > 4 ? raw.replace(/USDT$/, '') : raw;
      // Tether has no USDT pair; quote it against TRY instead
      const pair = sym === 'USDT' ? 'USDTTRY' : `${sym}USDT`;
      const pairCurrency = sym === 'USDT' ? 'TRY' : 'USD';

      // 6.1 Try Binance Public API (CORS open, real-time 24/7)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const p = parseFloat(data.price);
          if (!isNaN(p) && p > 0) {
            const finalPrice = p * crossRate(pairCurrency, asset.currentCurrency, rates);
            return { price: finalPrice, success: true };
          }
        }
      } catch {
        // Fallback to Yahoo Finance
      }

      // 6.2 Yahoo Finance fallback (BTC-USD, ETH-USD)
      const quote = await fetchStockQuote(`${sym}-USD`);
      if (quote) return { price: quoteInCurrency(quote, asset.currentCurrency, rates), success: true };
    }
  } catch (err) {
    console.warn(`Could not update price for ${asset.symbol}:`, err);
  }

  // Graceful fallback: Keep existing price
  return { price: asset.currentPrice, success: false };
}

/**
 * Batch update all assets in the portfolio
 */
export async function batchUpdatePortfolioPrices(
  assets: PortfolioAsset[],
  rates: ExchangeRates
): Promise<{ updatedAssets: PortfolioAsset[]; updatedCount: number; failedCount: number }> {
  let updatedCount = 0;
  let failedCount = 0;

  const promises = assets.map(async (asset) => {
    const skipPrice = fundPricedToday(asset);
    const [result, fx] = await Promise.all([
      skipPrice ? { price: asset.currentPrice, success: true } : fetchLivePriceForAsset(asset, rates),
      needsFxExposure(asset) || hasPlaceholderName(asset)
        ? fetchFundFxExposure(asset.symbol, asset.category === 'BEFAS' ? 'EMK' : 'YAT')
        : null,
    ]);
    // Keep the last known share when it's recent or TEFAS doesn't answer
    let next: PortfolioAsset =
      fx !== null ? { ...asset, fxExposurePct: fx.fxPct, fxExposureUpdatedAt: new Date().toISOString() } : asset;
    // Fill in the real company/fund name when only the code was entered
    const sourceName = ('name' in result && result.name) || fx?.name;
    if (sourceName && hasPlaceholderName(asset)) next = { ...next, name: tidyAssetName(sourceName) };
    if (!result.success) {
      failedCount++;
      // Keep the last known price but flag it so the UI can show it's outdated
      return { ...next, priceStale: true };
    }
    if (Math.abs(result.price - asset.currentPrice) > 0.0001) {
      updatedCount++;
    }
    if (skipPrice) return next;
    const fetchedAt = new Date().toISOString();
    return {
      ...next,
      currentPrice: Math.round(result.price * 10000) / 10000,
      lastUpdated: fetchedAt,
      priceFetchedAt: fetchedAt,
      priceStale: false,
    };
  });

  const updatedAssets = await Promise.all(promises);
  return { updatedAssets, updatedCount, failedCount };
}
