'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

import { cn } from 'src/utils/cn';

/**
 * **RETAINED FOR THE BACKLOGGED OTP FLOW — no screen uses this at MVP.**
 *
 * CR-2026-09-19-A made authentication email + password only and moved mobile
 * OTP, with the SMS provider it needs, to the backlog. This component and its
 * tests are kept rather than deleted, because the flow is postponed and not
 * abandoned: the behaviours below were each found on a shop counter, and
 * re-deriving them from scratch when the SMS provider lands would be paying
 * twice for the same knowledge. It stays exported from the barrel and stays in
 * the design-system gallery so it cannot silently rot.
 *
 * PLT-01 §7 — the six-cell code entry, and its §9 states.
 *
 * The behaviours are not decoration; each one is a failure mode observed on a
 * shop counter:
 *  - **Paste fills all six.** The code arrives by SMS and is copied whole. A
 *    paste that lands entirely in cell one and then silently truncates is the
 *    single most common reason an OTP screen gets abandoned.
 *  - **Auto-submit on the sixth digit** (PLT-01 §7 "OTP auto-submits when the
 *    sixth digit is entered"), so the user never hunts for a button with the
 *    keyboard up.
 *  - **Backspace on an empty cell moves back and clears** the previous one.
 *  - **`autoComplete="one-time-code"`** on the first cell, which is what lets
 *    iOS and Android offer the code from the notification.
 *  - **`readOnly` while verifying** (state "Processing": cells read-only) rather
 *    than `disabled`, so focus is not thrown away mid-request.
 *
 * The value is the whole code, so the FORM holds one string and the schema is
 * `/^\d{4}$/` — the cells are a rendering decision, not a data shape.
 */
/** Six digits: the only length the server sends since 14 Nov 2026 (owner). */
export const OTP_LENGTH = 6;

