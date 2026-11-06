import type { UbStatusBadgeTone } from 'src/design-system/UbStatusBadge/UbStatusBadge';
import type { TranslateFn } from 'src/hooks/useTranslation';

import type { CounterDocumentFact } from '../api/counterService';

/** A returned credit is not an unpaid sale; unknown states are never guessed. */
export function counterDocumentStatus(fact: CounterDocumentFact | undefined, t: TranslateFn): { label: string; tone: UbStatusBadgeTone } | null {
  if (!fact) return null;
  const state = ['issued', 'recorded'].includes(fact.status)
    ? fact.kind === 'credit_note' ? 'issued' : 'unpaid'
    : fact.status;
  const tones: Readonly<Record<string, UbStatusBadgeTone>> = {
    paid: 'success', partially_paid: 'warning', overdue: 'error', unpaid: 'warning',
    void: 'neutral', cancelled: 'neutral', draft: 'neutral', applied: 'success', issued: 'info',
  };
  const tone = Object.hasOwn(tones, state) ? tones[state] : undefined;
  return tone ? { label: t(`counterRegister.status.${state === 'void' ? 'cancelled' : state}`), tone } : null;
}
