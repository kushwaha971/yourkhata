import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import { bucketLabelId, oldestBucket } from './agingDisplay';

import type { ReportCard } from '../../reports/components/ReportCardRow';
import type { AgingKind, AgingRow } from '../types/aging.types';

/**
 * 09 §10.7 on a phone — the Shop's Old dues as cards of three things: who, how
 * old the oldest money is (the bucket a merchant acts on, in red once it is
 * past 90 days), and the total due with the word that says which way it goes.
 *
 * The server sends buckets, not the age of the oldest entry, so the card says
 * "90+ days" rather than "oldest 74 days"; a day count made up on the client
 * from a bucket edge would be a number nobody stated.
 */
export const agingDueWord = (t: TranslateFn, kind: AgingKind): string =>
  t(kind === 'payable' ? 'ledger.aging.card.youOwe' : 'ledger.aging.card.owesYou');

export const agingCard = (t: TranslateFn, kind: AgingKind, row: AgingRow): ReportCard => {
  const oldest = oldestBucket(row.amounts);
  const which: ReportCard['which'] = oldest
    ? [
        {
          // The whole balance in one bucket says only how old it is; otherwise
          // how much of it is that old (audit A16).
          text:
            oldest.amount === row.amounts.total
              ? t(bucketLabelId(oldest.bucket))
              : t('ledger.aging.oldest', {
                  amount: formatInrUnbroken(oldest.amount),
                  bucket: t(bucketLabelId(oldest.bucket)),
                }),
          testId: 'aging-card-bucket',
          ...(oldest.bucket === '90_plus' ? { tone: 'error' as const } : {}),
        },
      ]
    : [];
  const word = agingDueWord(t, kind);
  return {
    what: row.partyName,
    which,
    amount: { word, value: row.amounts.total, tone: kind === 'payable' ? 'error' : 'success' },
    struck: false,
    label: t('ledger.aging.card.open', {
      name: [row.partyName, ...which.map((piece) => piece.text)].join(' · '),
      word,
      amount: formatInrUnbroken(row.amounts.total),
    }),
  };
};
