'use client';

import { forwardRef, memo, useCallback, useRef, type InputHTMLAttributes } from 'react';

import { MLInput } from 'src/design-system/primitives';
import { cn } from 'src/utils/cn';

/**
 * Part 17 §17.6.0 "Quantity input rules" — a quantity with the unit as addon.
 *
 * `decimals` follows unit.allow_decimal. A whole-number unit (`decimals={0}`)
 * does not take a point at all (owner, 27 Oct 2026: "don't allow the float"
 * rather than accept it and print an error): it keeps what is before the
 * point, and the digits typed straight after a refused point are dropped
 * too — refusing only the point turned "3.141" into 3141 NOS. Deleting,
 * leaving the field or coming back to it ends that. A leading minus is
 * preserved so the form/API can refuse it: dropping it made -5 into 5. `signed` selects the keyboard
 * for a signed adjustment; the caller's validator decides which signs are valid.
 *
 * The value is the sanitised string the merchant typed — never a number, for
 * the reason money is never a number here (canon rule 3).
 */
export interface UbQuantityInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  readonly value: string | null | undefined;
  readonly onChange: (value: string) => void;
  readonly decimals?: number;
  readonly signed?: boolean;
  /** The unit code shown at the right edge (`KGS`). */
  readonly unit?: string;
  readonly invalid?: boolean;
  readonly className?: string;
}

/** Preserve numeric intent; the legacy signed argument stays compatible while callers validate direction. */
export const sanitiseQuantity = (raw: string, decimals: number, _signed: boolean): string => {
  const negative = raw.trim().replace(/−/g, '-').startsWith('-');
  const places = decimals === 0 ? 3 : decimals;
  const kept = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = kept.split('.');
  const fraction = rest.join('').slice(0, places);
  const body = rest.length > 0 && places > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
};

const UbQuantityInputInner = forwardRef<HTMLInputElement, UbQuantityInputProps>(
  function UbQuantityInputInner(
    { value, onChange, decimals = 3, signed = false, unit, invalid, className, ...rest },
    ref
  ) {
    const afterPoint = useRef(false);
    const shown = value ?? '';
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        if (decimals === 0) {
          if (/[.,]/.test(raw)) {
            afterPoint.current = true;
            onChange(sanitiseQuantity(raw.split(/[.,]/)[0] ?? '', 0, signed));
            return;
          }
          if (afterPoint.current && raw.length > shown.length && raw.startsWith(shown)) return;
          afterPoint.current = false;
        }
        onChange(sanitiseQuantity(raw, decimals, signed));
      },
      [onChange, decimals, signed, shown]
    );
    const { onFocus, onBlur } = rest;
    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        afterPoint.current = false;
        onFocus?.(event);
      },
      [onFocus]
    );
    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        afterPoint.current = false;
        onBlur?.(event);
      },
      [onBlur]
    );

    return (
      <div className={cn('relative flex w-full items-center', className)}>
        <MLInput
          ref={ref}
          type="text"
          inputMode={signed ? 'text' : decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={value ?? ''}
          onChange={handleChange}
          invalid={invalid}
          className={cn('ds-num text-right', unit && 'pr-14', invalid && 'border-formError')}
          {...rest}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {unit && (
          <span
            aria-hidden
            className="ds-body-s-regular pointer-events-none absolute right-3 text-text-tertiary"
          >
            {unit}
          </span>
        )}
      </div>
    );
  }
);

UbQuantityInputInner.displayName = 'UbQuantityInput';
export const UbQuantityInput = memo(UbQuantityInputInner);
