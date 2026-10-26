import { describe, expect, it } from 'vitest';
import {
  buildTrendSeries,
  calculateAssetDayChanges,
  calculateDailyChange,
  localDayKey,
  sanitizeSnapshots,
  upsertTodaySnapshot,
} from '../utils/snapshots';
import { PortfolioSnapshot } from '../types/portfolio';

const NOW = new Date(2026, 9, 24, 15, 0); // 24 Oct 2026, local time

function snap(date: string, value: number, cost: number): PortfolioSnapshot {
  return { date, timestamp: 0, totalValueTRY: value, totalValueUSD: value / 40, totalCostTRY: cost, totalCostUSD: cost / 40 };
}

const totals = (value: number, cost: number) => ({
  totalValueTRY: value,
  totalValueUSD: value / 40,
  totalCostTRY: cost,
  totalCostUSD: cost / 40,
});

describe('localDayKey', () => {
  it('formats the local date', () => {
    expect(localDayKey(NOW)).toBe('2026-10-24');
  });
});

describe('upsertTodaySnapshot', () => {
  it('adds today and keeps one snapshot per day', () => {
    let list = upsertTodaySnapshot([snap('2026-10-23', 100, 90)], totals(110, 90), NOW);
    list = upsertTodaySnapshot(list, totals(120, 90), NOW);
    expect(list.map((s) => [s.date, s.totalValueTRY])).toEqual([
      ['2026-10-23', 100],
      ['2026-10-24', 120],
    ]);
  });
});

describe('calculateDailyChange', () => {
  it('is null without an earlier day', () => {
    expect(calculateDailyChange([snap('2026-10-24', 100, 90)], totals(110, 90), NOW)).toBeNull();
  });

  it('measures profit change against the latest earlier day', () => {
    const change = calculateDailyChange(
      [snap('2026-10-20', 50, 50), snap('2026-10-22', 1000, 900), snap('2026-10-24', 0, 0)],
      totals(1050, 900),
      NOW
    );
    expect(change).toEqual({ changeTRY: 50, changeUSD: 1.25, percent: 5, sinceDate: '2026-10-22' });
  });

  it('does not count newly added assets as a gain', () => {
    // Bought 500 TRY of new assets at cost since yesterday, prices unchanged
    const change = calculateDailyChange([snap('2026-10-23', 1000, 900)], totals(1500, 1400), NOW);
    expect(change?.changeTRY).toBe(0);
  });
});

describe('buildTrendSeries', () => {
  const history = [snap('2026-01-01', 10, 10), snap('2026-10-20', 100, 90), snap('2026-10-23', 105, 90), snap('2026-10-24', 1, 1)];

  it('uses only snapshots within the range and ends with today', () => {
    const series = buildTrendSeries(history, totals(110, 90), '1W', NOW);
    expect(series.map((p) => p.valueTRY)).toEqual([100, 105, 110]);
    expect(series[series.length - 1].date).toBe('Bugün');
  });

  it('includes everything for ALL', () => {
    expect(buildTrendSeries(history, totals(110, 90), 'ALL', NOW)).toHaveLength(4);
  });

  it('is just today when there is no history', () => {
    expect(buildTrendSeries([], totals(110, 90), '1M', NOW)).toHaveLength(1);
  });
});

describe('sanitizeSnapshots', () => {
  it('drops malformed entries and sorts by date', () => {
    const result = sanitizeSnapshots([snap('2026-10-02', 1, 1), { date: 'bad' }, null, snap('2026-10-01', 1, 1)]);
    expect(result.map((s) => s.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(sanitizeSnapshots('nope')).toEqual([]);
  });
});

describe('calculateDailyChange with sales', () => {
  it('does not count selling at the current price as a loss', () => {
    // Yesterday: 10 units worth 150 each, cost 100 → profit 500 unrealized
    const yesterday = { ...snap('2026-10-23', 1500, 1000), realizedProfitTRY: 0, realizedProfitUSD: 0 };
    // Today: sold 5 at 150 → 250 realized, remaining 5 units worth 750, cost 500
    const change = calculateDailyChange([yesterday], { ...totals(750, 500), realizedProfitTRY: 250, realizedProfitUSD: 6.25 }, NOW);
    expect(change?.changeTRY).toBe(0);
  });
});

describe('calculateAssetDayChanges', () => {
  const withPrices = (date: string, prices: Record<string, number>): PortfolioSnapshot => ({
    ...snap(date, 100, 90),
    unitPricesTRY: prices,
    unitPricesUSD: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v / 40])),
  });

  it('compares each asset with the latest earlier day that has its price', () => {
    const snapshots = [
      withPrices('2026-10-21', { a: 100, b: 50 }),
      withPrices('2026-10-23', { a: 110 }),
      withPrices('2026-10-24', { a: 999, b: 999 }), // today: ignored
    ];
    const changes = calculateAssetDayChanges(snapshots, { TRY: { a: 121, b: 40, c: 5 }, USD: {} }, 'TRY', NOW);
    expect(changes.a).toBeCloseTo(0.1);
    expect(changes.b).toBeCloseTo(-0.2);
    expect(changes.c).toBeUndefined();
  });

  it('ignores snapshots recorded before prices were stored', () => {
    expect(calculateAssetDayChanges([snap('2026-10-23', 100, 90)], { TRY: { a: 1 }, USD: { a: 1 } }, 'USD', NOW)).toEqual({});
  });

  it('stores unit prices with today and keeps them through sanitizing', () => {
    const list = upsertTodaySnapshot([], totals(100, 90), NOW, { TRY: { a: 40 }, USD: { a: 1 } });
    expect(sanitizeSnapshots(JSON.parse(JSON.stringify(list)))[0]).toMatchObject({
      unitPricesTRY: { a: 40 },
      unitPricesUSD: { a: 1 },
    });
    expect(sanitizeSnapshots([{ ...list[0], unitPricesTRY: { a: 'x' } }])[0].unitPricesTRY).toBeUndefined();
  });
});
