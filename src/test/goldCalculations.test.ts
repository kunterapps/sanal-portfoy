import { describe, expect, it } from 'vitest';
import { calculateGoldUnitPrice, getAssetDisplay } from '../utils/goldCalculations';
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

  it('estimates ALTIN.S1 as a hundredth of gram gold', () => {
    expect(calculateGoldUnitPrice('ALTIN_S1', 4000, 50, RATES)).toBe(40);
  });
});

describe('getAssetDisplay', () => {
  it('shows a readable name for gold instead of its type code', () => {
    const gold = { category: 'COMMODITY' as const, goldType: 'ATA_CUMHURIYET' as const, symbol: 'ATA_CUMHURIYET', name: 'Cumhuriyet / Ata Altını' };
    expect(getAssetDisplay(gold)).toEqual({ title: 'Ata Altın', subtitle: 'Cumhuriyet · adet' });
  });

  it("keeps the user's own name as the subtitle", () => {
    const gold = { category: 'COMMODITY' as const, goldType: 'BILEZIK_22' as const, symbol: 'BILEZIK_22', name: 'Düğün bilezikleri' };
    expect(getAssetDisplay(gold)).toEqual({ title: '22 Ayar Bilezik', subtitle: 'Düğün bilezikleri' });
  });

  it('leaves other assets as symbol and name', () => {
    expect(getAssetDisplay({ category: 'BIST', symbol: 'THYAO', name: 'Türk Hava Yolları' })).toEqual({
      title: 'THYAO',
      subtitle: 'Türk Hava Yolları',
    });
  });
});