export interface UbOtpInputProps {
  readonly length?: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Fired once, when the sixth digit lands. */
  readonly onComplete?: (value: string) => void;
  readonly invalid?: boolean;
  /** "Processing": cells stay focusable but reject input. */
  readonly readOnly?: boolean;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  /** The accessible name of the group; each cell is numbered from it. */
  readonly label: string;
  readonly cellLabel: (index: number, total: number) => string;
  readonly id?: string;
  readonly describedBy?: string;
  readonly className?: string;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * The code inside pasted or autofilled text (owner, 14 Nov 2026: "not able to
 * paste otp directly"). A copied MESSAGE carries other numbers — "valid for 10
 * minutes", the phone number — and taking its first digits sent "1048" for
 * "Valid for 10 minutes. Your code is 4821". So: a run of exactly `length`
 * digits wins; else every digit, when together they make the code ("482 193");
 * else the first `length` digits, as before.
 */
export const codeFrom = (text: string, length: number): string => {
  const runs = text.match(/\d+/g) ?? [];
  const exact = runs.find((run) => run.length === length);
  if (exact) return exact;
  const all = onlyDigits(text);
  return all.slice(0, length);
};

function UbOtpInputBase({
  length = OTP_LENGTH,
  value,
  onChange,
  onComplete,
  invalid,
  readOnly,
  disabled,
  autoFocus,
  label,
  cellLabel,
  id,
  describedBy,
  className,
}: Readonly<UbOtpInputProps>) {
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  // `onComplete` must fire once per completed code, not on every re-render that
  // happens to carry six digits (a parent repaint while verifying, say).
  const completedFor = useRef<string | null>(null);

  const digits = onlyDigits(value).slice(0, length);

  useEffect(() => {
    if (digits.length === length && completedFor.current !== digits) {
      completedFor.current = digits;
      onComplete?.(digits);
    }
    if (digits.length < length) completedFor.current = null;
  }, [digits, onComplete, length]);

  const focusCell = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(length - 1, index));
      cells.current[clamped]?.focus();
      cells.current[clamped]?.select();
    },
    [length]
  );

  const commit = useCallback(
    (next: string, focusIndex: number) => {
      onChange(next.slice(0, length));
      focusCell(focusIndex);
    },
    [onChange, focusCell, length]
  );

  const handleChange = useCallback(
    (index: number, raw: string) => {
      if (readOnly) return;
      // A whole message or code put into one cell (iOS autofill, a keyboard's
      // clipboard chip) arrives here without a paste event: read the code in it.
      let typed = raw.length > 2 ? codeFrom(raw, length) : onlyDigits(raw);
      if (raw.length > 2 && typed.length === length) {
        commit(typed, length);
        return;
      }
      // No `maxLength` (see the cell), so typing beside a filled cell's digit
      // arrives as both: keep the new one.
      const old = digits[index];
      if (old && typed.length === 2 && (typed.startsWith(old) || typed.endsWith(old))) {
        typed = typed.startsWith(old) ? typed.slice(1) : typed.slice(0, 1);
      }
      if (typed.length === 0) {
        // The cell was cleared, or a character the mask rejects was typed.
        commit(`${digits.slice(0, index)}${digits.slice(index + 1)}`, index);
        return;
      }
      // Typing over a filled cell replaces it; a multi-character insert (some
      // Android keyboards deliver a paste this way) spills into the cells after.
      const combined = `${digits.slice(0, index)}${typed}${digits.slice(index + typed.length)}`;
      commit(combined.slice(0, length), index + typed.length);
    },
    [digits, readOnly, commit, length]
  );

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace') {
        if (readOnly) return;
        event.preventDefault();
        if (digits[index]) {
          commit(`${digits.slice(0, index)}${digits.slice(index + 1)}`, index);
        } else {
          commit(`${digits.slice(0, index - 1)}${digits.slice(index)}`, index - 1);
        }
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusCell(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusCell(index + 1);
      }
    },
    [digits, readOnly, commit, focusCell]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const clip = event.clipboardData.getData('text') || event.clipboardData.getData('text/plain');
      const pasted = codeFrom(clip, length);
      if (!pasted) return;
      event.preventDefault();
      const next = pasted.slice(0, length);
      commit(next, next.length);
    },
    [readOnly, commit, length]
  );

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      id={id}
      className={cn('flex items-center gap-2', className)}
    >
      {Array.from({ length: length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            cells.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          // Only the first cell carries it; six one-time-code fields make the
          // platform offer the code six times.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && index === 0}
          // No `maxLength={1}`: a code put in WITHOUT a paste event — the
          // keyboard's clipboard chip, or the SMS autofill — was cut by the
          // browser to its first digit before `handleChange` could spread it
          // (owner, 12 Nov 2026: "not able to copy paste"). `handleChange`
          // keeps one digit per cell itself.
          readOnly={readOnly}
          disabled={disabled}
          aria-label={cellLabel(index + 1, length)}
          aria-invalid={invalid || undefined}
          value={digits[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className={cn(
            /* `text-[1.25rem]` was a literal, which R-S-5 forbids for exactly this
               reason: nothing else in the product is 20px, so an OTP cell
               belonged to no tier. `ds-num-base` is the numeric body tier — the
               same face and size as a rupee amount — and it is what BrandHub
               uses for its own slots (`ds-body-l-medium` on a `size-9` box).
               The cell stays 48x44 rather than their 36x36: this is a six-cell
               row a merchant types on a phone. */
            'ds-num-base h-12 w-11 min-w-0 rounded-control border bg-surface-card text-center',
            'text-text-primary transition-colors duration-fast ease-standard',
            'read-only:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-100',
            'disabled:bg-surface-sunken disabled:text-text-muted',
            invalid ? 'border-formError' : 'border-border-strong focus:border-border-focus'
          )}
        />
      ))}
    </div>
  );
}

UbOtpInputBase.displayName = 'UbOtpInput';
export const UbOtpInput = memo(UbOtpInputBase);
