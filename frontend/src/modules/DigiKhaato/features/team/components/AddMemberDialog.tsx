'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbDialog,
  UbField,
  UbForm,
  UbOtpInput,
  UbPhoneInput,
  UbStack,
  UbText,
  UbSelect,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';
import { formatPhoneForDisplay } from 'src/utils/share';

import { sendStaffCode } from '../api/memberService';
import { DEFAULT_INVITE_ROLE } from '../constants/teamDefaults';
import { useRoles } from '../hooks/useRoles';
import { useMemberSchemas } from '../validation/memberSchemas';
import { roleOptionLabel } from '../view-model/roleDisplay';

import type { UseMembersResult } from '../hooks/useMembers';
import type { StaffCodeSent } from '../types/member.types';
import type { AddMemberFormValues } from '../validation/memberSchemas';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/team';
import 'src/i18n/catalogues/validation';

/**
 * The add-member form (DEC-012).
 *
 * ── Why this asks for a name and the invite form does not ───────────────────
 * An invitation is addressed to a person who will fill in their own details
 * when they accept. Here the owner is creating the account outright, so nobody
 * else is going to supply the name — and a team list of bare email addresses is
 * unreadable the moment there are four of them, which is precisely when an
 * owner starts needing the list.
 *
 * `mobile` is optional and is a channel, never an identity (DEC-010). It is
 * here because the owner is about to WhatsApp this person their password and
 * may as well record the number while they are thinking about it.
 *
 * The submit lives in the dialog's FOOTER via `form={formId}`, like every other
 * dialog in the product.
 */
export function AddMemberDialog({
  members,
}: Readonly<{ members: UseMembersResult }>): React.JSX.Element {
  const { t } = useTranslation();
  // A13: roles from `GET /roles` (module roles of enabled modules included),
  // fetched when the dialog first opens.
  const roles = useRoles(members.addOpen);
  const roleCodes = useMemo(() => roles.assignable.map((role) => role.code), [roles.assignable]);
  const { addMemberSchema } = useMemberSchemas(roleCodes);
  const formId = useId();

  const defaults = useMemo(() => ({ fullName: '', role: DEFAULT_INVITE_ROLE, mobile: '' }), []);

  const form = useForm<AddMemberFormValues>({
    resolver: yupResolver(addMemberSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  });

  const { reset, setError } = form;
  const { addOpen, closeAdd, submitAdd } = members;
  const dispatch = useAppDispatch();

  // Owner, 12 Nov 2026: the new staff member confirms their number with a code
  // sent to it (WhatsApp, or SMS where that is the login channel). They read it
  // out; the owner types it here; the member is added only with it.
  const mobile = useWatch({ control: form.control, name: 'mobile' }) ?? '';
  const [sent, setSent] = useState<(StaffCodeSent & { readonly mobile: string }) | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(0);
  const sentHere = sent !== null && sent.mobile === mobile;
  const codeReady = sentHere && code.length === sent.codeLength;

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const sendCode = useCallback(async () => {
    const valid = await form.trigger('mobile');
    if (!valid || !mobile) return;
    setSending(true);
    try {
      const issued = await sendStaffCode(mobile);
      setSent({ ...issued, mobile });
      setCode('');
      setWait(issued.retryAfter);
    } catch (thrown) {
      const error = toApiError(thrown, 'team.member.code.sendError');
      dispatch(showSnackbar({ severity: 'error', message: error.message ?? t('team.member.code.sendError') }));
    } finally {
      setSending(false);
    }
  }, [dispatch, form, mobile, t]);

  /**
   * Cleared when the dialog OPENS, not when it closes: clearing on close races
   * the closing animation and blanks the fields while they are still on screen,
   * and throws away what was typed if a stray backdrop tap dismissed it.
   */
  useEffect(() => {
    if (addOpen) reset(defaults);
  }, [addOpen, reset, defaults]);
  // A fresh dialog has sent no code: reset while rendering the opening, which
  // React allows for state derived from a prop (no effect, no extra pass).
  const [seenOpen, setSeenOpen] = useState(addOpen);
  if (seenOpen !== addOpen) {
    setSeenOpen(addOpen);
    if (addOpen) {
      setSent(null);
      setCode('');
      setWait(0);
    }
  }

  const submit = useCallback(
    (values: AddMemberFormValues) =>
      sent && sentHere ? submitAdd(values, setError, { challengeId: sent.challengeId, code }) : Promise.resolve(),
    [submitAdd, setError, sent, sentHere, code]
  );

  const roleOptions = useMemo(
    () => roles.assignable.map((role) => ({ value: role.code, label: roleOptionLabel(t, role) })),
    [roles.assignable, t]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeAdd();
    },
    [closeAdd]
  );

  return (
    <UbDialog
      open={addOpen}
      onOpenChange={handleOpenChange}
      title={t('team.member.add.title')}
      description={t('team.member.add.body')}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={closeAdd} disabled={members.isAdding}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            busy={members.isAdding}
            busyLabel={t('team.member.add.submitting')}
            disabled={!members.canWrite || !codeReady}
          >
            {t('team.member.add.submit')}
          </UbButton>
        </>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={members.addFormErrors}>
        <UbField
          name="fullName"
          label={t('team.member.name.label')}
          placeholder={t('team.member.name.placeholder')}
          hint={t('team.member.name.hint')}
          required
        >
          {(field) => <UbTextInput {...field} autoComplete="off" />}
        </UbField>

        {/* The way they sign in (owner, 9 Oct 2026): a code is texted to this
            number, so it is required and Indian — the sign-in code is sent in India
            only, hence `lockCountry`. `UbPhoneInput`, as on the party form:
            the merchant types ten digits and the schema wants E.164 (UAT D4). */}
        <UbField
          name="mobile"
          label={t('team.member.mobile.label')}
          placeholder={t('team.member.mobile.placeholder')}
          hint={t('team.member.mobile.hint')}
          required
        >
          {(field) => <UbPhoneInput {...field} lockCountry autoComplete="off" />}
        </UbField>

        <UbStack gap={2} data-testid="staff-code">
          {sentHere ? (
            <>
              <UbText variant="body-sm" tone="secondary">
                {t(sent.channel === 'whatsapp' ? 'team.member.code.sentWhatsapp' : 'team.member.code.sentSms', {
                  mobile: formatPhoneForDisplay(sent.mobile),
                })}
              </UbText>
              <UbOtpInput
                length={sent.codeLength}
                value={code}
                onChange={setCode}
                label={t('team.member.code.label')}
                cellLabel={(index, total) => t('team.member.code.cell', { index, total })}
                autoFocus
              />
              <UbButton variant="ghost" size="sm" onClick={() => void sendCode()} disabled={wait > 0} busy={sending} className="self-start">
                {wait > 0 ? t('team.member.code.resendIn', { seconds: wait }) : t('team.member.code.resend')}
              </UbButton>
            </>
          ) : (
            <>
              <UbButton variant="secondary" onClick={() => void sendCode()} busy={sending} busyLabel={t('team.member.code.sending')} className="self-start">
                {t('team.member.code.send')}
              </UbButton>
              <UbText variant="caption" tone="tertiary">
                {t('team.member.code.why')}
              </UbText>
            </>
          )}
        </UbStack>

        <UbField
          name="role"
          label={t('team.member.role.label')}
          placeholder={t('team.member.role.placeholder')}
          required
        >
          {(field) => (
            <UbSelect
              {...field}
              options={roleOptions}
              placeholder={t('team.member.role.placeholder')}
            />
          )}
        </UbField>
      </UbForm>
    </UbDialog>
  );
}
