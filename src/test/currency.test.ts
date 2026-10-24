import { describe, expect, it } from 'vitest';
import { crossRate, detectCashCurrency, getCashUnitPrice } from '../utils/currency';
import { makeAsset, RATES } from './fixtures';

describe('detectCashCurrency', () => {
  it.each([
    [{ symbol: 'USD', name: '' }, 'USD'],
    [{ symbol: 'NAKIT', name: 'Dolar Hesabı' }, 'USD'],
    [{ symbol: 'EUR', name: '' }, 'EUR'],
    [{ symbol: 'X', name: 'Avro birikim' }, 'EUR'],
    [{ symbol: 'GBP', name: '' }, 'GBP'],
    [{ symbol: 'TL', name: '' }, 'TRY'],
    [{ symbol: 'VADELI', name: 'Türk Lirası' }, 'TRY'],
  ] as const)('%o -> %s', (asset, expected) => {
    expect(detectCashCurrency(asset)).toBe(expected);
  });

  it('returns null for unknown cash', () => {
    expect(detectCashCurrency({ symbol: 'CHF', name: 'İsviçre Frangı' })).toBeNull();
  });
});

describe('crossRate', () => {
  it('converts via TRY', () => {
    expect(crossRate('USD', 'TRY', RATES)).toBe(40);
    expect(crossRate('TRY', 'USD', RATES)).toBeCloseTo(0.025);
    expect(crossRate('EUR', 'USD', RATES)).toBeCloseTo(1.1);
    expect(crossRate('GBP', 'GBP', RATES)).toBe(1);
  });
});

describe('getCashUnitPrice', () => {
  it('prices USD cash held in TRY at the USD/TRY rate', () => {
    const asset = makeAsset({ category: 'CASH', symbol: 'USD', currentCurrency: 'TRY' });
    expect(getCashUnitPrice(asset, RATES)).toBe(40);
  });

  it('prices cash in its own currency at 1', () => {
    const asset = makeAsset({ category: 'CASH', symbol: 'EUR', currentCurrency: 'EUR' });
    expect(getCashUnitPrice(asset, RATES)).toBe(1);
  });

  it('returns null when the held currency is unknown', () => {
    const asset = makeAsset({ category: 'CASH', symbol: 'CHF', name: 'Frank', currentCurrency: 'TRY' });
    expect(getCashUnitPrice(asset, RATES)).toBeNull();
  });
});
