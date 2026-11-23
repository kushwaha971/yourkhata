'use client';

import { ExternalLink } from 'lucide-react';

import { UbActionLink, UbActionSheet, UbInfoRow, UbStack } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { documentHref, isCreditRow, isVoidRow } from '../view-model/registerDisplay';

import type { RegisterBook, RegisterLevel, RegisterRow } from '../types/taxReports.types';

/**
 * 09 §10.3/§10.4 — a phone card's whole row: every column of the desktop
 * register as label and value, and Open for the bill. `dynamic()`-loaded:
 * most visits read the register and open no row.
 */
export function RegisterRowSheet({
  row,
  book,
  level,
  onClose,
}: Readonly<{
  row: RegisterRow | null;
  book: RegisterBook;
  level: RegisterLevel;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dash = '—';
  const money = (value: string | null | undefined) => (value ? formatInr(value) : dash);
  const party = row ? row.partyName || (row.isWalkIn ? t('reports.register.walkIn') : dash) : dash;
  const flag = row
    ? isVoidRow(row)
      ? t('reports.register.badge.void')
      : isCreditRow(row)
        ? t('reports.register.badge.creditNote')
        : null
    : null;
  return (
    <UbActionSheet
      open={Boolean(row)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={row ? (level === 'line' ? row.itemName || row.number : party) : ''}
      closeLabel={t('common.action.close')}
    >
      {row && (
        <UbStack gap={1} className="px-6 py-3" data-testid="register-row-sheet">
          <UbInfoRow
            label={t('reports.register.column.document')}
            value={flag ? `${row.number} · ${flag}` : row.number}
          />
          <UbInfoRow
            label={t('reports.register.column.date')}
            value={formatBusinessDate(row.date)}
          />
          <UbInfoRow label={t('reports.register.sheet.party')} value={party} />
          <UbInfoRow label={t('reports.register.sheet.gstin')} value={row.partyGstin || dash} />
          {book === 'purchase' && (
            <UbInfoRow
              label={t('reports.register.sheet.supplierBill')}
              value={
                [
                  row.supplierInvoiceNumber,
                  row.supplierInvoiceDate && formatBusinessDate(row.supplierInvoiceDate),
                ]
                  .filter(Boolean)
                  .join(' · ') || dash
              }
            />
          )}
          <UbInfoRow
            label={t('reports.register.sheet.supply')}
            value={t(
              row.isInterState
                ? 'reports.register.sheet.supply.inter'
                : 'reports.register.sheet.supply.intra'
            )}
          />
          {level === 'line' && (
            <>
              <UbInfoRow
                label={t('reports.register.column.item')}
                value={
                  [row.itemName, row.hsnSac && `${t('reports.register.column.hsn')} ${row.hsnSac}`]
                    .filter(Boolean)
                    .join(' · ') || dash
                }
              />
              <UbInfoRow
                label={t('reports.register.column.qty')}
                value={`${row.qty} ${row.unit}`.trim() || dash}
              />
              <UbInfoRow
                label={t('reports.register.column.rate')}
                value={row.taxRate ? `${Number(row.taxRate)}%` : dash}
              />
              {book === 'purchase' && row.unitCost !== null && (
                <UbInfoRow
                  label={t('reports.register.column.unitCost')}
                  value={money(row.unitCost)}
                />
              )}
            </>
          )}
          <UbInfoRow
            label={t('reports.register.column.taxable')}
            value={money(level === 'line' ? row.taxableValue : row.taxableTotal)}
          />
          <UbInfoRow label={t('reports.register.column.cgst')} value={money(row.cgst)} />
          <UbInfoRow label={t('reports.register.column.sgst')} value={money(row.sgst)} />
          <UbInfoRow label={t('reports.register.column.igst')} value={money(row.igst)} />
          <UbInfoRow label={t('reports.register.column.cess')} value={money(row.cess)} />
          {level === 'document' && (
            <UbInfoRow label={t('reports.register.column.roundOff')} value={money(row.roundOff)} />
          )}
          <UbInfoRow
            variant="total"
            label={t(
              level === 'line'
                ? 'reports.register.column.lineTotal'
                : 'reports.register.column.total'
            )}
            value={money(row.grandTotal)}
          />
          {level === 'document' && (
            <>
              <UbInfoRow label={t('reports.register.footer.paid')} value={money(row.amountPaid)} />
              <UbInfoRow label={t('reports.register.column.due')} value={money(row.amountDue)} />
            </>
          )}
        </UbStack>
      )}
      {row && (
        <UbActionLink
          href={documentHref(book, row)}
          icon={<ExternalLink aria-hidden className="h-4 w-4" />}
        >
          {t('reports.register.sheet.openBill', { number: row.number })}
        </UbActionLink>
      )}
    </UbActionSheet>
  );
}
