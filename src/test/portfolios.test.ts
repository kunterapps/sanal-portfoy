import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORTFOLIO_ID,
  createPortfolio,
  deletePortfolioData,
  loadActivePortfolioId,
  loadPortfolioList,
  portfolioStorageKeys,
  sanitizePortfolioList,
  savePortfolioList,
  uniquePortfolioName,
} from '../utils/portfolios';
import { memoryStorage } from './memoryStorage';

describe('portfolios', () => {
  it('keeps the original storage keys for the first portfolio', () => {
    expect(portfolioStorageKeys(DEFAULT_PORTFOLIO_ID)).toEqual({
      assets: 'my_personal_portfolio_assets',
      snapshots: 'my_personal_portfolio_snapshots',
    });
    expect(portfolioStorageKeys('p_abc').assets).toBe('my_personal_portfolio_assets__p_abc');
  });

  it('starts with one default portfolio when nothing is stored', () => {
    const list = loadPortfolioList(memoryStorage());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: DEFAULT_PORTFOLIO_ID, name: 'Ana Portföy' });
  });

  it('drops malformed and duplicate entries', () => {
    const list = sanitizePortfolioList([
      { id: 'default', name: '  Emeklilik   ' },
      { id: 'default', name: 'Kopya' },
      { id: '../bad', name: 'X' },
      null,
      { id: 'p_1', name: '' },
    ]);
    expect(list.map((p) => [p.id, p.name])).toEqual([
      ['default', 'Emeklilik'],
      ['p_1', 'Ana Portföy'],
    ]);
  });

  it('round-trips the list and falls back to the first portfolio for an unknown active id', () => {
    const storage = memoryStorage({ my_personal_portfolio_active: 'gone' });
    const created = createPortfolio('Çocuklar', loadPortfolioList(storage));
    savePortfolioList([...loadPortfolioList(storage), created], storage);
    const list = loadPortfolioList(storage);
    expect(list.map((p) => p.name)).toEqual(['Ana Portföy', 'Çocuklar']);
    expect(loadActivePortfolioId(list, storage)).toBe(DEFAULT_PORTFOLIO_ID);
    storage.setItem('my_personal_portfolio_active', created.id);
    expect(loadActivePortfolioId(list, storage)).toBe(created.id);
  });

  it('numbers duplicate names', () => {
    const list = sanitizePortfolioList([{ id: 'a', name: 'Yeni Portföy' }, { id: 'b', name: 'yeni portföy 2' }]);
    expect(uniquePortfolioName('Yeni Portföy', list)).toBe('Yeni Portföy 3');
    expect(uniquePortfolioName('Başka', list)).toBe('Başka');
  });

  it('deletes only that portfolio’s data', () => {
    const storage = memoryStorage({
      my_personal_portfolio_assets: '[1]',
      my_personal_portfolio_assets__p_x: '[2]',
      my_personal_portfolio_snapshots__p_x: '[]',
    });
    deletePortfolioData('p_x', storage);
    expect(storage.getItem('my_personal_portfolio_assets')).toBe('[1]');
    expect(storage.getItem('my_personal_portfolio_assets__p_x')).toBeNull();
    expect(storage.getItem('my_personal_portfolio_snapshots__p_x')).toBeNull();
  });
});
