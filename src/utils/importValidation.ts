import { AssetCategory, AssetTransaction, Currency, GoldType, PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';
import { TURKISH_GOLD_DEFINITIONS } from './goldCalculations';
import { sanitizeSnapshots } from './snapshots';
import { applyTransactions, ensureTransactions, TransactionError } from './transactions';

const CATEGORIES: AssetCategory[] = ['FOREIGN_STOCK', 'BIST', 'TEFAS', 'BEFAS', 'COMMODITY', 'CASH', 'CRYPTO'];
const CURRENCIES: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];

export interface ImportResult {
  assets: PortfolioAsset[];
  snapshots: PortfolioSnapshot[];
  errors: string[];
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function parseTransactions(value: unknown): AssetTransaction[] | null {
  if (!Array.isArray(value)) return null;
  const result: AssetTransaction[] = [];
  for (const [i, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object') return null;
    const t = raw as Record<string, unknown>;
    if (t.type !== 'BUY' && t.type !== 'SELL') return null;
    if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return null;
    if (!isFiniteNonNegative(t.quantity) || t.quantity === 0 || !isFiniteNonNegative(t.price)) return null;
    if (t.fee !== undefined && !isFiniteNonNegative(t.fee)) return null;
    result.push({
      id: typeof t.id === 'string' && t.id ? t.id : `tx_import_${i}_${Math.random().toString(36).slice(2, 8)}`,
      type: t.type,
      date: t.date,
      quantity: t.quantity,
      price: t.price,
      ...(typeof t.fee === 'number' && t.fee > 0 && { fee: t.fee }),
      ...(typeof t.notes === 'string' && t.notes && { notes: t.notes }),
      createdAt: typeof t.createdAt === 'number' && Number.isFinite(t.createdAt) ? t.createdAt : i,
    });
  }
  return result;
}

/**
 * Validates a parsed backup file (either a bare asset array or the
 * `{ assets: [...] }` export format). Invalid rows are skipped and reported.
 */
export function parsePortfolioBackup(parsed: unknown): ImportResult {
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { assets?: unknown }).assets)
      ? (parsed as { assets: unknown[] }).assets
      : null;

  if (!rows) {
    return { assets: [], snapshots: [], errors: ['Dosya bir portföy yedeği değil.'] };
  }

  const assets: PortfolioAsset[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row, i) => {
    const label = `${i + 1}. satır`;
    if (!row || typeof row !== 'object') {
      errors.push(`${label}: geçersiz kayıt`);
      return;
    }
    const r = row as Record<string, unknown>;

    if (typeof r.symbol !== 'string' || !r.symbol.trim()) {
      errors.push(`${label}: sembol eksik`);
      return;
    }
    if (!CATEGORIES.includes(r.category as AssetCategory)) {
      errors.push(`${label} (${r.symbol}): bilinmeyen kategori`);
      return;
    }
    if (!CURRENCIES.includes(r.costCurrency as Currency) || !CURRENCIES.includes(r.currentCurrency as Currency)) {
      errors.push(`${label} (${r.symbol}): bilinmeyen para birimi`);
      return;
    }
    if (!isFiniteNonNegative(r.quantity) || !isFiniteNonNegative(r.costPrice) || !isFiniteNonNegative(r.currentPrice)) {
      errors.push(`${label} (${r.symbol}): adet veya fiyat geçersiz`);
      return;
    }
    if (r.goldType !== undefined && !(typeof r.goldType === 'string' && r.goldType in TURKISH_GOLD_DEFINITIONS)) {
      errors.push(`${label} (${r.symbol}): bilinmeyen altın türü`);
      return;
    }

    let id = typeof r.id === 'string' && r.id ? r.id : '';
    if (!id || seenIds.has(id)) {
      id = `asset_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
    }
    seenIds.add(id);

    const base: PortfolioAsset = {
      id,
      category: r.category as AssetCategory,
      symbol: r.symbol.trim(),
      name: typeof r.name === 'string' ? r.name : r.symbol.trim(),
      quantity: r.quantity,
      costPrice: r.costPrice,
      costCurrency: r.costCurrency as Currency,
      currentPrice: r.currentPrice,
      currentCurrency: r.currentCurrency as Currency,
      lastUpdated: typeof r.lastUpdated === 'string' ? r.lastUpdated : new Date().toISOString(),
      ...(r.goldType !== undefined && { goldType: r.goldType as GoldType }),
      ...(typeof r.notes === 'string' && { notes: r.notes }),
      ...(typeof r.purchaseDate === 'string' && { purchaseDate: r.purchaseDate }),
      ...(r.priceStale === true && { priceStale: true }),
      ...(typeof r.fxExposurePct === 'number' &&
        r.fxExposurePct >= 0 &&
        r.fxExposurePct <= 100 && { fxExposurePct: r.fxExposurePct }),
    };

    if (r.transactions !== undefined && (!Array.isArray(r.transactions) || r.transactions.length > 0)) {
      const transactions = parseTransactions(r.transactions);
      if (!transactions) {
        errors.push(`${label} (${r.symbol}): işlem geçmişi geçersiz`);
        return;
      }
      try {
        assets.push(applyTransactions(base, transactions));
      } catch (e) {
        if (!(e instanceof TransactionError)) throw e;
        errors.push(`${label} (${r.symbol}): ${e.message}`);
      }
      return;
    }

    assets.push(ensureTransactions(base));
  });

  const snapshots =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? sanitizeSnapshots((parsed as { snapshots?: unknown }).snapshots)
      : [];

  return { assets, snapshots, errors };
}
