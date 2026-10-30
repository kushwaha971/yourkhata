'use client';

import { useCallback, useMemo } from 'react';

import dynamic from 'next/dynamic';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';


import {
  UbCombobox,
  UbDivider,
  UbField,
  UbForm,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';

import { SHOP_APP } from '../constants/appChoices';
import {
  OTHER_KINDS,
  OTHER_KIND_FEATURES,
  SIGNUP_FEATURES,
  WHOLESALE_TILE,
  type BusinessType,
  type OtherKind,
  type SignupFeature,
} from '../constants/businessTypes';
import { GST_STATES } from '../constants/gstStates';
import { useOnboardingSchemas } from '../validation/onboardingSchemas';

import { AppChoiceGrid } from './AppChoiceGrid';
import { BusinessTypeGrid } from './BusinessTypeGrid';
import { OnboardingStepActions } from './OnboardingStepActions';
import { OnboardingStepCard } from './OnboardingStepCard';

import type { UseOnboardingResult } from '../hooks/useOnboarding';
import type { BusinessStepFormValues } from '../validation/onboardingSchemas';

/* G12's section loads when Other is tapped: most shops never open it, and the
   sign-up route is the first thing every new merchant downloads (+4 KB when it
   was static). */
const OtherKindSection = dynamic(
  () => import('./OtherKindSection').then((m) => m.OtherKindSection),
  { ssr: false }
);

/**
 * PLT-03 FR-2 — step 1: business name, owner name (BR-7, only when blank), the
 * nine-tile type grid and the state.
 *
 * This is the step that CREATES the tenant, which is why it is the only one
 * without a Skip: a wizard cannot patch a business that does not exist yet.
 *
 * CR-2026-09-19-D — this is also where the name that used to be asked on the
 * sign-up screen now lands. BR-7 always said step 1 would ask again when
 * `platform_user.full_name` is blank; removing it from sign-up simply makes
 * this the only place it is asked. It is the one optional field among three
 * required ones here, so it is the one that is marked — which is the whole
 * argument for marking the minority rather than starring the majority.
 */
export function OnboardingBusinessStep({
  onboarding,
}: Readonly<{ onboarding: UseOnboardingResult }>): React.JSX.Element {
  const { t } = useTranslation();
  const locale = useAppSelector(selectLocale);
  const schemas = useOnboardingSchemas();

  const form = useForm<BusinessStepFormValues>({
    resolver: yupResolver(schemas.businessStepSchema),
    mode: 'onTouched',
    defaultValues: {
      name: onboarding.draft.name,
      businessType: onboarding.draft.businessType ?? '',
      sellsWholesale: onboarding.draft.sellsWholesale ?? false,
      apps: initialApps(onboarding),
      stateCode: onboarding.draft.stateCode ?? '',
      ownerName: onboarding.draft.ownerName,
    },
  });

  const stateOptions = useMemo(
    () => GST_STATES.map((state) => ({ value: state.code, label: state[locale] })),
    [locale]
  );

  const { setError } = form;
  const chosenApps = useWatch({ control: form.control, name: 'apps' });
  const runsShop = chosenApps.includes(SHOP_APP);
  const sellsWholesale = useWatch({ control: form.control, name: 'sellsWholesale' });
  const pickedType = useWatch({ control: form.control, name: 'businessType' });
  const features = useWatch({ control: form.control, name: 'features' });
  // R-DEC-66: Other and its kinds (Stationery, Agri, Services, Furniture).
  const setFeatures = useCallback(
    (next: Partial<Record<SignupFeature, boolean>>) =>
      form.setValue('features', next, { shouldDirty: true }),
    [form]
  );
  const isOtherFamily = (OTHER_KINDS as readonly string[]).includes(pickedType || '');

  const submit = useCallback(
    (values: BusinessStepFormValues) => onboarding.submitBusinessStep(values, setError),
    [onboarding, setError]
  );

  return (
    <OnboardingStepCard
      title={t('onboarding.step1.title')}
      description={t('onboarding.step1.body')}
    >
      <UbForm form={form} onSubmit={submit} formErrors={onboarding.formErrors}>
        {/* ── CR-2026-09-19-F: the two real inputs are their own group ───────
            Nine tiles in a 3×3 grid against two lone fields above them is a
            step that looks like a tile picker with some typing attached. The
            fields that name the business — what it is called, who runs it, and
            the state its bills are taxed in — are one group on their own
            surface, and the tiles are a labelled SECTION beneath, with a
            divider between the two. The state moved up into the group: it is a
            select, not a tile, and it was the field stranded under the grid. */}
        <UbStack gap={4} className="rounded-card border border-border-subtle p-4 sm:p-5">
          <UbField
            name="name"
            label={t('onboarding.name.label')}
            placeholder={t('onboarding.name.placeholder')}
            required
          >
            {/* `autoComplete="off"`, not `"organization"`.
                That token means "the company this person belongs to", so Chrome
                offered its saved address-book entries — and because the field is
                also autofocused, the list opened on page load with no gesture,
                covering the form underneath. Reported as autofill overlapping
                the screen.
                It was also simply the wrong token: the merchant is NAMING a new
                business here, not recalling an existing employer, so every
                suggestion Chrome had was guaranteed to be wrong. The autofocus
                stays — first field of a wizard is where the cursor belongs. */}
            {(field) => <UbTextInput {...field} autoComplete="off" autoFocus />}
          </UbField>

          {/* BR-7 — asked here only when `platform_user.full_name` is still
              blank, which is the case for a sign-up that left the optional name
              field empty (CR-2026-09-19-A) or an invited member who never
              filled it. */}
          {onboarding.needsOwnerName && (
            <UbField
              name="ownerName"
              label={t('onboarding.ownerName.label')}
              placeholder={t('onboarding.ownerName.placeholder')}
              optionalLabel={t('common.field.optional')}
            >
              {(field) => <UbTextInput {...field} autoComplete="name" />}
            </UbField>
          )}

          <UbField
            name="stateCode"
            label={t('onboarding.state.label')}
            placeholder={t('onboarding.state.placeholder')}
            hint={t('onboarding.state.hint')}
            required
          >
            {(field) => (
              <UbCombobox
                {...field}
                options={stateOptions}
                placeholder={t('onboarding.state.placeholder')}
                searchPlaceholder={t('onboarding.state.search')}
                emptyLabel={t('onboarding.state.empty')}
              />
            )}
          </UbField>
        </UbStack>

        <UbDivider decorative />

        {/* Owner, 11 Oct 2026 — the question this step never asked. Every
            business was given the Shop, and a library was told (in the hint
            under the shop tiles) to add its own app "from the business menu"
            afterwards. It is asked here, of everybody, from the server's own
            list; more than one may be ticked and none is ticked for them. */}
        {onboarding.offeredApps && (
          <UbField
            name="apps"
            label={t('onboarding.apps.label')}
            hint={t('onboarding.apps.hint')}
            required
          >
            {(field) => (
              <AppChoiceGrid
                apps={onboarding.offeredApps ?? []}
                value={(field.value as string[] | undefined) ?? []}
                onChange={field.onChange}
                describedBy={field['aria-describedby']}
                ariaLabel={t('onboarding.apps.label')}
              />
            )}
          </UbField>
        )}

        {/* The kind of shop sets the Shop's starting defaults and nothing
            else, so it is asked only of a business that ticked the Shop. */}
        {runsShop && (
          <UbField
            // While "Wholesale of what?" is open the kind is asked below, so its
            // error belongs there and not under these tiles.
            name={sellsWholesale ? 'sellsWholesale' : 'businessType'}
            label={t('onboarding.pick.title')}
            description={t('onboarding.pick.body')}
            required
          >
            {(field) => (
              <BusinessTypeGrid
                // R-DEC-64: the Wholesale tile is lit while its question is open;
                // the kind itself is answered underneath.
                value={
                  sellsWholesale
                    ? WHOLESALE_TILE
                    : isOtherFamily
                      ? 'other'
                      : (field.value as BusinessType | '') || ''
                }
                onChange={(kind) => {
                  if (kind === WHOLESALE_TILE) {
                    form.setValue('sellsWholesale', true, { shouldDirty: true });
                    form.setValue('businessType', '');
                    return;
                  }
                  form.setValue('sellsWholesale', false, { shouldDirty: true });
                  // Tapping Other again keeps the kind already picked below it.
                  if (kind === 'other' && isOtherFamily) return;
                  form.setValue('businessType', kind, { shouldValidate: true });
                  form.setValue('features', kind === 'other' ? featuresFor('other') : undefined);
                }}
                invalid={field.invalid}
                describedBy={field['aria-describedby']}
                ariaLabel={t('onboarding.pick.title')}
              />
            )}
          </UbField>
        )}
        {/* Design v7 (pPick / dPick): the line under the tiles. The phone
            says where a second, different shop goes; the desktop says what
            Wholesale does next. */}
        {runsShop && (
          <>
            <UbText as="p" variant="caption" tone="tertiary" className="text-[12.5px] md:hidden">
              {t('onboarding.pick.oneKindPhone')}
            </UbText>
            <UbText as="p" variant="caption" tone="tertiary" className="hidden text-[12.5px] md:block">
              {t('onboarding.pick.oneKindDesktop')}
            </UbText>
          </>
        )}
        {/* R-DEC-66 / design G12 — Other: "What kind of shop?" and "Anything
            your shop needs?", below the tiles like "Wholesale of what?", with
            no new screen (owner, 30 Oct). Picking a kind starts the switches
            from that kind; the owner can change any of them. */}
        {runsShop && !sellsWholesale && isOtherFamily && (
          <OtherKindSection features={features} onFeatures={setFeatures} featuresFor={featuresFor} />
        )}
        {/* R-DEC-64 — "Wholesale of what?": one kind, sold wholesale. Its
            features are that kind's and wholesale's together. */}
        {runsShop && sellsWholesale && (
          <UbField
            name="businessType"
            label={t('onboarding.pick.wholesaleTitle')}
            description={t('onboarding.pick.wholesaleBody')}
            required
          >
            {(field) => (
              <BusinessTypeGrid
                value={(pickedType as BusinessType | '') || ''}
                onChange={field.onChange}
                exclude={[WHOLESALE_TILE]}
                invalid={field.invalid}
                describedBy={field['aria-describedby']}
                ariaLabel={t('onboarding.pick.wholesaleTitle')}
              />
            )}
          </UbField>
        )}

        <OnboardingStepActions
          onBack={null}
          continueLabel={t('common.action.continue')}
          busyLabel={t('onboarding.creating')}
          backLabel={t('common.action.back')}
          skipLabel={t('onboarding.skip')}
          busy={onboarding.isSubmitting}
          disabled={!onboarding.canSubmit}
        />
      </UbForm>
    </OnboardingStepCard>
  );
}

/** G12: the four switches as one kind starts them. */
const featuresFor = (kind: OtherKind): Record<SignupFeature, boolean> =>
  Object.fromEntries(
    SIGNUP_FEATURES.map((key) => [key, OTHER_KIND_FEATURES[kind].includes(key)])
  ) as Record<SignupFeature, boolean>;

/**
 * What step 1 opens with ticked.
 *
 * A choice already made (this wizard, or read back after a reload) is shown
 * as made. With one app on offer there is nothing to choose, so it is taken.
 * With no offer at all the step asks no question and the business is a Shop,
 * as before the choice existed. Otherwise NOTHING is ticked: the point of the
 * question is that nobody is handed an app they did not ask for.
 */
const initialApps = (onboarding: UseOnboardingResult): string[] => {
  const offered = onboarding.offeredApps;
  if (!offered) return [SHOP_APP];
  const codes = offered.map((app) => app.code);
  const drafted = (onboarding.draft.apps ?? []).filter((code) => codes.includes(code));
  if (drafted.length > 0) return drafted;
  return codes.length === 1 ? [...codes] : [];
};
