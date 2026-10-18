'use client';

import { Check, Copy, Phone } from 'lucide-react';

import {
  UbAmount,
  UbBox,
  UbButton,
  UbCard,
  UbLink,
  UbStack,
  UbStatusBadge,
  UbTagList,
  UbText,
} from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { compareMoney, subtractMoney } from 'src/utils/money';
import { formatPhoneForDisplay, toDialableNumber } from 'src/utils/share';

import { balanceView } from '../view-model/partyDisplay';
import { toTagListItems } from '../view-model/partyTagDisplay';

import type { Party } from '../types/party.types';

/** Shop identity and independent role balances. Never composes a net position. */
export function ShopPersonOverview({
  party,
  fallbackBalance,
  supplier = false,
  t,
  pending,
  onCopy,
  copied,
  roleLabels,
}: Readonly<{
  party: Party;
  fallbackBalance: string;
  supplier?: boolean;
  t: TranslateFn;
  pending: boolean;
  onCopy: (mobile: string) => void;
  copied: boolean;
  roleLabels?: readonly { readonly code: string; readonly label: string }[];
}>): React.JSX.Element {
  const value = supplier
    ? (party.shop?.supplierBalance ?? subtractMoney('0', fallbackBalance))
    : (party.shop?.customerBalance ?? fallbackBalance);
  const direction = compareMoney(value, '0');
  const label =
    direction === 0
      ? 'settled'
      : direction > 0
        ? supplier
          ? 'pay'
          : 'receive'
        : supplier
          ? 'supplierAdvance'
          : 'credit';
  return (
    <UbBox data-testid="shop-person-overview">
      <UbCard padded={false} className="overflow-hidden">
        <UbStack direction="row" align="center" justify="between" wrap gap={4} className="p-4">
          <UbStack gap={2} className="min-w-0 flex-1">
            <UbStack direction="row" align="center" gap={2} wrap>
              <UbText variant="caption" tone="tertiary">
                {t('parties.list.shop.book')}
              </UbText>
              {party.displayCode && (
                <UbText variant="caption" tone="tertiary">
                  {party.displayCode}
                </UbText>
              )}
              {roleLabels?.map((role) => (
                <UbStatusBadge key={role.code} label={role.label} tone="info" />
              ))}
              {pending && (
                <UbText variant="caption" tone="tertiary">
                  {t('common.loading')}
                </UbText>
              )}
            </UbStack>
            {party.mobile && (
              <UbStack direction="row" align="center" gap={2} wrap>
                <UbLink
                  href={`tel:${toDialableNumber(party.mobile)}`}
                  className="inline-flex items-center gap-2 whitespace-normal break-words"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  {formatPhoneForDisplay(party.mobile)}
                </UbLink>
                <UbButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={
                    copied ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )
                  }
                  onClick={() => onCopy(party.mobile ?? '')}
                >
                  {t(copied ? 'parties.detail.copied' : 'parties.detail.copy')}
                </UbButton>
              </UbStack>
            )}
            {party.tags.length > 0 && (
              <UbTagList
                tags={toTagListItems(party.tags)}
                label={t('parties.tags.listLabel', { name: party.name })}
                max={party.tags.length}
                overflowLabel={(count) => t('parties.tags.overflow', { count })}
              />
            )}
          </UbStack>
          <UbStack gap={2} className="min-w-0" role="status" aria-busy={pending || undefined}>
            <UbText variant="body-sm-medium">{t(`parties.person.${label}`)}</UbText>
            <UbAmount
              value={value}
              sign="none"
              label={t(`parties.person.${label}`)}
              labelHidden
              size="lg"
              tone={balanceView(supplier ? subtractMoney('0', value) : value).tone}
              className="self-start"
            />
          </UbStack>
        </UbStack>
      </UbCard>
    </UbBox>
  );
}
