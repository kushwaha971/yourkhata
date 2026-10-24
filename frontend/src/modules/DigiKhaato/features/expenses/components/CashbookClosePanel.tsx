'use client';

import { useId, useState } from 'react';

import { UbButton, UbCard, UbMoneyInput, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatAmount } from 'src/utils/money';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import { countDifference } from '../view-model/expenseDisplay';

/**
 * 08 §11 — Close the day: "Count the cash in your drawer", then Matches,
 * Short by ₹120 or Extra ₹80, with the fix the difference points at, in place.
 *
 * Short means money left the drawer that the book does not know about — the
 * forgotten expense. Extra means money came in that it does not know about —
 * the forgotten payment. The spec lists both fixes under "Short by"; offered
 * there, "Receive a payment" would raise the expected cash and make the gap
 * WIDER, so each fix goes with the difference it can close (report deviation).
 *
 * The count is held in this component only and stored nowhere (FR-8), and the
 * panel says so, so nobody expects to find yesterday's count tomorrow.
 */
export function CashbookClosePanel({
  expectedCash,
  t,
  onAddExpense,
  onReceivePayment,
}: Readonly<{
  expectedCash: string;
  t: TranslateFn;
  /** Absent when the member cannot record an expense. */
  onAddExpense?: (amount: string) => void;
  /** Absent when the member cannot record a payment. */
  onReceivePayment?: (amount: string) => void;
}>): React.JSX.Element {
  const [counted, setCounted] = useState('');
  const inputId = useId();
  const difference = countDifference(expectedCash, counted);
  const tone =
    difference?.kind === 'matches' ? 'success' : difference?.kind === 'short' ? 'warning' : 'info';

  return (
    <UbCard title={t('cashbook.closeDay')} padded>
      <UbStack gap={3} data-testid="close-the-day">
        <UbText variant="body-sm">
          {t('cashbook.expectedCash', { amount: formatInrUnbroken(expectedCash) })}
        </UbText>
        <UbText as="label" variant="label" htmlFor={inputId}>
          {t('cashbook.close.prompt')}
        </UbText>
        <UbMoneyInput
          id={inputId}
          name="counted-cash"
          placeholder={t('cashbook.countedCash.placeholder')}
          value={counted}
          onChange={setCounted}
          inputMode="decimal"
        />
        {/* Announced as it changes: the merchant is typing, not looking. */}
        <UbStack gap={2} aria-live="polite" data-testid="close-the-day-result">
          {difference && (
            <>
              <UbStatusBadge
                tone={tone}
                label={t(`cashbook.${difference.kind}`, {
                  amount: formatAmount(difference.amount),
                })}
                className="self-start"
              />
              {difference.kind === 'short' && onAddExpense && (
                <UbButton
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => onAddExpense(difference.amount)}
                >
                  {t('cashbook.close.addMissing')}
                </UbButton>
              )}
              {difference.kind === 'extra' && onReceivePayment && (
                <UbButton
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => onReceivePayment(difference.amount)}
                >
                  {t('cashbook.close.receiveForgot')}
                </UbButton>
              )}
            </>
          )}
        </UbStack>
        <UbText variant="caption" tone="tertiary">
          {t('cashbook.close.notSaved')}
        </UbText>
      </UbStack>
    </UbCard>
  );
}
