'use client';

import { UbField, UbPanel, UbRadioGroup, UbStack, UbSwitch, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import {
  OTHER_KINDS,
  SIGNUP_FEATURES,
  type OtherKind,
  type SignupFeature,
} from '../constants/businessTypes';

/**
 * R-DEC-66 / design G12 — Other: "What kind of shop?" and "Anything your shop
 * needs?", below the tiles like "Wholesale of what?", with no new screen
 * (owner, 30 Oct). Picking a kind starts the switches from that kind; the
 * owner can change any of them. Rendered inside step 1's form, so the radio
 * group is that form's `businessType` field.
 *
 * Both answers are the design's `.lst`: one bordered box with a line between
 * rows (`.opt` for the kinds, `.li` with a switch at min-height 60 for the
 * needs), not a stack of separate cards — which is also what keeps this long
 * phone step from growing by another screen when Other is tapped.
 */
export function OtherKindSection({
  features,
  onFeatures,
  featuresFor,
}: Readonly<{
  features: Partial<Record<SignupFeature, boolean>> | undefined;
  onFeatures: (next: Partial<Record<SignupFeature, boolean>>) => void;
  featuresFor: (kind: OtherKind) => Record<SignupFeature, boolean>;
}>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbStack gap={4}>
      <UbField
        name="businessType"
        label={t('onboarding.other.kindTitle')}
        description={t('onboarding.other.kindBody')}
      >
        {(field) => (
          <UbRadioGroup<OtherKind>
            name="otherKind"
            variant="list"
            value={(field.value as OtherKind) || 'other'}
            onChange={(kind) => {
              field.onChange(kind);
              onFeatures(featuresFor(kind));
            }}
            ariaLabel={t('onboarding.other.kindTitle')}
            describedBy={field['aria-describedby']}
            options={OTHER_KINDS.map((kind) => ({
              value: kind,
              label: t(`onboarding.other.kind.${kind}`),
              hint: t(`onboarding.other.kind.${kind}.hint`),
            }))}
          />
        )}
      </UbField>
      <UbStack gap={2}>
        <UbText as="h3" variant="body-medium">
          {t('onboarding.other.needsTitle')}
        </UbText>
        <UbText as="p" variant="caption" tone="tertiary">
          {t('onboarding.other.needsBody')}
        </UbText>
        <UbPanel className="mt-1">
          <UbStack gap={0} className="divide-y divide-border-subtle">
            {SIGNUP_FEATURES.map((key) => (
              <UbSwitch
                key={key}
                className="min-h-[60px] px-4 py-3"
                checked={Boolean(features?.[key])}
                onCheckedChange={(on) => onFeatures({ ...(features ?? {}), [key]: on })}
                label={t(`onboarding.other.feature.${key}`)}
                description={t(`onboarding.other.feature.${key}.hint`)}
              />
            ))}
          </UbStack>
        </UbPanel>
      </UbStack>
    </UbStack>
  );
}
