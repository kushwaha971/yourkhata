'use client';

import { memo } from 'react';

import { UbLink, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatClock } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import type { InvoiceListRow } from '../types/sales.types';

/** How many held bills are drawn as chips; the rest are one tap away on the list. */
export const HELD_SHOWN = 5;

/**
 * Counter Mode / myBillBook's "Hold & create another" — the bills kept on hold
 * (sales drafts, which already save themselves), above the editor, each one
 * tap from being picked up again: "On hold · 2  Bengaluru Traders ₹1,062.00".
 * A second customer at the counter no longer means finishing or losing the
 * first one's bill.
 */
function InvoiceHeldBillsBase({
  rows,
  total,
}: Readonly<{ rows: readonly InvoiceListRow[]; total: number }>): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <UbStack
      direction="row"
      gap={2}
      align="center"
      data-testid="invoice-held"
      aria-label={t('sales.hold.label', { count: total })}
    >
      <UbText variant="body-sm-medium" tone="secondary" className="shrink-0">
        {t('sales.hold.label', { count: total })}
      </UbText>
      {/* One quiet row that scrolls sideways: wrapped, four held bills took
          three rows of a 390 px phone above the bill being written. */}
      <UbStack
        direction="row"
        gap={2}
        align="center"
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-0.5"
        data-testid="invoice-held-chips"
      >
        {rows.slice(0, HELD_SHOWN).map((row) => (
          <UbLink
            key={row.id}
            href={`${ROUTES.SALES_INVOICES}/${row.id}/edit`}
            underline={false}
            tone="primary"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border-hairline bg-surface-card px-3 hover:bg-surface-hover"
          >
            <UbText as="span" variant="inherit" className="ds-body-sm">
              {row.party?.name ?? row.walkInName ?? t('sales.walkIn.label')}
            </UbText>
            {row.updatedAt && (
              <UbText as="span" variant="inherit" className="ds-num-s-regular text-text-secondary">
                {formatClock(row.updatedAt)}
              </UbText>
            )}
            <UbText as="span" variant="inherit" className="ds-num-s-regular whitespace-nowrap">
              {formatInr(row.grandTotal)}
            </UbText>
          </UbLink>
        ))}
        {total > HELD_SHOWN && (
          <UbLink
            href={`${ROUTES.SALES_INVOICES}?tab=draft`}
            className="shrink-0 whitespace-nowrap"
          >
            {t('sales.hold.all', { count: total })}
          </UbLink>
        )}
      </UbStack>
    </UbStack>
  );
}

InvoiceHeldBillsBase.displayName = 'InvoiceHeldBills';
export const InvoiceHeldBills = memo(InvoiceHeldBillsBase);
