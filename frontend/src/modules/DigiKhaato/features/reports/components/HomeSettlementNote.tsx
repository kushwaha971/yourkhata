'use client';

import { useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  UbBox,
  UbButton,
  UbDialogLoading,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import type { SettlementCandidates } from '../../payments/settlement/types/shopSettlement.types';

import 'src/i18n/catalogues/homeSettlement';

const SettleDialog = dynamic(
  () =>
    import('../../payments/settlement/components/SettleBalancesDialog').then(
      (m) => m.SettleBalancesDialog
    ),
  { ssr: false,
  loading: () => <UbDialogLoading /> }
);

/**
 * BP-08 — Counter Mode's "bothnote" under the two lanes: "Ramesh Traders is in
 * both lists. They owe you ₹1,000 as a customer and you owe them ₹600 as a
 * supplier. These stay separate until you settle them. Settle…"
 *
 * The lanes never net the two (D-03); this note is where the merchant learns the
 * same person sits in both, and the one place Home offers to settle. It names the
 * person with the most to settle; the rest are counted, not listed.
 */
export function HomeSettlementNote({
  candidates,
  canSettle,
  onSettled,
}: Readonly<{
  candidates: SettlementCandidates;
  canSettle: boolean;
  onSettled: () => void;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /* Home re-reads only once the message sheet closes: a refresh while it is open
     could replace this note, and the sheet with it, mid-share. */
  const settled = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const first = candidates.results[0];
  if (!first) return null;
  const more = candidates.count - 1;
  return (
    <UbBox
      className="border-border-default col-span-2 rounded-card border border-dashed bg-surface-card px-3 py-2.5"
      data-testid="home-settlement-note"
    >
      <UbText variant="body-sm">
        <UbText as="span" variant="inherit" className="font-semibold">
          {t('homeSettlement.title', { name: first.name })}
        </UbText>{' '}
        {t('homeSettlement.body', {
          owed: formatInr(first.customerBalance),
          owing: formatInr(first.supplierBalance),
        })}
        {more > 0 && ` ${t('homeSettlement.more', { count: more })}`}
      </UbText>
      {canSettle && (
        <UbButton
          ref={opener}
          variant="link"
          size="sm"
          className="ub-hit mt-1 h-auto px-0 font-semibold [&>span]:underline [&>span]:underline-offset-2"
          aria-label={t('homeSettlement.actionLabel', { name: first.name })}
          onClick={() => setOpen(true)}
          data-testid="home-settlement-open"
        >
          {t('homeSettlement.action')}
        </UbButton>
      )}
      {open && (
        <SettleDialog
          partyId={first.partyId}
          onClose={() => {
            setOpen(false);
            if (settled.current) {
              settled.current = false;
              onSettled();
            }
          }}
          onSettled={() => {
            settled.current = true;
          }}
          returnFocusRef={opener}
        />
      )}
    </UbBox>
  );
}
