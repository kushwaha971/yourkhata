'use client';

import { useMemo } from 'react';

import { UbInfoRow, UbStack, UbText } from 'src/design-system';
import { useGridTier, type UbDataGridColumn } from 'src/design-system/UbDataGrid';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { GstSection, GstTable } from './GstSection';
import { ReportAmount } from './ReportAmount';

import type { GstBox, Gstr3b } from '../types/taxReports.types';

type BoxRow = { readonly box: string; readonly figures: GstBox };

const boxFigure = (id: keyof Omit<GstBox, 'note'>, header: string): UbDataGridColumn<BoxRow> => ({
  id,
  header,
  priority: 1,
  align: 'end',
  cardSlot: 'none',
  widthShare: 12,
  cell: (row) =>
    row.figures.note === 'not_modelled' ? '—' : <ReportAmount value={row.figures[id]} />,
});

/** The portal's own grid for 3.1 and 4: one row per box, a column per head. */
const boxColumns = (t: TranslateFn): UbDataGridColumn<BoxRow>[] => [
  {
    id: 'box',
    header: t('reports.gst.column.box'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 40,
    // The code is read with its meaning (09 §10.5 Accessibility).
    cell: (row) => (
      <UbStack gap={0} className="min-w-0">
        <UbText as="span" variant="body-sm" className="whitespace-normal">
          {`${row.box} · ${t(`reports.gst.box.${row.box}`)}`}
        </UbText>
        {row.figures.note === 'not_modelled' && (
          <UbText as="span" variant="caption" tone="tertiary" className="whitespace-normal">
            {t('reports.gst.box.notModelled')}
          </UbText>
        )}
      </UbStack>
    ),
  },
  boxFigure('taxable', t('reports.gst.column.taxable')),
  boxFigure('igst', 'IGST'),
  boxFigure('cgst', 'CGST'),
  boxFigure('sgst', 'SGST'),
  boxFigure('cess', t('reports.gst.column.cess')),
];

/**
 * RPT-07 FR-8 — the GSTR-3B boxes top to bottom, each figure beside its
 * coordinate so it can be typed into the portal. A box the product does not
 * model (3.1(b) exports, 4(B) reversals) says so rather than showing a zero
 * that looks measured (BR-9).
 */
export function Gstr3bBoxes({ gstr3b }: Readonly<{ gstr3b: Gstr3b }>): React.JSX.Element {
  const { t } = useTranslation();
  // 09 §10.5: the official grid on a desktop; a stacked list of labelled
  // boxes on a phone, never a grid that scrolls.
  const phone = useGridTier() === 'cards';
  const columns = useMemo(() => boxColumns(t), [t]);
  return (
    <UbStack gap={4}>
      {!phone && (
        <GstSection
          title={t('reports.gst.box.grid')}
          coordinate="GSTR-3B · 3.1 · 4"
          testId="gstr3b-grid"
        >
          <GstTable<BoxRow>
            rows={gstr3b.boxes}
            columns={columns}
            rowId={(row) => row.box}
            rowName={(row) => row.box}
            caption={t('reports.gst.box.grid')}
            card={() => ({ what: '', which: [], amount: null, struck: false, label: '' })}
            testId="gstr3b-boxes"
          />
        </GstSection>
      )}
      {phone &&
        gstr3b.boxes.map(({ box, figures }) => (
          <GstSection
            key={box}
            title={t(`reports.gst.box.${box}`)}
            coordinate={`GSTR-3B · ${box}`}
            testId="gstr3b-box"
            hint={figures.note === 'not_modelled' ? t('reports.gst.box.notModelled') : undefined}
          >
            {figures.note !== 'not_modelled' && (
              <>
                <UbInfoRow
                  label={t('reports.gst.column.taxable')}
                  value={<ReportAmount value={figures.taxable} />}
                />
                <UbInfoRow label="IGST" value={<ReportAmount value={figures.igst} />} />
                <UbInfoRow label="CGST" value={<ReportAmount value={figures.cgst} />} />
                <UbInfoRow label="SGST" value={<ReportAmount value={figures.sgst} />} />
                <UbInfoRow
                  label={t('reports.gst.column.cess')}
                  value={<ReportAmount value={figures.cess} />}
                />
              </>
            )}
          </GstSection>
        ))}
      <GstSection title={t('reports.gst.box.3.2')} coordinate="GSTR-3B · 3.2">
        {gstr3b.stateWise.length === 0 ? (
          <UbText variant="body-sm" tone="tertiary">
            {t('reports.gst.section.empty')}
          </UbText>
        ) : (
          gstr3b.stateWise.map((row) => (
            <UbInfoRow
              key={row.posState}
              label={t('reports.gst.box.stateRow', { state: row.posState })}
              value={
                <UbStack gap={0} className="items-end">
                  <ReportAmount value={row.taxable} />
                  <UbText as="span" variant="caption" tone="tertiary">
                    {t('reports.gst.box.igstOf', { amount: formatInr(row.igst) })}
                  </UbText>
                </UbStack>
              }
            />
          ))
        )}
      </GstSection>
      <GstSection title={t('reports.gst.box.5')} coordinate="GSTR-3B · 5">
        <UbInfoRow
          label={t('reports.gst.inter')}
          value={<ReportAmount value={gstr3b.exemptInward.inter} />}
        />
        <UbInfoRow
          label={t('reports.gst.intra')}
          value={<ReportAmount value={gstr3b.exemptInward.intra} />}
        />
      </GstSection>
      <GstSection
        title={t('reports.gst.net.title')}
        coordinate={t('reports.gst.net.coordinate')}
        hint={t('reports.gst.net.hint')}
      >
        <UbInfoRow
          label={t('reports.gst.net.output')}
          value={<ReportAmount value={gstr3b.net.outputTax} />}
        />
        <UbInfoRow
          label={t('reports.gst.net.itc')}
          value={<ReportAmount value={gstr3b.net.itc} />}
        />
        <UbInfoRow label="IGST" value={<ReportAmount value={gstr3b.net.igst} />} />
        <UbInfoRow label="CGST" value={<ReportAmount value={gstr3b.net.cgst} />} />
        <UbInfoRow label="SGST" value={<ReportAmount value={gstr3b.net.sgst} />} />
        <UbInfoRow
          label={t('reports.gst.column.cess')}
          value={<ReportAmount value={gstr3b.net.cess} />}
        />
        <UbInfoRow
          variant="total"
          label={t('reports.gst.net.total')}
          value={<ReportAmount value={gstr3b.net.total} size="md" />}
        />
      </GstSection>
    </UbStack>
  );
}
