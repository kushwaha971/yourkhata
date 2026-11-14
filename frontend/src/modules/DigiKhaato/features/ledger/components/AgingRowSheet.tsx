'use client';

import { ArrowDownLeft, ArrowUpRight, BellRing, ExternalLink } from 'lucide-react';

import { UbActionSheet, UbInfoRow, UbStack, type UbMenuListRow } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { AGING_BUCKETS } from '../types/aging.types';
import { agingDueWord } from '../view-model/agingCards';
import { bucketLabelId, rowStatementHref } from '../view-model/agingDisplay';

import type { AgingKind, AgingRow } from '../types/aging.types';

export type AgingAction = 'remind' | 'receive' | 'pay';

/**
 * 09 §10.7 — one Shop contact's old dues: what to do first, then each bucket's
 * amount and the total. Money to collect offers Remind and Receive payment;
 * money to pay offers Pay. Each action is the product's existing flow (the
 * logged reminder sheet, the payment form with its optional Note), opened by
 * the page; a role without the permission does not see the row.
 * `dynamic()`-loaded: most visits read the report and open nobody.
 */
export function AgingRowSheet({
  row,
  kind,
  asOf,
  canRemind,
  canPay,
  onAction,
  onClose,
}: Readonly<{
  row: AgingRow | null;
  kind: AgingKind;
  asOf: string;
  canRemind: boolean;
  canPay: boolean;
  onAction: (action: AgingAction, row: AgingRow) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const icon = 'h-5 w-5';
  const rows: UbMenuListRow[] = row
    ? [
        ...(kind === 'receivable' && canRemind
          ? [
              {
                key: 'remind',
                label: t('ledger.aging.action.remind'),
                icon: <BellRing className={icon} aria-hidden />,
                onSelect: () => onAction('remind', row),
                testId: 'aging-action-remind',
              },
            ]
          : []),
        ...(canPay
          ? [
              kind === 'receivable'
                ? {
                    key: 'receive',
                    label: t('ledger.aging.action.receive'),
                    icon: <ArrowDownLeft className={icon} aria-hidden />,
                    onSelect: () => onAction('receive', row),
                    testId: 'aging-action-receive',
                  }
                : {
                    key: 'pay',
                    label: t('ledger.aging.action.pay'),
                    icon: <ArrowUpRight className={icon} aria-hidden />,
                    onSelect: () => onAction('pay', row),
                    testId: 'aging-action-pay',
                  },
            ]
          : []),
        {
          key: 'statement',
          label: t('ledger.aging.action.statement'),
          icon: <ExternalLink className={icon} aria-hidden />,
          href: rowStatementHref(row.partyId, asOf, 'shop'),
          testId: 'aging-action-statement',
        },
      ]
    : [];
  return (
    <UbActionSheet
      open={Boolean(row)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={row?.partyName ?? ''}
      closeLabel={t('common.action.close')}
      rows={rows}
    >
      {row && (
        <UbStack gap={1} className="px-6 py-3" data-testid="aging-row-sheet">
          {AGING_BUCKETS.map((bucket) => (
            <UbInfoRow
              key={bucket}
              label={t(bucketLabelId(bucket))}
              value={formatInr(row.amounts[bucket])}
            />
          ))}
          <UbInfoRow
            variant="total"
            label={agingDueWord(t, kind)}
            value={formatInr(row.amounts.total)}
          />
        </UbStack>
      )}
    </UbActionSheet>
  );
}
