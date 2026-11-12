import type { UbStatusBadgeTone } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { absMoney, formatInr } from 'src/utils/money';
import { buildWhatsAppUrl } from 'src/utils/share';

import type { FeeStatus, Student } from '../types/library.types';

/**
 * How Members & Fees says money, dates and fee states, one place for every
 * screen (I4–I7). No React; ids and strings only.
 */

/** ₹4,500 — the design's figures carry no paise when there are none. */
export const rupees = (value: string | null | undefined): string => {
  const text = formatInr(value ? absMoney(value) : '0.00');
  return text.endsWith('.00') ? text.slice(0, -3) : text;
};

export const FEE_WORD: Readonly<Record<FeeStatus, string>> = {
  paid: 'library.fee.paid',
  soon: 'library.fee.soon',
  over: 'library.fee.over',
  part: 'library.fee.part',
  hold: 'library.fee.hold',
};

export const FEE_TONE: Readonly<Record<FeeStatus, UbStatusBadgeTone>> = {
  paid: 'success',
  soon: 'warning',
  over: 'error',
  part: 'warning',
  hold: 'neutral',
};

/** The seat map's wash per fee (the design's FS table): green, amber, red, grey. */
export const SEAT_WASH: Readonly<Record<FeeStatus, string>> = {
  paid: 'bg-success-dim',
  soon: 'bg-warning-dim',
  over: 'bg-error-dim',
  part: 'bg-warning-dim',
  hold: 'bg-surface-sunken',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "25 Oct" (or "25 Oct 2025" from another year). Month names stay Latin in Hindi, as dates do elsewhere. */
export const shortDate = (iso: string | null | undefined, today: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const label = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${y}`;
};

/** "October" for a yyyy-mm-dd day. */
export const monthName = (iso: string, t: TranslateFn): string =>
  t(`library.month.${Number(iso.slice(5, 7))}`);

/** "Seat 14 · Morning", "Full day", or "No seat · Evening". */
export const seatLine = (s: Pick<Student, 'seat' | 'shift'>, t: TranslateFn): string =>
  s.seat ? t('library.student.seatShift', { seat: s.seat, shift: s.shift }) : t('library.student.noSeat', { shift: s.shift });

/**
 * The second line the design gives a student in a list (I4 Today):
 * "Seat 8 · Morning · ends 2 Nov", "₹400 left", "5 days late", "on hold".
 */
export const feeLine = (s: Student, today: string, t: TranslateFn): string => {
  const base = seatLine(s, t);
  switch (s.fee) {
    case 'over':
      return `${base} · ${t('library.fee.late', { count: s.daysLate })}`;
    case 'part':
      return `${base} · ${t('library.fee.left', { amount: rupees(s.due) })}`;
    case 'soon':
      return `${base} · ${t('library.fee.ends', { date: shortDate(s.paidTo, today) })}`;
    case 'hold':
      return s.holdUntil
        ? `${base} · ${t('library.fee.holdTill', { date: shortDate(s.holdUntil, today) })}`
        : `${base} · ${t('library.fee.onHold')}`;
    default:
      return `${base} · ${t('library.fee.paidTo', { date: shortDate(s.paidTo, today) })}`;
  }
};

/** The amount a fee row shows: what is due, or "—" for a paid or held student. */
export const dueAmount = (s: Student): string =>
  s.fee === 'paid' || s.fee === 'hold' ? '—' : rupees(s.due);

/** Opens WhatsApp with the text; the person at the counter presses send (DEC-012). */
export const whatsappHref = (mobile: string, text: string): string => buildWhatsAppUrl(text, mobile);
