'use client';

import { ExternalLink, User } from 'lucide-react';

import { UbActionLink, UbActionSheet, UbInfoRow, UbStack } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { partyPath } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { rowPartyName, rowWhat, typeLabelId } from '../view-model/dayBookDisplay';
import { sourceHref } from '../view-model/drillThrough';

import { describeModes, describeRow } from './DayBookColumns';

import type { DayBookRow } from '../types/reports.types';

/**
 * 09 §10.2 — a phone card's whole row: every column the desktop table has, as
 * label and value, and the document and the contact behind it. The card shows
 * three things so a day reads at a glance; the running cash and bank after the
 * line, the mode split and who recorded it live here, one tap away.
 *
 * `dynamic()`-loaded from the page: most visits read the day and open no line.
 */
export function DayBookRowSheet({
  row,
  balances,
  onClose,
}: Readonly<{
  row: DayBookRow | null;
  balances: boolean;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const href = row ? sourceHref(row.source, row.number, row.type) : null;
  const partyHref = row?.party ? partyPath(row.party.id) : null;
  const dash = '—';
  return (
    <UbActionSheet
      open={Boolean(row)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={row ? rowWhat(row, t) : ''}
      closeLabel={t('common.action.close')}
    >
      {row && (
        <UbStack gap={1} className="px-6 py-3" data-testid="day-book-row-sheet">
          <UbInfoRow
            label={t('reports.daybook.column.type')}
            value={
              row.void
                ? `${t(typeLabelId(row))} · ${t('reports.daybook.void')}`
                : t(typeLabelId(row))
            }
          />
          <UbInfoRow
            label={t('reports.daybook.column.date')}
            value={`${formatBusinessDate(row.date)} · ${row.time}`}
          />
          <UbInfoRow label={t('reports.daybook.column.number')} value={row.number ?? dash} />
          <UbInfoRow label={t('reports.daybook.column.party')} value={rowPartyName(row) ?? dash} />
          <UbInfoRow
            label={t('reports.daybook.column.description')}
            value={describeRow(row, t) || dash}
          />
          <UbInfoRow
            label={t('reports.daybook.column.in')}
            value={row.moneyIn ? formatInr(row.moneyIn) : dash}
          />
          <UbInfoRow
            label={t('reports.daybook.column.out')}
            value={row.moneyOut ? formatInr(row.moneyOut) : dash}
          />
          <UbInfoRow
            label={t('reports.daybook.column.mode')}
            value={describeModes(row, t) || dash}
          />
          {balances && (
            <>
              <UbInfoRow
                label={t('reports.daybook.sheet.cashAfter')}
                value={formatInr(row.cashAfter)}
              />
              <UbInfoRow
                label={t('reports.daybook.sheet.bankAfter')}
                value={formatInr(row.bankAfter)}
              />
            </>
          )}
          <UbInfoRow label={t('reports.daybook.column.by')} value={row.createdBy?.name || dash} />
        </UbStack>
      )}
      {row && href && (
        <UbActionLink href={href} icon={<ExternalLink aria-hidden className="h-4 w-4" />}>
          {row.number
            ? t('reports.daybook.sheet.openNumber', { number: row.number })
            : t('reports.daybook.sheet.open')}
        </UbActionLink>
      )}
      {row && partyHref && partyHref !== href && (
        <UbActionLink href={partyHref} icon={<User aria-hidden className="h-4 w-4" />}>
          {t('reports.daybook.sheet.openContact', { name: row.party?.name ?? '' })}
        </UbActionLink>
      )}
    </UbActionSheet>
  );
}
