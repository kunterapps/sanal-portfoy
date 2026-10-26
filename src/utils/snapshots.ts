import { PortfolioSnapshot, TimeRange } from '../types/portfolio';

export const MAX_SNAPSHOTS = 3650;

export interface SnapshotTotals {
  totalValueTRY: number;
  totalValueUSD: number;
  totalCostTRY: number;
  totalCostUSD: number;
  realizedProfitTRY?: number;
  realizedProfitUSD?: number;
}

/** Unit price of each held asset, keyed by asset id */
export interface UnitPrices {
  TRY: Record<string, number>;
  USD: Record<string, number>;
}

export interface DailyChange {
  changeTRY: number;
  changeUSD: number;
  percent: number;
  /** Day key (YYYY-MM-DD) of the snapshot the change is measured against */
  sinceDate: string;
}

export interface TrendPoint {
  date: string;
  valueTRY: number;
  valueUSD: number;
  costTRY: number;
  costUSD: number;
}

const RANGE_DAYS: Record<TimeRange, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  ALL: null,
};

/** Local calendar day as YYYY-MM-DD. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Records today's portfolio value. There is one snapshot per day; later calls
 * on the same day overwrite it, so each day keeps its last known value.
 */
export function upsertTodaySnapshot(
  snapshots: PortfolioSnapshot[],
  totals: SnapshotTotals,
  now: Date = new Date(),
  unitPrices?: UnitPrices
): PortfolioSnapshot[] {
  const today = localDayKey(now);
  const snapshot: PortfolioSnapshot = {
    date: today,
    timestamp: now.getTime(),
    totalValueTRY: totals.totalValueTRY,
    totalValueUSD: totals.totalValueUSD,
    totalCostTRY: totals.totalCostTRY,
    totalCostUSD: totals.totalCostUSD,
    realizedProfitTRY: totals.realizedProfitTRY ?? 0,
    realizedProfitUSD: totals.realizedProfitUSD ?? 0,
    ...(unitPrices && { unitPricesTRY: unitPrices.TRY, unitPricesUSD: unitPrices.USD }),
  };
  const others = snapshots.filter((s) => s.date !== today);
  return [...others, snapshot].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_SNAPSHOTS);
}

/** Unrealized + realized profit; selling moves profit between the two without changing the sum. */
function totalProfit(
  s: Pick<SnapshotTotals, 'totalValueTRY' | 'totalCostTRY' | 'totalValueUSD' | 'totalCostUSD' | 'realizedProfitTRY' | 'realizedProfitUSD'>
) {
  return {
    TRY: s.totalValueTRY - s.totalCostTRY + (s.realizedProfitTRY ?? 0),
    USD: s.totalValueUSD - s.totalCostUSD + (s.realizedProfitUSD ?? 0),
  };
}

/**
 * Change since the most recent earlier day. Measured on total profit
 * (value − cost + realized), so buying, selling, adding or removing assets
 * doesn't show up as a market gain or loss.
 * Returns null until there is a snapshot from a previous day.
 */
export function calculateDailyChange(
  snapshots: PortfolioSnapshot[],
  totals: SnapshotTotals,
  now: Date = new Date()
): DailyChange | null {
  const today = localDayKey(now);
  const previous = [...snapshots].reverse().find((s) => s.date < today);
  if (!previous) return null;

  const current = totalProfit(totals);
  const prev = totalProfit(previous);
  const changeTRY = current.TRY - prev.TRY;
  const changeUSD = current.USD - prev.USD;
  const percent = previous.totalValueTRY > 0 ? (changeTRY / previous.totalValueTRY) * 100 : 0;

  return { changeTRY, changeUSD, percent, sinceDate: previous.date };
}

/**
 * Price change of each asset since the most recent earlier day that recorded
 * its price, as a fraction (0.012 = +1.2%) in the given currency. Uses unit
 * prices, so buying or selling doesn't count as a change. Assets with no
 * earlier price are left out.
 */
export function calculateAssetDayChanges(
  snapshots: PortfolioSnapshot[],
  current: UnitPrices,
  currency: 'TRY' | 'USD',
  now: Date = new Date()
): Record<string, number> {
  const today = localDayKey(now);
  const prices = current[currency];
  const result: Record<string, number> = {};
  const pending = new Set(Object.keys(prices));
  for (let i = snapshots.length - 1; i >= 0 && pending.size > 0; i--) {
    const s = snapshots[i];
    if (s.date >= today) continue;
    const past = currency === 'TRY' ? s.unitPricesTRY : s.unitPricesUSD;
    if (!past) continue;
    for (const id of [...pending]) {
      const before = past[id];
      if (before > 0) {
        result[id] = prices[id] / before - 1;
        pending.delete(id);
      }
    }
  }
  return result;
}

/** Chart series from recorded snapshots in the range, ending with today's live value. */
export function buildTrendSeries(
  snapshots: PortfolioSnapshot[],
  totals: SnapshotTotals,
  range: TimeRange,
  now: Date = new Date()
): TrendPoint[] {
  const today = localDayKey(now);
  const days = RANGE_DAYS[range];
  const from = days === null ? '' : localDayKey(new Date(now.getTime() - days * 86400000));

  const past = snapshots.filter((s) => s.date < today && s.date >= from);
  const spansYears = past.length > 0 && past[0].date.slice(0, 4) !== today.slice(0, 4);

  const points: TrendPoint[] = past.map((s) => {
    const [y, m, d] = s.date.split('-').map(Number);
    return {
      date: new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: spansYears ? '2-digit' : undefined,
      }),
      valueTRY: s.totalValueTRY,
      valueUSD: s.totalValueUSD,
      costTRY: s.totalCostTRY,
      costUSD: s.totalCostUSD,
    };
  });

  points.push({
    date: 'Bugün',
    valueTRY: totals.totalValueTRY,
    valueUSD: totals.totalValueUSD,
    costTRY: totals.totalCostTRY,
    costUSD: totals.totalCostUSD,
  });

  return points;
}

function isPriceMap(v: unknown): v is Record<string, number> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** Keeps only well-formed snapshots (used when loading storage or a backup). */
export function sanitizeSnapshots(value: unknown): PortfolioSnapshot[] {
  if (!Array.isArray(value)) return [];
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return value
    .filter(
      (s): s is PortfolioSnapshot =>
        !!s &&
        typeof s === 'object' &&
        typeof s.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        isNum(s.timestamp) &&
        isNum(s.totalValueTRY) &&
        isNum(s.totalValueUSD) &&
        isNum(s.totalCostTRY) &&
        isNum(s.totalCostUSD)
    )
    .map((s) => ({
      date: s.date,
      timestamp: s.timestamp,
      totalValueTRY: s.totalValueTRY,
      totalValueUSD: s.totalValueUSD,
      totalCostTRY: s.totalCostTRY,
      totalCostUSD: s.totalCostUSD,
      ...(isNum(s.realizedProfitTRY) && { realizedProfitTRY: s.realizedProfitTRY }),
      ...(isNum(s.realizedProfitUSD) && { realizedProfitUSD: s.realizedProfitUSD }),
      ...(isPriceMap(s.unitPricesTRY) && { unitPricesTRY: s.unitPricesTRY }),
      ...(isPriceMap(s.unitPricesUSD) && { unitPricesUSD: s.unitPricesUSD }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SNAPSHOTS);
}
