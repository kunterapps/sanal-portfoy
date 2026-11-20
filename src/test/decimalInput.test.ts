import { describe, expect, it } from 'vitest';
import { formatDecimalInput, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';

describe('sanitizeDecimalInput', () => {
  it('keeps every step of typing 0.02 and 0,02', () => {
    for (const step of ['0', '0.', '0.0', '0.02', '0,', '0,0', '0,02']) {
      expect(sanitizeDecimalInput(step)).toBe(step);
    }
  });
  it('drops extra separators and other characters', () => {
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23');
    expect(sanitizeDecimalInput('1,2.3')).toBe('1,23');
    expect(sanitizeDecimalInput('-12a e5')).toBe('125');
  });
  it('drops separators in integer mode', () => {
    expect(sanitizeDecimalInput('3,5', true)).toBe('35');
  });
});

describe('parseDecimalInput', () => {
  it('reads both separators', () => {
    expect(parseDecimalInput('0.02')).toBe(0.02);
    expect(parseDecimalInput('0,02')).toBe(0.02);
    expect(parseDecimalInput('1234,5')).toBe(1234.5);
  });
  it('treats partial input as its value so far', () => {
    expect(parseDecimalInput('0')).toBe(0);
    expect(parseDecimalInput('0.')).toBe(0);
    expect(parseDecimalInput('0,0')).toBe(0);
    expect(parseDecimalInput(',5')).toBe(0.5);
  });
  it('returns null when there is no number', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput(',')).toBeNull();
    expect(parseDecimalInput('  ')).toBeNull();
  });
});

describe('formatDecimalInput', () => {
  it('formats outside values', () => {
    expect(formatDecimalInput(0.02)).toBe('0.02');
    expect(formatDecimalInput(10)).toBe('10');
    expect(formatDecimalInput(1e-7)).toBe('0.0000001');
  });
  it('can leave zero empty', () => {
    expect(formatDecimalInput(0)).toBe('0');
    expect(formatDecimalInput(0, true)).toBe('');
  });
});
