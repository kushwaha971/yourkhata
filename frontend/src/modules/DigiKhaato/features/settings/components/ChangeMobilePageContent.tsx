'use client';

import { useEffect, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import {
  UbButton,
  UbField,
  UbForm,
  UbOtpInput,
  UbPanel,
  UbPhoneInput,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatPhoneForDisplay } from 'src/utils/share';

import type { OtpChallenge } from 'modules/DigiKhaato/features/auth/types/auth.types';
import { useAuthSchemas } from 'modules/DigiKhaato/features/auth/validation/authSchemas';

import { confirmMobileChange, requestMobileChange } from '../redux/myMobileThunk';

import { SettingsFrame } from './SettingsFrame';

/** `42` → `0:42`, as the sign-in screen's resend timer reads. */
const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Design settings-and-profile S2 › "Change mobile number" (owner-approved 14
 * Nov 2026). The mobile is how this person signs in, so it moves only after a
 * code sent on WhatsApp to the NEW number is typed back. Step 1 asks for the
 * number; step 2 for the code, with the same six boxes and paste as sign-in.
 * Nothing changes until the code is right; the businesses and data stay.
 */
export function ChangeMobilePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const schemas = useAuthSchemas();
  const [challenge, setChallenge] = useState<(OtpChallenge & { readonly mobile: string }) | null>(
    null
  );
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const mobileForm = useForm<{ mobile: string }>({
    resolver: yupResolver(schemas.otpMobileSchema),
    mode: 'onTouched',
    defaultValues: { mobile: '' },
  });
  const codeLength = challenge?.codeLength ?? 6;
  const codeSchema = useMemo(() => schemas.otpCodeSchema(codeLength), [schemas, codeLength]);
  const codeForm = useForm<{ code: string }>({
    resolver: yupResolver(codeSchema),
    mode: 'onSubmit',
    defaultValues: { code: '' },
  });
  const codeLabel = t('auth.otp.codeLabel', { length: codeLength });

  const send = async ({ mobile }: { mobile: string }): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const result = await dispatch(requestMobileChange({ mobile }));
    setBusy(false);
    if (requestMobileChange.fulfilled.match(result)) {
      setChallenge({ ...result.payload, mobile });
      setWait(result.payload.retryAfter);
      codeForm.reset({ code: '' });
    } else {
      const code = result.payload?.code;
      mobileForm.setError('mobile', {
        message: t(
          code === 'mobile_taken'
            ? 'settings.me.mobileTaken'
            : code === 'mobile_unchanged'
              ? 'settings.me.mobileSame'
              : 'settings.me.mobileSendError'
        ),
      });
    }
  };

  const confirm = async ({ code }: { code: string }): Promise<void> => {
    if (!challenge || busy) return;
    setBusy(true);
    const result = await dispatch(
      confirmMobileChange({ challengeId: challenge.challengeId, code })
    );
    setBusy(false);
    if (confirmMobileChange.fulfilled.match(result)) {
      dispatch(showSnackbar({ severity: 'success', id: 'settings.me.mobileChanged' }));
      router.replace(ROUTES.SETTINGS_ME);
    } else {
      codeForm.reset({ code: '' });
      codeForm.setError('code', { message: t('settings.me.codeWrong') });
    }
  };

  return (
    <SettingsFrame page="me" title={t('settings.me.changeMobile')}>
      <UbPanel className="p-4">
        <UbStack gap={4}>
          <UbText as="span" variant="caption" tone="tertiary">
            {t('settings.me.step', { step: challenge ? 2 : 1 })}
          </UbText>
          {challenge ? (
            <UbForm form={codeForm} onSubmit={confirm}>
              <UbText variant="body">
                {t('settings.me.codeSentTo', { mobile: formatPhoneForDisplay(challenge.mobile) })}
              </UbText>
              <UbField name="code" label={codeLabel} controlOwnsLabel required>
                {(field) => (
                  <UbOtpInput
                    length={codeLength}
                    id={field.id}
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onComplete={(code) => {
                      codeForm.setValue('code', code);
                      void codeForm.handleSubmit(confirm)();
                    }}
                    invalid={field.invalid}
                    readOnly={busy}
                    autoFocus
                    label={codeLabel}
                    cellLabel={(index, total) => t('auth.otp.cell', { index, total })}
                    describedBy={field['aria-describedby']}
                  />
                )}
              </UbField>
              <UbStack direction="row" justify="between" align="center" gap={2} wrap>
                {wait > 0 ? (
                  <UbText variant="body-sm" tone="tertiary" aria-live="polite">
                    {t('auth.otp.resendIn', { time: clock(wait) })}
                  </UbText>
                ) : (
                  <UbButton
                    variant="ghost"
                    size="sm"
                    busy={busy}
                    onClick={() => void send({ mobile: challenge.mobile })}
                  >
                    {t('auth.otp.resend')}
                  </UbButton>
                )}
                <UbButton
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setChallenge(null)}
                >
                  {t('settings.me.otherNumber')}
                </UbButton>
              </UbStack>
              <UbPanel className="bg-surface-sunken p-3">
                <UbText variant="body-sm" tone="secondary">
                  {t('settings.me.mobileAfter')}
                </UbText>
              </UbPanel>
              <UbButton type="submit" fullWidth busy={busy}>
                {t('settings.me.changeNumber')}
              </UbButton>
            </UbForm>
          ) : (
            <UbForm form={mobileForm} onSubmit={send}>
              <UbField
                name="mobile"
                label={t('settings.me.newMobile')}
                placeholder={t('auth.otp.mobilePlaceholder')}
                required
              >
                {(field) => <UbPhoneInput {...field} autoComplete="tel-national" />}
              </UbField>
              <UbButton type="submit" fullWidth busy={busy}>
                {t('settings.me.sendCode')}
              </UbButton>
            </UbForm>
          )}
        </UbStack>
      </UbPanel>
    </SettingsFrame>
  );
}
