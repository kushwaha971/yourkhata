import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { sumMoney } from 'src/utils/money';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import type { ReportCard } from '../components/ReportCardRow';
import type {
  GstB2csRow,
  GstDocsRow,
  GstException,
  GstHeads,
  GstHsnRow,
  GstNatureRow,
  GstRateRow,
} from '../types/taxReports.types';

/**
 * 09 §10.5 on a phone — each GST section's rows as cards of three things: what
 * the row is (the type of sale, the state, the HSN, the rate), which return
 * coordinate or count it carries, and its taxable value with the GST on it
 * under. The GST is the sum of the server's four heads, added in exact paise
 * (`sumMoney`); the heads themselves are on the desktop table and the 3B boxes.
 */

const rate = (value: string): string => `${Number(value)}%`;

/** The GST on a row: CGST + SGST + IGST + cess, as the server returned them. */
export const headsTax = (row: GstHeads): string =>
  sumMoney([row.cgst, row.sgst, row.igst, row.cess]);

const taxable = (row: GstHeads, t: TranslateFn): ReportCard['amount'] => ({
  word: t('reports.gst.card.taxable'),
  value: row.taxableValue,
  tone: 'primary',
  note: t('reports.gst.card.tax', { amount: formatInrUnbroken(headsTax(row)) }),
});

const card = (
  what: string,
  which: ReportCard['which'],
  amount: ReportCard['amount'],
  t: TranslateFn
): ReportCard => ({
  what,
  which,
  amount,
  struck: false,
  label: t('reports.gst.card.open', {
    name: [what, ...which.map((piece) => piece.text)].join(' · '),
  }),
});

export const natureCard =
  (t: TranslateFn) =>
  (row: GstNatureRow): ReportCard =>
    card(
      t(`reports.gst.nature.${row.nature}`),
      row.applicable
        ? [
            { text: `GSTR-1 · ${row.table}` },
            { text: t('reports.gst.card.documents', { count: row.documentCount }) },
          ]
        : [{ text: t('reports.gst.nature.notApplicable'), wrap: true }],
      row.applicable ? taxable(row, t) : null,
      t
    );

export const b2csCard =
  (t: TranslateFn) =>
  (row: GstB2csRow): ReportCard =>
    card(
      `${row.posState} · ${rate(row.taxRate)}`,
      [{ text: t(row.isInterState ? 'reports.gst.inter' : 'reports.gst.intra') }],
      taxable(row, t),
      t
    );

export const hsnCard =
  (t: TranslateFn) =>
  (row: GstHsnRow): ReportCard => {
    const code = row.hsnSac === '(missing)' ? t('reports.gst.hsn.missing') : row.hsnSac;
    return card(
      row.description || code,
      [
        { text: `HSN ${code}` },
        { text: row.supplyType.toUpperCase() },
        { text: rate(row.taxRate) },
        { text: `${row.totalQty} ${row.uqc}`.trim() },
      ],
      taxable(row, t),
      t
    );
  };

export const docsCard =
  (t: TranslateFn) =>
  (row: GstDocsRow): ReportCard =>
    card(
      t(`reports.gst.docs.${row.nature}`),
      [
        { text: row.fromNumber },
        { text: t('reports.gst.card.to', { number: row.toNumber }) },
        ...(row.cancelledCount > 0
          ? [{ text: t('reports.gst.card.cancelled', { count: row.cancelledCount }) }]
          : []),
      ],
      {
        word: t('reports.gst.docs.total'),
        value: null,
        display: String(row.totalCount),
        tone: 'primary',
      },
      t
    );

export const rateCard =
  (t: TranslateFn, inward = false) =>
  (row: GstRateRow): ReportCard =>
    card(
      `${row.taxCode} · ${rate(row.taxRate)}`,
      [
        { text: t(row.isInterState ? 'reports.gst.inter' : 'reports.gst.intra') },
        ...(inward && row.reverseCharge ? [{ text: 'RCM' }] : []),
        ...(inward && row.itcEligible === false ? [{ text: t('reports.gst.noItc') }] : []),
        {
          text: t(inward ? 'reports.gst.card.bills' : 'reports.gst.card.documents', {
            count: row.count,
          }),
        },
      ],
      taxable(row, t),
      t
    );

export const exceptionCard =
  (t: TranslateFn) =>
  (row: GstException): ReportCard =>
    card(
      row.partyName || row.number,
      [
        ...(row.partyName ? [{ text: row.number }] : []),
        { text: formatBusinessDate(row.documentDate) },
        { text: t(`reports.gst.issue.${row.issueCode}`), tone: 'error', wrap: true },
      ],
      null,
      t
    );
