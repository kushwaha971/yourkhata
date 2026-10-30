'use client';

import { UbField, UbRadioGroup, UbStack, UbSwitch, UbText } from 'src/design-system';
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
          variant="card"
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
      <UbText as="h3" variant="body-sm-medium">
        {t('onboarding.other.needsTitle')}
      </UbText>
      <UbText as="p" variant="caption" tone="tertiary">
        {t('onboarding.other.needsBody')}
      </UbText>
      {SIGNUP_FEATURES.map((key) => (
        <UbSwitch
          key={key}
          checked={Boolean(features?.[key])}
          onCheckedChange={(on) =>
            onFeatures({ ...(features ?? {}), [key]: on })
          }
          label={t(`onboarding.other.feature.${key}`)}
          description={t(`onboarding.other.feature.${key}.hint`)}
        />
      ))}
    </UbStack>
  </UbStack>
  );
}
