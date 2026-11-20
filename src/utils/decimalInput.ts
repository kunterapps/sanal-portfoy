/**
 * Helpers for decimal text inputs. Inputs keep the raw text while the user
 * types, so "0", "0." and "0,0" survive on the way to "0,02". Both '.' and ','
 * are accepted as the decimal separator.
 */

/**
 * Keeps only what can be part of a decimal number: digits and a single
 * separator ('.' or ','). Extra separators and other characters are dropped.
 * With `integer`, separators are dropped too.
 */
export function sanitizeDecimalInput(raw: string, integer = false): string {
  let out = '';
  let seenSep = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if ((ch === '.' || ch === ',') && !integer && !seenSep) {
      out += ch;
      seenSep = true;
    }
  }
  return out;
}

/**
 * Parses the raw text into a number. Returns null when there is no number yet
 * ("" or a lone separator). "0." / "0," parse as 0, ",5" as 0.5.
 */
export function parseDecimalInput(raw: string): number | null {
  const s = sanitizeDecimalInput(raw.trim()).replace(',', '.');
  if (s === '' || s === '.') return null;
  const n = Number(s.startsWith('.') ? `0${s}` : s);
  return Number.isFinite(n) ? n : null;
}

/** Text shown for a value set from outside (initial load, auto-filled price). */
export function formatDecimalInput(value: number, emptyWhenZero = false): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0 && emptyWhenZero) return '';
  let s = String(value);
  if (/e/i.test(s)) s = value.toFixed(12).replace(/\.?0+$/, '');
  return s;
}
