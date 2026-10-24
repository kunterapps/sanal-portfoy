import { ExchangeRates, PortfolioAsset } from '../types/portfolio';
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

/**
 * Fetches Yahoo Finance price via CORS proxy
 */
export async function fetchYahooQuote(symbol: string): Promise<number | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d&range=5d`;

  const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  ];

  for (const getProxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const targetUrl = getProxyUrl(yahooUrl);
      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const regularMarketPrice = result.meta?.regularMarketPrice;
      if (typeof regularMarketPrice === 'number' && regularMarketPrice > 0) {
        return regularMarketPrice;
      }

      // Check last quote close
      const closes = result.indicators?.quote?.[0]?.close;
      if (Array.isArray(closes)) {
        for (let i = closes.length - 1; i >= 0; i--) {
          if (typeof closes[i] === 'number' && closes[i] > 0) {
            return closes[i];
          }
        }
      }
    } catch {
      // Try next proxy
    }
  }

  return null;
}

/**
 * Smart price fetcher for any asset in the portfolio
 */
export async function fetchLivePriceForAsset(
  asset: PortfolioAsset,
  rates: ExchangeRates
): Promise<{ price: number; success: boolean }> {
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
      const price = await fetchYahooQuote(symbolWithSuffix);
      if (price !== null) return { price, success: true };
    }

    // 4. Foreign Stocks & ETFs (NVDA, VWCE.DE, CSPX.L etc.)
    if (asset.category === 'FOREIGN_STOCK') {
      const price = await fetchYahooQuote(asset.symbol);
      if (price !== null) return { price, success: true };
    }

    // 5. TEFAS & BEFAS Funds (Automatic Live Price Fetching)
    if (asset.category === 'TEFAS' || asset.category === 'BEFAS') {
      const fundCode = asset.symbol.trim().toUpperCase();
      const kind = asset.category === 'BEFAS' ? 'EMK' : 'YAT';

      // 5.1 Try live Fontakip / TEFAS JSON endpoint via CORS proxies
      const candidateUrls = [
        `https://fontakip.com/api/fund/${encodeURIComponent(fundCode)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(`https://www.tefas.gov.tr/api/funds?name=${fundCode}&kind=${kind}`)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://fontakip.com/api/fund/${fundCode}`)}`,
      ];

      for (const targetUrl of candidateUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(targetUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            // Handle various JSON schemas
            const livePrice = 
              typeof data?.price === 'number' ? data.price :
              typeof data?.fiyat === 'number' ? data.fiyat :
              typeof data?.fund?.current_price === 'number' ? data.fund.current_price :
              Array.isArray(data) && data[0]?.price ? data[0].price :
              Array.isArray(data?.data) && data.data[0]?.price ? data.data[0].price : null;

            if (livePrice && livePrice > 0) {
              return { price: livePrice, success: true };
            }
          }
        } catch {
          // Continue to next live candidate
        }
      }
    }

    // 6. Cryptocurrencies (BTC, ETH, SOL, AVAX, etc.)
    if (asset.category === 'CRYPTO') {
      const sym = asset.symbol.trim().toUpperCase().replace(/USDT$/, '').replace(/-USD$/, '');
      const pair = `${sym}USDT`;

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
            const finalPrice = p * crossRate('USD', asset.currentCurrency, rates);
            return { price: finalPrice, success: true };
          }
        }
      } catch {
        // Fallback to Yahoo Finance
      }

      // 6.2 Yahoo Finance fallback (BTC-USD, ETH-USD)
      const yahooPrice = await fetchYahooQuote(`${sym}-USD`);
      if (yahooPrice !== null && yahooPrice > 0) {
        const finalPrice = yahooPrice * crossRate('USD', asset.currentCurrency, rates);
        return { price: finalPrice, success: true };
      }
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
    const result = await fetchLivePriceForAsset(asset, rates);
    if (!result.success) {
      failedCount++;
      // Keep the last known price but flag it so the UI can show it's outdated
      return { ...asset, priceStale: true };
    }
    if (Math.abs(result.price - asset.currentPrice) > 0.0001) {
      updatedCount++;
    }
    return {
      ...asset,
      currentPrice: Math.round(result.price * 10000) / 10000,
      lastUpdated: new Date().toISOString(),
      priceStale: false,
    };
  });

  const updatedAssets = await Promise.all(promises);
  return { updatedAssets, updatedCount, failedCount };
}
