import type { UbStatusBadgeTone } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { absMoney, formatInr } from 'src/utils/money';
import { buildWhatsAppUrl } from 'src/utils/share';

import type { Loan, ScheduleState, StopState } from '../types/lending.types';

/** How Loans & Collections says money, days and states (I8–I11). No React. */

/** ₹4,500 — the design's figures carry no paise when there are none. */
export const rupees = (value: string | null | undefined): string => {
  const text = formatInr(value ? absMoney(value) : '0.00');
  return text.endsWith('.00') ? text.slice(0, -3) : text;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "30 Oct" (or "30 Oct 2025" from another year). */
export const shortDate = (iso: string | null | undefined, today: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const label = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${y}`;
};

export const STOP_WORD: Readonly<Record<StopState, string>> = {
  late: 'lending.stop.late',
  due: 'lending.stop.due',
  done: 'lending.stop.done',
  not: 'lending.stop.not',
};

export const STOP_TONE: Readonly<Record<StopState, UbStatusBadgeTone>> = {
  late: 'error',
  due: 'neutral',
  done: 'success',
  not: 'error',
};

export const SCHEDULE_WORD: Readonly<Record<ScheduleState, string>> = {
  collected: 'lending.schedule.collected',
  late: 'lending.schedule.late',
  due: 'lending.schedule.due',
  upcoming: 'lending.schedule.upcoming',
};

export const SCHEDULE_TONE: Readonly<Record<ScheduleState, UbStatusBadgeTone>> = {
  collected: 'success',
  late: 'error',
  due: 'warning',
  upcoming: 'neutral',
};

/** "Tea stall · L-0112" — the round's second line (I8). */
export const workLine = (l: Pick<Loan, 'work' | 'number'>): string => [l.work, l.number].filter(Boolean).join(' · ');

/** "Daily · 40 days", "Weekly · 10 weeks", "Monthly · 6 months". */
export const planLine = (l: Pick<Loan, 'frequency' | 'count'>, t: TranslateFn): string =>
  t(`lending.plan.${l.frequency}`, { count: l.count });

export const whatsappHref = (mobile: string, text: string): string => buildWhatsAppUrl(text, mobile);
