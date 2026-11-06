'use client';

import { type RefObject } from 'react';

import { ReasonConfirmDialog } from 'src/components/records/ReasonConfirmDialog';
import { UbAmount, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatAmount } from 'src/utils/money';

import { expenseTitle } from '../view-model/expenseDisplay';

import type { UseExpenseFormResult } from '../hooks/useExpenseForm';

/** Quick reasons, so the counter rarely types one. */
const REASON_IDS = [
  'expenses.void.reason.wrongAmount',
  'expenses.void.reason.twice',
  'expenses.void.reason.wrongCategory',
  'expenses.void.reason.notSpent',
] as const;

/**
 * 08 §12.2 / EXP-01 FR-12 — "Cancel EXP/26-27/0031?", with a reason, and the
 * consequence said before it happens.
 *
 * The expense is restated inside the dialog for the reason LED-03's reverse
 * dialog gives: a merchant confirming "cancel ₹12,000 rent" is confirming
 * something; one confirming "cancel this" is confirming a button press. The
 * consequence differs by kind: a paid Shop expense leaves the cash book, an
 * unpaid one comes off the supplier's Shop balance (it was never in the cash
 * book, EXP-03 BR-4). The Library and Lending keep no cash book, so theirs
 * says it comes off their expenses. The caret starts in the reason, as in
 * every cancel dialog (owner, 24 Oct 2026).
 *
 * The dialog is `ReasonConfirmDialog` (WP-03 D-04c).
 */
export function VoidExpenseDialog({
  form,
  returnFocusRef,
}: Readonly<{
  form: UseExpenseFormResult;
  returnFocusRef?: RefObject<HTMLElement | null>;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const { voiding, isVoiding, voidErrors, closeVoid, submitVoid } = form;

  if (!voiding) return null;

  /* Only the Shop may leave an expense unpaid, and only the Shop keeps a cash
     book: `canOwe` is that same question. */
  const consequence = !voiding.paid
    ? t('expenses.void.consequence.unpaid', {
        amount: formatAmount(voiding.amount),
        name: voiding.party?.name ?? '',
      })
    : t(form.canOwe ? 'expenses.void.consequence.paid' : 'expenses.void.consequence.paidOther', {
        date: formatBusinessDate(voiding.expenseDate),
      });

  return (
    <ReasonConfirmDialog
      title={t('expenses.void.title', { number: voiding.number })}
      confirmLabel={t('expenses.void.confirm')}
      workingLabel={t('expenses.void.working')}
      keepLabel={t('expenses.void.keep')}
      suggestions={REASON_IDS.map((id) => t(id))}
      suggestionsLabel={t('expenses.void.quick')}
      confirmTestId="expense-void-confirm"
      reasonLabel={t('expenses.void.reason')}
      reasonPlaceholder={t('expenses.void.reason.placeholder')}
      requiredMessageId="expenses.void.reason.required"
      busy={isVoiding}
      onConfirm={submitVoid}
      onClose={closeVoid}
      formErrors={voidErrors}
      returnFocusRef={returnFocusRef}
    >
      <UbStack direction="row" justify="between" align="start" className="gap-3">
        <UbStack gap={1} className="min-w-0 flex-1">
          <UbText variant="body" className="line-clamp-2">
            {expenseTitle(voiding)}
          </UbText>
          <UbText variant="caption" tone="tertiary">
            {formatBusinessDate(voiding.expenseDate)}
          </UbText>
        </UbStack>
        <UbAmount value={voiding.amount} size="sm" />
      </UbStack>
      <UbText variant="caption" tone="tertiary">
        {consequence}
      </UbText>
    </ReasonConfirmDialog>
  );
}
