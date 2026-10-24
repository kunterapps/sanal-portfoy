import { describe, expect, it } from 'vitest';
import { parsePortfolioBackup } from '../utils/importValidation';
import { makeAsset } from './fixtures';

describe('parsePortfolioBackup', () => {
  it('accepts a bare array and the export format', () => {
    expect(parsePortfolioBackup([makeAsset()]).assets).toHaveLength(1);
    expect(parsePortfolioBackup({ app: 'x', assets: [makeAsset()] }).assets).toHaveLength(1);
  });

  it('rejects non-backup content', () => {
    const r = parsePortfolioBackup({ foo: 1 });
    expect(r.assets).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });

  it('skips invalid rows and reports why', () => {
    const r = parsePortfolioBackup([
      makeAsset({ id: 'ok' }),
      { ...makeAsset(), category: 'STOCK' },
      { ...makeAsset(), quantity: '10' },
      { ...makeAsset(), costCurrency: 'JPY' },
      { ...makeAsset(), symbol: '' },
      null,
    ]);
    expect(r.assets.map((a) => a.id)).toEqual(['ok']);
    expect(r.errors).toHaveLength(5);
  });

  it('assigns fresh ids to duplicate or missing ids', () => {
    const { id: _omit, ...noId } = makeAsset();
    const r = parsePortfolioBackup([makeAsset({ id: 'x' }), makeAsset({ id: 'x' }), noId]);
    const ids = r.assets.map((a) => a.id);
    expect(ids[0]).toBe('x');
    expect(new Set(ids).size).toBe(3);
  });

  it('drops unknown fields', () => {
    const r = parsePortfolioBackup([{ ...makeAsset(), evil: '<script>' }]);
    expect(r.assets[0]).not.toHaveProperty('evil');
  });
});

describe('parsePortfolioBackup transactions', () => {
  it('migrates assets without transactions to an opening buy', () => {
    const r = parsePortfolioBackup([makeAsset({ quantity: 3, costPrice: 7 })]);
    expect(r.assets[0].transactions).toHaveLength(1);
    expect(r.assets[0].quantity).toBe(3);
  });

  it('recomputes quantity and cost from imported transactions', () => {
    const r = parsePortfolioBackup([
      {
        ...makeAsset({ quantity: 999, costPrice: 999 }),
        transactions: [
          { id: 'a', type: 'BUY', date: '2026-01-01', quantity: 10, price: 100, createdAt: 1 },
          { id: 'b', type: 'SELL', date: '2026-01-02', quantity: 4, price: 120, createdAt: 2 },
        ],
      },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.assets[0]).toMatchObject({ quantity: 6, costPrice: 100, realizedProfit: 80 });
  });

  it('rejects invalid transaction histories', () => {
    const r = parsePortfolioBackup([
      { ...makeAsset(), transactions: [{ type: 'BUY', date: 'yesterday', quantity: 1, price: 1 }] },
      { ...makeAsset(), transactions: [{ type: 'SELL', date: '2026-01-01', quantity: 1, price: 1 }] },
    ]);
    expect(r.assets).toHaveLength(0);
    expect(r.errors).toHaveLength(2);
  });
});
