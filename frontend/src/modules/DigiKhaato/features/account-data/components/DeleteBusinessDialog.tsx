'use client';

import { useCallback, useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import {
  UbButton,
  UbOtpInput,
  UbDialog,
  UbField,
  UbForm,
  UbStack,
  UbText,
  UbTextArea,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectSessionUser } from 'src/redux/slice/sessionSlice';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { formatPhoneForDisplay } from 'src/utils/share';

import { requestDeleteCode } from '../redux/accountDataThunk';
import {
  DELETE_REASON_MAX,
  useAccountDataSchemas,
  type DeleteBusinessFormValues,
} from '../validation/accountDataSchemas';

import type { UseAccountDataResult } from '../hooks/useAccountData';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/auth';
import 'src/i18n/catalogues/dataStatus';
import 'src/i18n/catalogues/validation';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).

const FIELDS: readonly string[] = ['password', 'code', 'confirmName', 'reason'];

/**
 * PLT-10 FRD §6/§7 — the deletion confirmation. `dynamic()`-loaded by the page:
 * the form, its resolver and the schema belong in the chunk that OPENS them.
 *
 * It states exactly what happens and when (TSK-PLT-10-05), requires the
 * business name typed back, and re-verifies the owner: by PASSWORD, or — for
 * an owner who signs in with a mobile code and has none (owner, 15 Nov 2026) —
 * by a six-digit code sent to their own mobile. The export gate is enforced before this
 * dialog can open; the server enforces it again.
 */
export function DeleteBusinessDialog({
  data,
  open,
  onClose,
}: Readonly<{
  data: UseAccountDataResult;
  open: boolean;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const businessName = data.deletion?.businessName ?? '';
  const coolOff = data.deletion?.coolOffDays ?? 30;
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectSessionUser);
  const byCode = user?.hasPassword === false;
  const [challenge, setChallenge] = useState<{ id: string; length: number } | null>(null);
  const [sending, setSending] = useState(false);
  const { deleteBusinessSchema } = useAccountDataSchemas(businessName, !byCode);

  const form = useForm<DeleteBusinessFormValues>({
    resolver: yupResolver(deleteBusinessSchema),
    mode: 'onTouched',
    defaultValues: { password: '', code: '', confirmName: '', reason: '' },
  });
  const { setError, reset } = form;

  const submit = useCallback(
    async (values: DeleteBusinessFormValues) => {
      const refusal = await data.submitDeletion({
        ...(byCode ? { challengeId: challenge?.id ?? '', code: values.code } : { password: values.password }),
        confirmName: values.confirmName,
        reason: values.reason.trim(),
      });
      if (refusal === null) {
        reset();
        onClose();
        return;
      }
      applyServerErrors(refusal, setError, FIELDS, t);
    },
    [byCode, challenge, data, onClose, reset, setError, t]
  );

  const sendCode = useCallback(async () => {
    setSending(true);
    const result = await dispatch(requestDeleteCode());
    setSending(false);
    if (requestDeleteCode.fulfilled.match(result)) {
      setChallenge({ id: result.payload.challengeId, length: result.payload.codeLength });
    } else {
      setError('code', { message: t('data.delete.code.sendError') });
    }
  }, [dispatch, setError, t]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose]
  );

  return (
    <UbDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('data.delete.dialog.title')}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            variant="destructive"
            busy={data.isDeleting}
            busyLabel={t('data.delete.dialog.submitting')}
            disabled={!data.canWrite}
          >
            {t('data.delete.dialog.submit')}
          </UbButton>
        </>
      }
    >
      <UbStack gap={4}>
        <UbStack as="ul" gap={2} className="list-disc pl-5">
          <UbText as="li" variant="body-sm">
            {t('data.delete.consequence.readOnly')}
          </UbText>
          <UbText as="li" variant="body-sm">
            {t('data.delete.consequence.coolOff', { days: coolOff })}
          </UbText>
          <UbText as="li" variant="body-sm">
            {t('data.delete.consequence.removed')}
          </UbText>
          <UbText as="li" variant="body-sm">
            {t('data.delete.consequence.gst')}
          </UbText>
        </UbStack>
        <UbForm id={formId} form={form} onSubmit={submit}>
          <UbField
            name="confirmName"
            label={t('data.delete.confirm.label', { name: businessName })}
            placeholder={businessName}
            required
          >
            {(field) => <UbTextInput {...field} autoComplete="off" maxLength={200} />}
          </UbField>
{byCode ? (
            <UbStack gap={2}>
              <UbText variant="body-sm" tone="secondary">
                {t('data.delete.code.why')}
              </UbText>
              {challenge ? (
                <UbField
                  name="code"
                  label={t('data.delete.code.label', { mobile: formatPhoneForDisplay(user?.mobile ?? '') })}
                  controlOwnsLabel
                  required
                >
                  {(field) => (
                    <UbOtpInput
                      length={challenge.length}
                      id={field.id}
                      value={(field.value as string) ?? ''}
                      onChange={field.onChange}
                      invalid={field.invalid}
                      label={t('data.delete.code.label', { mobile: formatPhoneForDisplay(user?.mobile ?? '') })}
                      cellLabel={(index, total) => t('auth.otp.cell', { index, total })}
                      describedBy={field['aria-describedby']}
                    />
                  )}
                </UbField>
              ) : (
                <UbButton variant="secondary" busy={sending} onClick={() => void sendCode()}>
                  {t('data.delete.code.send')}
                </UbButton>
              )}
            </UbStack>
          ) : (
                    <UbField
            name="password"
            label={t('data.delete.password.label')}
            placeholder={t('data.delete.password.placeholder')}
            required
          >
            {(field) => (
              <UbTextInput
                {...field}
                type="password"
                autoComplete="current-password"
                revealLabel={t('auth.password.show')}
                hideLabel={t('auth.password.hide')}
              />
            )}
          </UbField>
          )}
          <UbField
            name="reason"
            label={t('data.delete.reason.label')}
            placeholder={t('data.delete.reason.placeholder')}
          >
            {(field) => <UbTextArea {...field} rows={2} maxLength={DELETE_REASON_MAX} />}
          </UbField>
        </UbForm>
      </UbStack>
    </UbDialog>
  );
}
