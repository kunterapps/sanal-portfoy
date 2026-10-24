import { describe, expect, it } from 'vitest';
import { calculateGoldUnitPrice } from '../utils/goldCalculations';
import { RATES } from './fixtures';

describe('calculateGoldUnitPrice', () => {
  it('prefers live market prices when available', () => {
    expect(calculateGoldUnitPrice('CEYREK', 4000, 50, { ...RATES, CEYREK_GOLD_TRY: 6700 })).toBe(6700);
    expect(calculateGoldUnitPrice('GRAM_24', 4000, 50, RATES)).toBe(4000);
  });

  it('derives Ons Altın in TRY from ons USD price', () => {
    expect(calculateGoldUnitPrice('ONS_GOLD', 4000, 50, RATES)).toBe(3110 * 40);
  });

  it('falls back to weight × purity × premium without a live price', () => {
    // 1.754g × 0.916 × 4000 × 1.035
    expect(calculateGoldUnitPrice('CEYREK', 4000, 50)).toBeCloseTo(6651.6, 1);
  });
});
