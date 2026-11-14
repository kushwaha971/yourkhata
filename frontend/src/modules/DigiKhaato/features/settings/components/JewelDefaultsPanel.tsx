'use client';

import { useState } from 'react';

import {
  UbBox,
  UbButton,
  UbMoneyInput,
  UbPanel,
  UbQuantityInput,
  UbSegmentedControl,
  UbStack,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import type { JewelDefaults } from '../../inventory/api/metalRateService';

const BLANK: JewelDefaults = {
  making_type: 'pct',
  making_value: '',
  wastage_pct: '',
  wastage_limit_pct: '',
  pan_limit: '200000.00',
};

/**
 * The design's jeweller row in Settings: making default, wastage limit, PAN
 * limit. New tags start from the first two, a new karigar from the limit, and
 * the bill offers its PAN box from the last. Nothing here stops a bill.
 */
export function JewelDefaultsPanel({
  values,
  disabled,
  onSave,
}: Readonly<{
  values: JewelDefaults | undefined;
  disabled: boolean;
  onSave: (next: JewelDefaults) => Promise<boolean>;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<JewelDefaults>(values ?? BLANK);
  const set = (patch: Partial<JewelDefaults>) => setDraft((d) => ({ ...d, ...patch }));
  const labelled = (label: string, input: React.ReactNode) => (
    <UbStack gap={1} className="min-w-0">
      <UbText as="label" variant="body-sm-medium">
        {label}
      </UbText>
      {input}
    </UbStack>
  );

  return (
    <UbPanel>
      <UbStack gap={3} className="p-4" data-testid="jewel-defaults">
        <UbText as="h2" variant="body-medium" className="font-semibold">
          {t('settings.shop.jewel.title')}
        </UbText>
        {labelled(
          t('settings.shop.jewel.making'),
          <UbBox className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            {draft.making_type === 'per_g' ? (
              <UbMoneyInput
                aria-label={t('settings.shop.jewel.making')}
                value={draft.making_value}
                onChange={(next) => set({ making_value: next })}
              />
            ) : (
              <UbQuantityInput
                aria-label={t('settings.shop.jewel.making')}
                value={draft.making_value}
                onChange={(next) => set({ making_value: next })}
                decimals={2}
              />
            )}
            <UbSegmentedControl<'pct' | 'per_g'>
              value={draft.making_type}
              onChange={(next) => set({ making_type: next })}
              options={[
                { value: 'pct', label: '%' },
                { value: 'per_g', label: t('settings.shop.jewel.perGram') },
              ]}
              ariaLabel={t('settings.shop.jewel.makingType')}
            />
          </UbBox>
        )}
        <UbBox className="grid grid-cols-2 gap-3">
          {labelled(
            t('settings.shop.jewel.wastage'),
            <UbQuantityInput
              aria-label={t('settings.shop.jewel.wastage')}
              value={draft.wastage_pct}
              onChange={(next) => set({ wastage_pct: next })}
              decimals={2}
              unit="%"
            />
          )}
          {labelled(
            t('settings.shop.jewel.wastageLimit'),
            <UbQuantityInput
              aria-label={t('settings.shop.jewel.wastageLimit')}
              value={draft.wastage_limit_pct}
              onChange={(next) => set({ wastage_limit_pct: next })}
              decimals={2}
              unit="%"
            />
          )}
        </UbBox>
        {labelled(
          t('settings.shop.jewel.panLimit'),
          <UbMoneyInput
            aria-label={t('settings.shop.jewel.panLimit')}
            value={draft.pan_limit}
            onChange={(next) => set({ pan_limit: next })}
          />
        )}
        <UbText variant="caption" tone="tertiary">
          {t('settings.shop.jewel.panHint')}
        </UbText>
        <UbButton className="self-start" disabled={disabled} onClick={() => void onSave(draft)}>
          {t('settings.shop.jewel.save')}
        </UbButton>
      </UbStack>
    </UbPanel>
  );
}
