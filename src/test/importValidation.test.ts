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
