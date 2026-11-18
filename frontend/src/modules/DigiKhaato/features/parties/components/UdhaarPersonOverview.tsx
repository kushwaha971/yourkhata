'use client';

import { memo } from 'react';

import { Check, Copy, Phone } from 'lucide-react';

import { UbAmount, UbAvatar, UbButton, UbLink, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatPhoneForDisplay, toDialableNumber } from 'src/utils/share';

import { balanceView } from '../view-model/partyDisplay';


/** Udhaar's identity and money, without another app's customer/supplier roles. */
export const UdhaarPersonOverview = memo(function UdhaarPersonOverview({
  t, name, mobile, balance, asOf, pending, copied, onCopy,
}: Readonly<{
  t: TranslateFn;
  name: string;
  mobile: string | null;
  balance: string;
  asOf?: string | null;
  pending: boolean;
  copied: boolean;
  onCopy: (mobile: string) => void;
}>) {
  const view = balanceView(balance);
  return (
    <UbStack gap={1} data-testid="udhaar-person-overview" className="rounded-card border border-border-hairline bg-surface-card p-3 md:p-4">
      <UbStack gap={2}>
        <UbStack direction="row" align="center" gap={2} className="min-w-0">
          <UbAvatar name={name} />
          {mobile && (
            <UbStack direction="row" align="center" gap={2} className="min-w-0">
              <UbLink href={`tel:${toDialableNumber(mobile)}`} variant="body-sm" className="ub-hit break-words">
                <Phone className="mr-1 inline h-4 w-4" aria-hidden />
                {formatPhoneForDisplay(mobile)}
              </UbLink>
              <UbButton variant="ghost" size="sm" iconOnly onClick={() => onCopy(toDialableNumber(mobile))} icon={copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}>
                {t(copied ? 'parties.detail.copied' : 'parties.detail.copy')}
              </UbButton>
            </UbStack>
          )}
        </UbStack>
        <UbStack direction="row" align="center" justify="between" gap={2} wrap role="status" aria-live="polite" aria-busy={pending}>
          <UbText variant="caption" tone="secondary">{t(view.labelId)}</UbText>
          <UbAmount value={balance} tone={view.tone} label={t(view.labelId)} labelHidden size="md" inline />
        </UbStack>
      </UbStack>
      {asOf && <UbText variant="caption" tone="tertiary">{t('parties.detail.balance.asOf', { date: asOf })}</UbText>}
    </UbStack>
  );
});
