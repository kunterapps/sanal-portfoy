import { describe, expect, it } from 'vitest';
import { TimeDeposit } from '../types/portfolio';
import { depositDueLabel, describeDeposit, getDepositStatus, isValidDeposit } from '../utils/deposit';

const base: TimeDeposit = {
  startDate: '2026-10-01',
  annualRatePct: 40,
  termDays: 32,
  withholdingPct: 17.5,
  autoRenew: true,
};
const perTerm = (0.4 * 0.825 * 32) / 365;

describe('getDepositStatus', () => {
  it('accrues linearly inside the first term, after stopaj', () => {
    const s = getDepositStatus(base, '2026-10-17');
    expect(s.daysElapsed).toBe(16);
    expect(s.factor).toBeCloseTo(1 + (0.4 * 0.825 * 16) / 365, 10);
    expect(s.maturityDate).toBe('2026-11-02');
    expect(s.daysToMaturity).toBe(16);
    expect(s.termNetInterest).toBeCloseTo(perTerm, 10);
  });

  it('pays the full net interest on the maturity day and rolls over with interest', () => {
    expect(getDepositStatus(base, '2026-11-02').factor).toBeCloseTo(1 + perTerm, 10);
    const s = getDepositStatus(base, '2026-11-12');
    expect(s.termStart).toBe('2026-11-02');
    expect(s.maturityDate).toBe('2026-12-04');
    expect(s.factor).toBeCloseTo((1 + perTerm) * (1 + (0.4 * 0.825 * 10) / 365), 10);
  });

  it('stops earning after maturity when not renewed', () => {
    const s = getDepositStatus({ ...base, autoRenew: false }, '2026-12-20');
    expect(s.matured).toBe(true);
    expect(s.factor).toBeCloseTo(1 + perTerm, 10);
    expect(s.maturityDate).toBe('2026-11-02');
  });

  it('compounds daily accounts every day', () => {
    const s = getDepositStatus({ ...base, termDays: 1 }, '2026-10-31');
    expect(s.factor).toBeCloseTo(Math.pow(1 + (0.4 * 0.825) / 365, 30), 10);
    expect(s.maturityDate).toBeNull();
  });

  it('is worth the principal before or on the start day', () => {
    expect(getDepositStatus(base, '2026-10-01').factor).toBe(1);
    expect(getDepositStatus(base, '2026-09-20').factor).toBe(1);
  });
});

describe('describeDeposit', () => {
  it('summarizes rate, term and days to maturity', () => {
    expect(describeDeposit(base, '2026-10-30')).toBe('32 gün · 3 gün kaldı');
    expect(depositDueLabel(base, '2026-10-30')).toBe('vade 2 Kas');
    expect(describeDeposit({ ...base, autoRenew: false }, '2026-11-20')).toBe('32 gün · vadesi doldu');
    expect(describeDeposit({ ...base, termDays: 1 }, '2026-10-30')).toBe('Günlük faiz');
  });
});

describe('isValidDeposit', () => {
  it('accepts a well-formed deposit and rejects broken ones', () => {
    expect(isValidDeposit(base)).toBe(true);
    expect(isValidDeposit({ ...base, startDate: '1.10.2026' })).toBe(false);
    expect(isValidDeposit({ ...base, termDays: 0 })).toBe(false);
    expect(isValidDeposit({ ...base, autoRenew: 'yes' })).toBe(false);
  });
});
