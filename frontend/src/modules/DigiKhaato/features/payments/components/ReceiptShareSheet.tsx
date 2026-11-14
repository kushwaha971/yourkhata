'use client';

import { UbShareSheet, UbText } from 'src/design-system';
import { useShareFeedback } from 'src/hooks/useShareFeedback';
import { useShareSheetLabels } from 'src/hooks/useShareSheetLabels';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatAmount } from 'src/utils/money';

import type { PaymentDirection } from '../types/payment.types';

/**
 * 08 §10.2 — the receipt's message, as the receipt page and the drawer's saved
 * panel both open it: what is being shared, the honest line (we open their
 * app, they press Send), and the server's editable text.
 */
export function ReceiptShareSheet({
  number,
  amount,
  direction,
  name,
  text,
  mobile,
  onClose,
}: Readonly<{
  number: string;
  amount: string;
  direction: PaymentDirection;
  /** The party's name, or `null` for a Quick Sale. */
  name: string | null;
  text: string;
  mobile: string | null;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const labels = useShareSheetLabels();
  const feedback = useShareFeedback();
  return (
    <UbShareSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('payments.receipt.share')}
      description={t(`payments.receipt.shareAbout.${direction}`, {
        number,
        amount: formatAmount(amount),
        name: name ?? t('payments.list.quickSale'),
      })}
      notice={
        <UbText variant="caption" tone="secondary">
          {t('payments.receipt.shareHonest')}
        </UbText>
      }
      message={text}
      phone={mobile}
      labels={labels}
      onShared={feedback.onShared}
      onFailed={feedback.onFailed}
    />
  );
}
