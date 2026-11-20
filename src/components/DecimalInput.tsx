import React, { useEffect, useRef, useState } from 'react';
import { formatDecimalInput, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'min' | 'max' | 'step' | 'inputMode'
> & {
  value: number;
  /** Called with the parsed number on every edit; empty input gives `emptyValue`. */
  onValueChange: (value: number) => void;
  /** Number reported while the field is empty (default 0). */
  emptyValue?: number;
  /** Show an empty field instead of "0". */
  emptyWhenZero?: boolean;
  /** Whole numbers only (no separator). */
  integer?: boolean;
  min?: number;
  max?: number;
};

/**
 * Text field for numbers that keeps what the user typed while they type, so
 * "0,02" can be entered one key at a time. Accepts '.' and ',' as the decimal
 * separator and opens the numeric keyboard on phones. `min` / `max` are
 * checked through the browser's form validation on submit.
 */
const DecimalInput: React.FC<Props> = ({
  value,
  onValueChange,
  emptyValue = 0,
  emptyWhenZero = false,
  integer = false,
  min,
  max,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [text, setText] = useState(() => formatDecimalInput(value, emptyWhenZero));
  const focused = useRef(false);
  const ref = useRef<HTMLInputElement>(null);

  // Follow value changes from outside (asset loaded, price auto-filled), but
  // never rewrite the text under the user's cursor.
  useEffect(() => {
    if (focused.current) return;
    const parsed = parseDecimalInput(text);
    if ((parsed ?? emptyValue) !== value) setText(formatDecimalInput(value, emptyWhenZero));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, emptyWhenZero]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parsed = parseDecimalInput(text);
    let msg = '';
    if (parsed !== null && min !== undefined && parsed < min) msg = `En az ${formatDecimalInput(min)} olmalı.`;
    else if (parsed !== null && max !== undefined && parsed > max) msg = `En fazla ${formatDecimalInput(max)} olmalı.`;
    el.setCustomValidity(msg);
  }, [text, min, max]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = sanitizeDecimalInput(e.target.value, integer);
        setText(next);
        onValueChange(parseDecimalInput(next) ?? emptyValue);
      }}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        // Show the value the form actually holds (e.g. after clamping).
        const parsed = parseDecimalInput(text);
        if ((parsed ?? emptyValue) !== value) setText(formatDecimalInput(value, emptyWhenZero));
        onBlur?.(e);
      }}
    />
  );
};

export default DecimalInput;
