'use client';

import { useCallback, useMemo } from 'react';


import { yupResolver } from '@hookform/resolvers/yup';
import { ChevronRight } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useAccountActions, THEME_MODES } from 'src/components/layout/useAccountActions';
import {
  UbAvatar,
  UbBox,
  UbButton,
  UbField,
  UbLink,
  UbPanel,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { useValidationSchemas } from 'src/hooks/useValidationSchemas';
import { selectActiveRole, selectActiveTenant, selectSessionTenants } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatPhoneForDisplay } from 'src/utils/share';

import { manifestFor } from 'modules/appManifests';
import { saveMyProfile } from 'modules/DigiKhaato/features/auth/redux/sessionThunk';

import { SettingsFrame } from './SettingsFrame';

interface ProfileForm {
  readonly fullName: string;
}

/**
 * Design settings-and-profile S2 (owner-approved 14 Nov 2026) — Your profile.
 *
 * Only for the person signed in, whatever their role in this business: their
 * name, their language and look, which place opens when they sign in, the
 * businesses they belong to with their role in each, their devices, sign out.
 * The language and look apply at once (they are a tap, not a form); the name
 * waits for Save. The mobile is the sign-in and is shown, not edited here.
 */
export function MyProfilePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requiredText } = useValidationSchemas();
  const { user, locale, options, setLocale, theme, setTheme, signOut } = useAccountActions();
  const role = useAppSelector(selectActiveRole);
  const active = useAppSelector(selectActiveTenant);
  const tenants = useAppSelector(selectSessionTenants);

  const schema = useMemo(
    () => Yup.object({ fullName: requiredText(120, 'settings.me.nameRequired') }),
    [requiredText]
  );
  const form = useForm<ProfileForm>({
    resolver: yupResolver(schema),
    mode: 'onTouched',
    values: { fullName: user?.name ?? '' },
  });

  const onSave = form.handleSubmit(async ({ fullName }) => {
    try {
      await dispatch(saveMyProfile({ fullName })).unwrap();
      dispatch(showSnackbar({ severity: 'success', id: 'settings.me.saved' }));
    } catch {
      dispatch(showSnackbar({ severity: 'error', id: 'settings.me.saveError' }));
    }
  });

  const onLanguage = useCallback(
    (next: string) => {
      setLocale(next);
      void dispatch(saveMyProfile({ locale: next }));
    },
    [dispatch, setLocale]
  );

  const opens = tenants.find((row) => row.isDefault) ?? null;
  const opensLabel = opens
    ? [opens.primaryApp ? t(manifestFor(opens.primaryApp)?.labelId ?? opens.primaryApp) : null, opens.name]
        .filter(Boolean)
        .join(' · ')
    : '';
  const roleWord = (code: string | null | undefined) => (code ? t(`tenant.role.${code}`) : '');

  return (
    <SettingsFrame page="me" title={t('settings.me.title')}>
        <UbPanel className="p-4">
          <UbStack direction="row" gap={4} align="center">
            <UbAvatar name={user?.name ?? ''} size="md" />
            <UbStack gap={0.5} className="min-w-0">
              <UbText as="span" variant="h3" className="break-words">
                {user?.name}
              </UbText>
              <UbText as="span" variant="caption" tone="tertiary">
                {t('settings.me.roleAt', { role: roleWord(role), business: active?.name ?? '' })}
              </UbText>
            </UbStack>
          </UbStack>
        </UbPanel>

        <UbPanel as="section" className="p-4" aria-label={t('settings.me.about')}>
          <FormProvider {...form}>
          <UbStack as="form" gap={3} noValidate onSubmit={onSave}>
            <UbText as="h2" variant="body-medium">
              {t('settings.me.about')}
            </UbText>
            <UbField
              name="fullName"
              label={t('settings.me.name')}
              placeholder={t('settings.me.namePlaceholder')}
              required
            >
              {(field) => <UbTextInput {...field} maxLength={120} />}
            </UbField>
            <UbStack gap={1}>
              <UbText as="span" variant="label">
                {t('settings.me.mobile')}
              </UbText>
              <UbBox className="flex min-h-11 items-center gap-3 rounded-md border border-border-hairline bg-surface-sunken px-3">
                <UbText as="span" variant="body" tone={user?.mobile ? 'primary' : 'tertiary'} className="flex-1">
                  {user?.mobile ? formatPhoneForDisplay(user.mobile) : t('settings.me.noMobile')}
                </UbText>
                <UbLink href={ROUTES.SETTINGS_ME_MOBILE} className="flex min-h-11 items-center">
                  {t('settings.me.change')}
                </UbLink>
              </UbBox>
              {user?.mobile ? (
                <UbText as="span" variant="caption" tone="tertiary">
                  {t('settings.me.mobileHint')}
                </UbText>
              ) : null}
            </UbStack>
            <UbBox className="flex justify-end">
              <UbButton type="submit" variant="primary" busy={form.formState.isSubmitting}>
                {t('settings.me.save')}
              </UbButton>
            </UbBox>
          </UbStack>
          </FormProvider>
        </UbPanel>

        <UbPanel as="section" className="p-4" aria-label={t('settings.me.app')}>
          <UbStack gap={3}>
            <UbStack gap={0.5}>
              <UbText as="h2" variant="body-medium">
                {t('settings.me.app')}
              </UbText>
              <UbText as="span" variant="caption" tone="tertiary">
                {t('settings.me.appHint')}
              </UbText>
            </UbStack>
            <UbStack gap={1}>
              <UbText as="span" variant="label" id="me-language">
                {t('settings.me.language')}
              </UbText>
              <UbSelect
                aria-label={t('settings.me.language')}
                value={locale}
                onChange={onLanguage}
                options={options}
              />
            </UbStack>
            <UbStack gap={1}>
              <UbText as="span" variant="label">
                {t('settings.me.look')}
              </UbText>
              <UbSelect
                aria-label={t('settings.me.look')}
                value={theme}
                onChange={(next) => setTheme(next as (typeof THEME_MODES)[number])}
                options={THEME_MODES.map((mode) => ({ value: mode, label: t(`settings.me.look.${mode}`) }))}
              />
            </UbStack>
            <UbLink
              href={ROUTES.APPS}
              variant="inherit"
              underline={false}
              className="flex min-h-14 items-center gap-3 border-t border-border-subtle pt-3"
            >
              <UbStack gap={0.5} className="min-w-0 flex-1">
                <UbText as="span" variant="body-medium">
                  {t('settings.me.opens')}
                </UbText>
                <UbText as="span" variant="caption" tone="tertiary" className="break-words">
                  {opensLabel}
                </UbText>
              </UbStack>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
            </UbLink>
          </UbStack>
        </UbPanel>

        <UbPanel as="section" className="p-4" aria-label={t('settings.me.businesses')}>
          <UbStack gap={2}>
            <UbText as="h2" variant="body-medium">
              {t('settings.me.businesses')}
            </UbText>
            <UbStack as="ul" gap={0}>
              {tenants
                .filter((row) => (row.status ?? 'active') === 'active')
                .map((row) => (
                  <UbBox
                    as="li"
                    key={row.id}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-border-subtle last:border-0"
                  >
                    <UbText as="span" variant="body" className="min-w-0 break-words">
                      {row.name}
                    </UbText>
                    <UbText as="span" variant="body-sm" tone="secondary" className="shrink-0">
                      {roleWord(row.role)}
                    </UbText>
                  </UbBox>
                ))}
            </UbStack>
          </UbStack>
        </UbPanel>

        <UbPanel className="p-4">
          <UbStack as="ul" gap={0}>
            <UbBox as="li" className="border-b border-border-subtle">
              <UbLink
                href={ROUTES.SETTINGS_DEVICES}
                variant="inherit"
                underline={false}
                className="flex min-h-14 items-center gap-3"
              >
                <UbText as="span" variant="body-medium" className="flex-1">
                  {t('settings.me.devices')}
                </UbText>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
              </UbLink>
            </UbBox>
            <UbBox as="li">
              <UbButton variant="ghost" className="min-h-14 w-full justify-start px-0 text-error" onClick={() => void signOut()}>
                {t('settings.me.signOut')}
              </UbButton>
            </UbBox>
          </UbStack>
        </UbPanel>
    </SettingsFrame>
  );
}
