'use client';

import { ReasonConfirmDialog } from 'src/components/records/ReasonConfirmDialog';
import { UbActionLink, UbStack, UbStatusBanner, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES, partyPath } from 'src/routes';
import type { ApiErrorShape } from 'src/types/api.types';
import { formatInr } from 'src/utils/money';

import { shortLines, supplierName, voidConsequences } from '../view-model/purchaseBillDisplay';

import type { PurchaseBill } from '../types/purchase.types';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/money';
import 'src/i18n/catalogues/purchases';

/**
 * PUR-04 FR-3 / §7 — "Void PB/26-27/0007?", with the consequences listed
 * BEFORE the reason is typed (AC-2): the stock each line takes back out, the
 * khata effect in the supplier's terms, and any payment that becomes an
 * advance. The confirm is outlined, never filled red (§8, Koper rule).
 *
 * A refusal is shown here, where the merchant is looking: goods already sold
 * read "Rice would go to −8 NOS" (AC-4), and the fix is named. The two refusals
 * that need another screen first (§6 States) carry the way there: a standing
 * debit note links to that note, an archived supplier to their page (Restore).
 *
 * Deliberately absent: FR-4's "Average cost unchanged". CR-2026-09-24-INV-A
 * made the void remove the value the bill blended in, so it does change.
 *
 * The dialog is `ReasonConfirmDialog` (WP-03 D-04c).
 */
export function PurchaseBillVoidDialog({
  bill,
  busy,
  error,
  onClose,
  onConfirm,
}: Readonly<{
  bill: PurchaseBill;
  busy: boolean;
  error: ApiErrorShape | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const consequences = voidConsequences(bill);
  const short = error?.code === 'insufficient_stock' ? shortLines(error.details) : [];
  const blocker = voidBlocker(bill, error, t);

  return (
    <ReasonConfirmDialog
      title={t('purchases.void.title', { number: bill.number ?? '' })}
      confirmLabel={t('purchases.void.confirm')}
      workingLabel={t('purchases.void.working')}
      reasonLabel={t('purchases.void.reason')}
      reasonPlaceholder={t('purchases.void.reasonPlaceholder')}
      requiredMessageId="purchases.void.reasonRequired"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmTestId="purchase-void-confirm"
    >
      <UbStack gap={1} data-testid="purchase-void-consequences">
        <UbText variant="caption" tone="tertiary">
          {t('purchases.void.consequencesTitle')}
        </UbText>
        {consequences.stock.length > 0 && (
          <UbText variant="body-sm">
            {t('purchases.void.stock', {
              items: consequences.stock
                .map((line) => `${line.qty} ${line.unit} ${line.name}`)
                .join(', '),
            })}
          </UbText>
        )}
        {consequences.khata && (
          <UbText variant="body-sm">
            {t('purchases.void.khata', {
              amount: formatInr(consequences.khata),
              name: supplierName(bill),
            })}
          </UbText>
        )}
        {consequences.advance && (
          <UbText variant="body-sm">
            {t('purchases.void.advance', { amount: formatInr(consequences.advance) })}
          </UbText>
        )}
      </UbStack>
      {short.length > 0 && (
        <UbStatusBanner
          tone="error"
          title={t('purchases.void.shortTitle')}
          description={`${short
            .map((line) =>
              t('purchases.void.shortLine', { name: line.name, qty: line.after, unit: line.unit })
            )
            .join(' · ')} ${t('purchases.void.shortFix')}`}
        />
      )}
      {blocker && (
        <UbStatusBanner
          tone="error"
          title={blocker.title}
          action={
            blocker.href ? (
              <UbActionLink
                href={blocker.href}
                variant="secondary"
                size="sm"
                data-testid="purchase-void-blocker-link"
              >
                {blocker.label}
              </UbActionLink>
            ) : undefined
          }
        />
      )}
      {error && !blocker && error.code !== 'insufficient_stock' && (
        <UbStatusBanner tone="error" title={error.message} />
      )}
    </ReasonConfirmDialog>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * The void refusals whose fix is on another screen, in the merchant's words and with
 * the link there. The numbers are the SERVER's (`details.documents`), never re-derived
 * from what this page holds, which may be stale.
 */
const voidBlocker = (
  bill: PurchaseBill,
  error: ApiErrorShape | null,
  t: Translate
): { title: string; href: string | null; label: string } | null => {
  if (error?.code === 'has_dependent_documents') {
    const raw = (error.details as { documents?: unknown } | null)?.documents;
    const numbers = Array.isArray(raw) ? raw.map(String) : [];
    const first = bill.links.debitNotes.find((dn) => dn.number && numbers.includes(dn.number));
    return {
      title: t('purchases.void.notesFirst', { numbers: numbers.join(', ') }),
      href: first ? `${ROUTES.DEBIT_NOTES}/${first.id}` : null,
      label: t('purchases.void.openNote'),
    };
  }
  if (error?.code === 'party_archived') {
    return {
      title: t('purchases.void.archived'),
      href: bill.party ? partyPath(bill.party.id, 'supplier') : null,
      label: t('purchases.void.openSupplier'),
    };
  }
  return null;
};
