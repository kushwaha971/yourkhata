'use client';

import { ExternalLink } from 'lucide-react';

import { UbActionLink, UbActionSheet, UbInfoRow, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { profitWords } from '../view-model/profitCards';
import { profitRowHref } from '../view-model/profitDisplay';

import type { ProfitGroup, ProfitRow } from '../types/profitReport.types';

/**
 * 09 §10.6 — a phone card's whole row: quantity, sales, cost, profit (or loss,
 * in words) and margin, and Open for the item, the customer's khata or the
 * bill. `dynamic()`-loaded: most visits read the report and open no row. The
 * owner's screen only — nothing here reaches a customer.
 */
export function ProfitRowSheet({
  row,
  group,
  name,
  onClose,
}: Readonly<{
  row: ProfitRow | null;
  group: ProfitGroup;
  name: string;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dash = '—';
  const href = row ? profitRowHref(group, row) : null;
  const words = profitWords(t, row?.profit ?? null);
  return (
    <UbActionSheet
      open={Boolean(row)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={name}
      closeLabel={t('common.action.close')}
    >
      {row && (
        <UbStack gap={1} className="px-6 py-3" data-testid="profit-row-sheet">
          {group === 'item' && row.qty && (
            <UbInfoRow
              label={t('reports.profit.sheet.qty')}
              value={formatQuantity(row.qty, row.unit ?? undefined)}
            />
          )}
          {group === 'bill' ? (
            <>
              <UbInfoRow
                label={t('reports.profit.sheet.date')}
                value={row.date ? formatBusinessDate(row.date) : dash}
              />
              <UbInfoRow
                label={t('reports.profit.column.party')}
                value={row.party?.name ?? t('reports.profit.unnamed.party')}
              />
            </>
          ) : (
            <UbInfoRow label={t('reports.profit.sheet.bills')} value={String(row.bills)} />
          )}
          <UbInfoRow label={t('reports.profit.column.sales')} value={formatInr(row.saleValue)} />
          <UbInfoRow
            label={t('reports.profit.column.cost')}
            value={row.cost === null ? dash : formatInr(row.cost)}
          />
          <UbInfoRow
            variant="total"
            label={words.word}
            value={words.value === null ? t('reports.profit.card.noCost') : formatInr(words.value)}
          />
          <UbInfoRow
            label={t('reports.profit.column.margin')}
            value={
              row.marginPct === null ? dash : t('reports.profit.percent', { value: row.marginPct })
            }
          />
          {row.uncostedLines > 0 && (
            <UbText variant="caption" tone="warning">
              {t('reports.profit.uncostedRow', { count: row.uncostedLines })}
            </UbText>
          )}
        </UbStack>
      )}
      {href && (
        <UbActionLink href={href} icon={<ExternalLink aria-hidden className="h-4 w-4" />}>
          {t('reports.profit.card.open', { name })}
        </UbActionLink>
      )}
    </UbActionSheet>
  );
}
