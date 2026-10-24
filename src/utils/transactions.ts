import { AssetTransaction, PortfolioAsset, TransactionType } from '../types/portfolio';
import { localDayKey } from './snapshots';

const EPSILON = 1e-9;

export interface PositionState {
  quantity: number;
  /** Weighted average unit cost in the asset's costCurrency */
  averageCost: number;
  /** Realized profit/loss from sales, in the asset's costCurrency */
  realizedProfit: number;
}

export class TransactionError extends Error {}

/** Oldest first; same-day transactions keep the order they were entered. */
export function sortTransactions(transactions: AssetTransaction[]): AssetTransaction[] {
  return transactions
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.t.createdAt - b.t.createdAt || a.i - b.i)
    .map(({ t }) => t);
}

/**
 * Replays transactions with the weighted-average cost method:
 * - BUY: quantity grows, average cost = (old cost + bought amount + fee) / new quantity
 * - SELL: quantity shrinks, average cost stays; realized P/L = qty × (price − avg) − fee
 * Throws TransactionError if a sale exceeds the quantity held at that point.
 */
export function computePosition(transactions: AssetTransaction[]): PositionState {
  let quantity = 0;
  let averageCost = 0;
  let realizedProfit = 0;

  for (const t of sortTransactions(transactions)) {
    const fee = t.fee || 0;
    if (t.type === 'BUY') {
      const newQuantity = quantity + t.quantity;
      averageCost = newQuantity > 0 ? (quantity * averageCost + t.quantity * t.price + fee) / newQuantity : 0;
      quantity = newQuantity;
    } else {
      if (t.quantity > quantity + EPSILON) {
        throw new TransactionError(
          `${t.date} tarihli satış (${t.quantity}), o tarihte eldeki miktarı (${roundQty(quantity)}) aşıyor.`
        );
      }
      realizedProfit += t.quantity * (t.price - averageCost) - fee;
      quantity = Math.max(0, quantity - t.quantity);
      if (quantity < EPSILON) quantity = 0;
    }
  }

  return { quantity, averageCost, realizedProfit };
}

function roundQty(q: number): number {
  return Math.round(q * 1e6) / 1e6;
}

/** Returns the asset with quantity / costPrice / realizedProfit recomputed from its transactions. */
export function applyTransactions(asset: PortfolioAsset, transactions: AssetTransaction[]): PortfolioAsset {
  const sorted = sortTransactions(transactions);
  const position = computePosition(sorted);
  return {
    ...asset,
    transactions: sorted,
    quantity: position.quantity,
    costPrice: position.averageCost,
    realizedProfit: position.realizedProfit,
  };
}

export function createTransaction(
  type: TransactionType,
  fields: { date: string; quantity: number; price: number; fee?: number; notes?: string }
): AssetTransaction {
  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    date: fields.date,
    quantity: fields.quantity,
    price: fields.price,
    ...(fields.fee ? { fee: fields.fee } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    createdAt: Date.now(),
  };
}

/**
 * Gives assets created before transactions existed an opening BUY that
 * reproduces their current quantity and cost, so no data is lost.
 */
export function ensureTransactions(asset: PortfolioAsset): PortfolioAsset {
  if (asset.transactions && asset.transactions.length > 0) return asset;
  if (asset.quantity <= 0) return { ...asset, transactions: [], realizedProfit: asset.realizedProfit ?? 0 };

  const dateSource = asset.purchaseDate || asset.lastUpdated;
  const parsed = dateSource ? new Date(dateSource) : new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateSource || '')
    ? (dateSource as string)
    : localDayKey(isNaN(parsed.getTime()) ? new Date() : parsed);

  const opening: AssetTransaction = {
    id: `tx_open_${asset.id}`,
    type: 'BUY',
    date,
    quantity: asset.quantity,
    price: asset.costPrice,
    notes: 'Açılış kaydı',
    createdAt: 0,
  };
  return { ...asset, transactions: [opening], realizedProfit: asset.realizedProfit ?? 0 };
}

export function isClosedPosition(asset: PortfolioAsset): boolean {
  return asset.quantity <= 0 && (asset.transactions?.length ?? 0) > 0;
}
