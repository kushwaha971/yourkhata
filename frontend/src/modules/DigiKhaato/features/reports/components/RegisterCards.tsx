'use client';

import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import { bandTotal, isCreditRow, isVoidRow } from '../view-model/registerDisplay';

import { ReportCardBands, type ReportCard } from './ReportCardBands';

import type { RegisterLevel, RegisterRow } from '../types/taxReports.types';

/**
 * 09 §10.3/§10.4 on a phone — the register as cards under a band per date,
 * the band carrying that day's total. By bill, a card is the customer or
 * supplier, the bill's number (and Credit note or Cancelled when it is one),
 * and its total; by item, the item, the bill it was on, and the line's total.
 * The tax breakup — taxable, CGST, SGST, IGST, cess, round-off, GSTIN, place
 * of supply — is in the row sheet a tap opens, so the card stays three things
 * (§10.0) instead of the wide table scrolled sideways inside a phone.
 */
export function RegisterCards({
  rows,
  level,
  t,
  locale,
  continuesBefore,
  continuesAfter,
  onOpenRow,
}: Readonly<{
  rows: readonly RegisterRow[];
  level: RegisterLevel;
  t: TranslateFn;
  locale: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
  onOpenRow: (row: RegisterRow) => void;
}>): React.JSX.Element {
  const card = (row: RegisterRow): ReportCard => {
    const party = row.partyName || (row.isWalkIn ? t('reports.register.walkIn') : '—');
    const what = level === 'line' ? row.itemName || '—' : party;
    const flags = [
      ...(isVoidRow(row)
        ? [{ text: t('reports.register.badge.void'), tone: 'error' as const }]
        : []),
      ...(!isVoidRow(row) && isCreditRow(row)
        ? [{ text: t('reports.register.badge.creditNote') }]
        : []),
    ];
    const word = t(
      level === 'line' ? 'reports.register.column.lineTotal' : 'reports.register.card.total'
    );
    return {
      what,
      which: [
        { text: row.number, testId: 'register-row-number' },
        // A line with no name on its bill says nothing rather than "· —".
        ...(level === 'line' && party !== '—' ? [{ text: party }] : []),
        ...flags,
      ],
      // A credit note's total is negative and reads in the error tone; the
      // minus is in the figure and the words, never the colour alone.
      amount: { word, value: row.grandTotal, tone: isCreditRow(row) ? 'error' : 'primary' },
      struck: isVoidRow(row),
      label: t('reports.register.open', {
        name: [
          what,
          row.number,
          ...flags.map((flag) => flag.text),
          `${word} ${formatInrUnbroken(row.grandTotal)}`,
        ].join(' · '),
      }),
    };
  };
  return (
    <ReportCardBands
      rows={rows}
      locale={locale}
      card={card}
      band={(group, partial) =>
        t(partial ? 'reports.register.band.partial' : 'reports.register.band.total', {
          amount: formatInrUnbroken(bandTotal(group)),
        })
      }
      continuesBefore={continuesBefore}
      continuesAfter={continuesAfter}
      onOpen={onOpenRow}
      testId="register"
    />
  );
}
