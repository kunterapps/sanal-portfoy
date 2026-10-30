import { PortfolioAsset, TimeDeposit } from '../types/portfolio';

export const DEPOSIT_TERM_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: 'Günlük' },
  { days: 32, label: '32 gün' },
  { days: 46, label: '46 gün' },
  { days: 92, label: '92 gün' },
  { days: 181, label: '181 gün' },
  { days: 365, label: '1 yıl' },
];

/** Stopaj on TL deposits up to 6 months; editable per deposit because it changes by decree. */
export const DEFAULT_WITHHOLDING_PCT = 17.5;

const DAY_MS = 86_400_000;

function parseDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDay(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in local time. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function termLabel(termDays: number): string {
  return DEPOSIT_TERM_OPTIONS.find((o) => o.days === termDays)?.label ?? `${termDays} gün`;
}

export interface DepositStatus {
  /** Value of 1 TL deposited on startDate, after stopaj */
  factor: number;
  daysElapsed: number;
  /** Start of the running term (equals startDate until the first renewal) */
  termStart: string;
  /** End of the running term; null for daily deposits */
  maturityDate: string | null;
  daysToMaturity: number | null;
  /** Past maturity without auto-renew: no more interest accrues */
  matured: boolean;
  /** Value of 1 TL of the original principal at the start of the running term */
  termStartFactor: number;
  /** Net interest the running term pays at maturity, per 1 TL of the original principal */
  termNetInterest: number;
}

/**
 * Banks in Turkey compute TL deposit interest on a 365-day year:
 * interest = principal × rate × days / 365, minus stopaj. Daily accounts
 * compound every day. Term deposits accrue linearly inside a term and,
 * when auto-renewed, roll principal + net interest into the next term at
 * the same rate. Interest accrued mid-term is shown as earned, although a
 * bank pays it only if the deposit is held to maturity.
 */
export function getDepositStatus(deposit: TimeDeposit, today: string = localToday()): DepositStatus {
  const start = parseDay(deposit.startDate);
  const daysElapsed = Math.max(0, Math.round((parseDay(today) - start) / DAY_MS));
  const netRate = (deposit.annualRatePct / 100) * (1 - deposit.withholdingPct / 100);

  if (deposit.termDays <= 1) {
    const daily = netRate / 365;
    return {
      factor: Math.pow(1 + daily, daysElapsed),
      daysElapsed,
      termStart: deposit.startDate,
      maturityDate: null,
      daysToMaturity: null,
      matured: false,
      termStartFactor: 1,
      termNetInterest: daily,
    };
  }

  const term = deposit.termDays;
  const perTerm = (netRate * term) / 365;
  let completed = Math.floor(daysElapsed / term);
  let matured = false;
  if (!deposit.autoRenew && completed >= 1) {
    completed = 1;
    matured = true;
  }
  const inTerm = matured ? 0 : daysElapsed - completed * term;
  const termBase = Math.pow(1 + perTerm, completed);
  const termStartMs = start + completed * term * DAY_MS;
  const maturityMs = matured ? start + term * DAY_MS : termStartMs + term * DAY_MS;

  return {
    factor: termBase * (1 + (netRate * inTerm) / 365),
    daysElapsed,
    termStart: formatDay(matured ? start : termStartMs),
    maturityDate: formatDay(maturityMs),
    daysToMaturity: matured ? 0 : term - inTerm,
    matured,
    termStartFactor: termBase,
    termNetInterest: termBase * perTerm,
  };
}

/** Deposit assets get their price from the calendar, not from a market feed. */
export function withDepositPrice(asset: PortfolioAsset, today: string = localToday()): PortfolioAsset {
  if (!asset.deposit) return asset;
  const factor = getDepositStatus(asset.deposit, today).factor;
  if (Math.abs(factor - asset.currentPrice) < 1e-12) return asset;
  return { ...asset, currentPrice: factor, lastUpdated: new Date().toISOString(), priceStale: false };
}

const SHORT_DATE = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Subtitle for lists, e.g. "32 gün · 3 gün kaldı". */
export function describeDeposit(deposit: TimeDeposit, today: string = localToday()): string {
  const s = getDepositStatus(deposit, today);
  if (s.maturityDate === null) return 'Günlük faiz';
  if (s.matured) return `${termLabel(deposit.termDays)} · vadesi doldu`;
  return `${termLabel(deposit.termDays)} · ${s.daysToMaturity} gün kaldı`;
}

export function depositRateLabel(deposit: TimeDeposit): string {
  return `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(deposit.annualRatePct)}`;
}

/** "vade 2 Kas", or "her gün" for daily accounts. */
export function depositDueLabel(deposit: TimeDeposit, today: string = localToday()): string {
  const s = getDepositStatus(deposit, today);
  if (s.maturityDate === null) return 'her gün';
  return `vade ${SHORT_DATE.format(new Date(parseDay(s.maturityDate)))}`;
}

export function isValidDeposit(value: unknown): value is TimeDeposit {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  return (
    typeof d.startDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.startDate) &&
    num(d.annualRatePct) &&
    num(d.termDays) &&
    (d.termDays as number) >= 1 &&
    num(d.withholdingPct) &&
    (d.withholdingPct as number) <= 100 &&
    typeof d.autoRenew === 'boolean'
  );
}
