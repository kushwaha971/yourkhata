'use client';

import { useMemo, type ReactNode } from 'react';

import {
  UbDivider,
  UbInfoRow,
  UbPanel,
  UbPanelSection,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbDataGridEmptyStates,
} from 'src/design-system/UbDataGrid';
import { useTranslation } from 'src/hooks/useTranslation';

import { useReportGridLabels } from '../hooks/useReportGridLabels';

import { ReportAmount } from './ReportAmount';
import { ReportCardRow, type ReportCard } from './ReportCardRow';

import type { GstHeads } from '../types/taxReports.types';

/**
 * One RPT-07 section: a card whose badge names the return coordinate
 * ("GSTR-1 · 4A") and whose one-line hint says what the table is — §8's
 * "every table header states the return table; nothing is a naked number".
 * It folds (09 §10.5): an accountant reading the B2C table should not have to
 * scroll past the HSN summary to reach the documents count.
 */
export function GstSection({
  title,
  coordinate,
  hint,
  children,
  testId,
}: Readonly<{
  title: string;
  coordinate: string;
  hint?: string;
  children: ReactNode;
  testId?: string;
}>): React.JSX.Element {
  // On a phone the badge beside the title squeezed it: at 320 px "Outward
  // taxable supplies" was cut to "Outward taxable…". The coordinate moves to
  // its own line under the title there; the title keeps the row.
  const phone = useGridTier() === 'cards';
  const badge = <UbStatusBadge tone="info" label={coordinate} />;
  return (
    <UbPanel as="section" data-testid={testId}>
      <UbPanelSection title={title} badge={phone ? undefined : badge} collapsible>
        {phone && <UbStack className="mb-1 items-start">{badge}</UbStack>}
        {hint && (
          <UbText variant="caption" tone="tertiary" className="mb-2">
            {hint}
          </UbText>
        )}
        {children}
      </UbPanelSection>
    </UbPanel>
  );
}

/**
 * A section's table: every row on one page (a GST section is tens of rows).
 * On a phone (09 §10.5) the section's totals come first as label and value,
 * then its rows as cards of three things (`card`); from 768 px the grid.
 */
export function GstTable<TRow>({
  rows,
  columns,
  rowId,
  rowName,
  caption,
  onRowOpen,
  card,
  totals,
  testId,
}: Readonly<{
  rows: readonly TRow[];
  columns: readonly UbDataGridColumn<TRow>[];
  rowId: (row: TRow) => string;
  rowName: (row: TRow) => string;
  caption: string;
  onRowOpen?: (row: TRow) => void;
  card: (row: TRow) => ReportCard;
  /** The section's own totals, when the server sends them. */
  totals?: GstHeads;
  testId: string;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const labels = useReportGridLabels();
  const tier = useGridTier();
  const emptyStates = useMemo<UbDataGridEmptyStates>(
    () => ({
      firstUse: { title: t('reports.gst.section.empty') },
      filtered: { title: t('reports.gst.section.empty') },
      error: { title: t('reports.gst.error.title') },
    }),
    [t]
  );
  if (tier === 'cards' && rows.length > 0)
    return (
      <UbStack gap={2} data-testid={`${testId}-cards`}>
        {totals && (
          <UbStack gap={0} data-testid={`${testId}-totals`}>
            <UbInfoRow
              label={t('reports.gst.column.taxable')}
              value={<ReportAmount value={totals.taxableValue} />}
            />
            <UbInfoRow label="CGST" value={<ReportAmount value={totals.cgst} />} />
            <UbInfoRow label="SGST" value={<ReportAmount value={totals.sgst} />} />
            <UbInfoRow label="IGST" value={<ReportAmount value={totals.igst} />} />
            <UbInfoRow
              label={t('reports.gst.column.cess')}
              value={<ReportAmount value={totals.cess} />}
            />
          </UbStack>
        )}
        <UbStack as="ul" gap={0} aria-label={caption}>
          {rows.map((row, index) => (
            <UbStack as="li" key={rowId(row)} gap={0}>
              {index > 0 && <UbDivider />}
              <ReportCardRow
                view={card(row)}
                onOpen={onRowOpen ? () => onRowOpen(row) : undefined}
                testId={`${testId}-row`}
              />
            </UbStack>
          ))}
        </UbStack>
      </UbStack>
    );
  return (
    <UbDataGrid
      rows={rows}
      columns={columns}
      rowId={rowId}
      rowName={rowName}
      state={rows.length === 0 ? 'empty' : 'rows'}
      labels={labels}
      emptyStates={emptyStates}
      caption={caption}
      page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
      onPageChange={() => undefined}
      onRowOpen={onRowOpen}
      cardAvatar={false}
      allowHorizontalScroll
    />
  );
}
