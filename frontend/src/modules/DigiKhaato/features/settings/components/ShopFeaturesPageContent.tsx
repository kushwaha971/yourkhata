'use client';

import { useCallback } from 'react';

import {
  UbBox,
  UbButton,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbShopKindIcon,
  UbSkeleton,
  UbStack,
  UbSwitch,
  UbText,
  type UbShopKind,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { useAppWords } from 'modules/DigiKhaato/features/navigation/useAppWords';

import { useSettingsAccess } from '../hooks/useSettingsAccess';
import { useTenantSettings } from '../hooks/useTenantSettings';

/**
 * B3 — Settings › Shop features (design `dFeatures` / `pFeatures`, R-DEC-65).
 *
 * The fallback for support staff and the rare owner who wants to change
 * things: what the business sells, "I also sell wholesale", and one line and
 * one switch per feature. Turning one off hides its rows and fields; the data
 * stays. The server owns every value (`shop.wholesale`, `shop.features.*`);
 * saving refreshes the session, so the menu follows at once.
 *
 * Only the switches whose screens exist are listed (owner's choice pending,
 * option 1): a switch that changes nothing teaches a merchant the product is
 * broken. Each later feature adds its row the day its fields ship.
 */
const FEATURE_ROWS = [
  { key: 'orders', labelId: 'settings.shop.feature.orders', hintId: 'settings.shop.feature.orders.hint' },
] as const;

const isOn = (value: unknown): boolean =>
  Boolean((value as { value?: boolean } | undefined)?.value);

export function ShopFeaturesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { kindLabel, kindPicture } = useAppWords();
  const access = useSettingsAccess();
  const settings = useTenantSettings(access.canView);
  const { data, status, error, refetch } = settings;
  const values = data?.values ?? {};
  const busy = settings.savingSection !== null || !settings.canWrite || !access.canEdit;

  const setWholesale = useCallback(
    (on: boolean) =>
      // A business that starts selling wholesale needs orders and challans
      // too (design E2 #6); turning wholesale off leaves them as they are.
      void settings.saveSection('shop', {
        'shop.wholesale': { value: on },
        ...(on ? { 'shop.features.orders': { value: true } } : {}),
      }),
    [settings]
  );
  const setFeature = useCallback(
    (key: string, on: boolean) =>
      void settings.saveSection('shop', { [`shop.features.${key}`]: { value: on } }),
    [settings]
  );

  const header = (
    <UbPageHeader title={t('settings.shop.title')} subtitle={t('settings.shop.subtitle')} />
  );

  let body: React.ReactNode;
  if (status === 'failed') {
    body = (
      <UbEmptyState
        variant="error"
        title={t('settings.error.title')}
        description={error?.message ?? t('settings.error.body')}
        action={
          <UbButton variant="secondary" onClick={refetch}>
            {t('common.action.retry')}
          </UbButton>
        }
      />
    );
  } else if (!data) {
    body = <UbSkeleton variant="form" count={3} />;
  } else {
    body = (
      <UbStack gap={4}>
        <UbPanel>
          <UbStack gap={3} className="p-4">
            <UbText as="h2" variant="body-medium">
              {t('settings.shop.whatYouSell')}
            </UbText>
            {kindLabel && (
              // Design `.chp.on`: a 34 px teal pill with the kind's picture.
              <UbBox className="inline-flex h-[34px] items-center gap-1.5 self-start rounded-full border border-action bg-accent-quiet px-3.5 text-text-accent">
                {kindPicture && (
                  <UbShopKindIcon kind={kindPicture as UbShopKind} className="h-4 w-4" />
                )}
                <UbText as="span" variant="body-sm-medium">
                  {kindLabel}
                </UbText>
              </UbBox>
            )}
            <UbSwitch
              checked={isOn(values['shop.wholesale'])}
              onCheckedChange={setWholesale}
              disabled={busy}
              label={t('settings.shop.wholesale')}
              description={t('settings.shop.wholesale.hint')}
            />
            <UbText as="p" variant="caption" tone="tertiary">
              {t('settings.shop.whatYouSell.note')}
            </UbText>
          </UbStack>
        </UbPanel>
        <UbStack gap={1}>
          <UbText as="h2" variant="body-medium">
            {t('settings.shop.features')}
          </UbText>
          <UbText as="p" variant="caption" tone="tertiary">
            {t('settings.shop.features.note')}
          </UbText>
        </UbStack>
        <UbPanel>
          <UbStack gap={0} className="divide-y divide-border-subtle">
            {FEATURE_ROWS.map((row) => (
              <UbSwitch
                key={row.key}
                className="min-h-16 px-4 py-3"
                checked={isOn(values[`shop.features.${row.key}`])}
                onCheckedChange={(on) => setFeature(row.key, on)}
                disabled={busy}
                label={t(row.labelId)}
                description={t(row.hintId)}
              />
            ))}
          </UbStack>
        </UbPanel>
      </UbStack>
    );
  }

  return (
    <UbPageShell header={header} width="measure">
      {access.canView ? body : null}
    </UbPageShell>
  );
}
