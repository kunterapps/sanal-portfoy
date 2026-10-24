import { describe, expect, it } from 'vitest';
import { AssetTransaction } from '../types/portfolio';
import {
  applyTransactions,
  computePosition,
  ensureTransactions,
  isClosedPosition,
  TransactionError,
} from '../utils/transactions';
import { calculatePortfolioTotals } from '../utils/portfolioCalculations';
import { makeAsset, RATES } from './fixtures';

let seq = 0;
function tx(type: 'BUY' | 'SELL', date: string, quantity: number, price: number, fee?: number): AssetTransaction {
  return { id: `t${++seq}`, type, date, quantity, price, fee, createdAt: seq };
}

describe('computePosition', () => {
  it('uses the weighted average cost on buys', () => {
    const p = computePosition([tx('BUY', '2026-01-01', 10, 100), tx('BUY', '2026-02-01', 30, 120)]);
    expect(p.quantity).toBe(40);
    expect(p.averageCost).toBe(115);
    expect(p.realizedProfit).toBe(0);
  });

  it('includes buy commission in the average cost', () => {
    const p = computePosition([tx('BUY', '2026-01-01', 10, 100, 20)]);
    expect(p.averageCost).toBe(102);
  });

  it('keeps the average cost on sells and books realized profit', () => {
    const p = computePosition([
      tx('BUY', '2026-01-01', 10, 100),
      tx('BUY', '2026-02-01', 10, 200),
      tx('SELL', '2026-03-01', 5, 180, 10),
    ]);
    expect(p.quantity).toBe(15);
    expect(p.averageCost).toBe(150);
    expect(p.realizedProfit).toBe(5 * (180 - 150) - 10);
  });

  it('books a realized loss', () => {
    const p = computePosition([tx('BUY', '2026-01-01', 10, 100), tx('SELL', '2026-01-02', 10, 80)]);
    expect(p.quantity).toBe(0);
    expect(p.realizedProfit).toBe(-200);
  });

  it('orders by date regardless of entry order', () => {
    const p = computePosition([tx('SELL', '2026-03-01', 5, 150), tx('BUY', '2026-01-01', 10, 100)]);
    expect(p.quantity).toBe(5);
    expect(p.realizedProfit).toBe(250);
  });

  it('rejects selling more than held at that date', () => {
    expect(() =>
      computePosition([tx('BUY', '2026-02-01', 10, 100), tx('SELL', '2026-01-15', 5, 100)])
    ).toThrow(TransactionError);
    expect(() => computePosition([tx('BUY', '2026-01-01', 10, 100), tx('SELL', '2026-01-02', 11, 100)])).toThrow(
      TransactionError
    );
  });

  it('tolerates floating point when selling everything', () => {
    const p = computePosition([
      tx('BUY', '2026-01-01', 0.1, 100),
      tx('BUY', '2026-01-01', 0.2, 100),
      tx('SELL', '2026-01-02', 0.3, 100),
    ]);
    expect(p.quantity).toBe(0);
  });
});

describe('ensureTransactions', () => {
  it('turns an existing asset into an opening buy without changing it', () => {
    const asset = makeAsset({ quantity: 12, costPrice: 50, purchaseDate: '2025-05-05' });
    const migrated = ensureTransactions(asset);
    expect(migrated.transactions).toHaveLength(1);
    expect(migrated.transactions![0]).toMatchObject({ type: 'BUY', quantity: 12, price: 50, date: '2025-05-05' });
    const reapplied = applyTransactions(migrated, migrated.transactions!);
    expect(reapplied.quantity).toBe(12);
    expect(reapplied.costPrice).toBe(50);
  });

  it('leaves assets that already have transactions alone', () => {
    const asset = makeAsset({ transactions: [tx('BUY', '2026-01-01', 1, 1)] });
    expect(ensureTransactions(asset)).toBe(asset);
  });
});

describe('applyTransactions', () => {
  it('updates quantity, average cost and realized profit, and marks closed positions', () => {
    const base = ensureTransactions(makeAsset({ quantity: 10, costPrice: 100, currentPrice: 150 }));
    const sold = applyTransactions(base, [...base.transactions!, tx('SELL', '2099-01-01', 10, 150)]);
    expect(sold.quantity).toBe(0);
    expect(sold.realizedProfit).toBe(500);
    expect(isClosedPosition(sold)).toBe(true);
  });

  it('feeds realized profit into portfolio totals', () => {
    const usdAsset = applyTransactions(makeAsset({ costCurrency: 'USD', currentCurrency: 'USD', currentPrice: 12 }), [
      tx('BUY', '2026-01-01', 10, 10),
      tx('SELL', '2026-01-02', 5, 12),
    ]);
    const totals = calculatePortfolioTotals([usdAsset], RATES);
    expect(totals.realizedProfitUSD).toBe(10);
    expect(totals.realizedProfitTRY).toBe(400);
    expect(totals.totalCostUSD).toBe(50);
    expect(totals.assetCount).toBe(1);
  });
});
