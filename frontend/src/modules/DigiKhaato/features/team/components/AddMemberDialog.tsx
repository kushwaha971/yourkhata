'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbDialog,
  UbField,
  UbForm,
  UbPhoneInput,
  UbSelect,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import { getAccessGroups } from '../api/accessGroupService';
import { DEFAULT_INVITE_ROLE } from '../constants/teamDefaults';
import { useRoles } from '../hooks/useRoles';
import { useTeamApp } from '../hooks/useTeamApp';
import { useMemberSchemas } from '../validation/memberSchemas';
import { accessSummary } from '../view-model/accessSummary';
import { roleOptionLabel } from '../view-model/roleDisplay';

import type { UseMembersResult } from '../hooks/useMembers';
import type { AccessGroupsPayload } from '../types/accessGroup.types';
import type { AddMemberFormValues } from '../validation/memberSchemas';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/team';
import 'src/i18n/catalogues/teamAccess';
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

  // Owner, 14 Nov 2026 — added from inside the open app, in one of its groups
  // (the default one already chosen). No app open: as before, no group.
  const teamApp = useTeamApp();
  const business = useAppSelector(selectActiveTenant)?.name ?? '';
  const [groups, setGroups] = useState<AccessGroupsPayload | null>(null);
  useEffect(() => {
    if (!members.addOpen || !teamApp) return undefined;
    const controller = new AbortController();
    getAccessGroups(teamApp.code, controller.signal)
      .then(setGroups)
      .catch(() => undefined);
    return () => controller.abort();
  }, [members.addOpen, teamApp]);
  const defaultGroup = groups?.groups.find((g) => g.isDefault)?.id ?? 'none';

  const defaults = useMemo(() => ({ fullName: '', role: DEFAULT_INVITE_ROLE, mobile: '', groupId: 'none' }), []);

  const form = useForm<AddMemberFormValues>({
    resolver: yupResolver(addMemberSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  });

  const { reset, setError } = form;
  const { addOpen, closeAdd, submitAdd } = members;

  /**
   * Cleared when the dialog OPENS, not when it closes: clearing on close races
   * the closing animation and blanks the fields while they are still on screen,
   * and throws away what was typed if a stray backdrop tap dismissed it.
   */
  useEffect(() => {
    if (addOpen) reset(defaults);
  }, [addOpen, reset, defaults]);

  // The groups arrive after the form opens. Only the group field takes the
  // default, and only if the owner has not chosen one: resetting the form here
  // erased the name and number already typed (found by e2e/access-groups.mjs).
  const { getFieldState, setValue } = form;
  useEffect(() => {
    if (!getFieldState('groupId').isDirty) setValue('groupId', defaultGroup);
  }, [defaultGroup, getFieldState, setValue]);

  const role = useWatch({ control: form.control, name: 'role' });
  const groupChoice = useWatch({ control: form.control, name: 'groupId' });
  const selectedGroup = groups?.groups.find((g) => g.id === groupChoice) ?? null;

  const submit = useCallback(
    (values: AddMemberFormValues) => submitAdd(values, setError),
    [submitAdd, setError]
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
            disabled={!members.canWrite}
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

        {/* The way they sign in: a code sent to this number on WhatsApp. Any
            country, India first (owner, 14 Nov 2026). `UbPhoneInput`, as on the
            party form: the merchant types the number and the schema wants E.164. */}
        <UbField
          name="mobile"
          label={t('team.member.mobile.label')}
          placeholder={t('team.member.mobile.placeholder')}
          hint={t('team.member.mobile.hint')}
          required
        >
          {(field) => <UbPhoneInput {...field} autoComplete="off" />}
        </UbField>

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

        {/* Owner, 14 Nov 2026 — the open app's group (admins are never in one). */}
        {teamApp && groups && groups.groups.length > 0 && role !== 'admin' && (
          <UbField
            name="groupId"
            label={t('team.access.group')}
            hint={
              selectedGroup
                ? accessSummary(t, groups.parts, selectedGroup.levels)
                : t('team.access.noGroupHint', { app: teamApp.label })
            }
          >
            {(field) => (
              <UbSelect
                {...field}
                options={[
                  { value: 'none', label: t('team.access.noGroup') },
                  ...groups.groups.map((g) => ({
                    value: g.id,
                    label: g.isDefault ? t('team.access.defaultOption', { name: g.name }) : g.name,
                  })),
                ]}
              />
            )}
          </UbField>
        )}
        {teamApp && (
          <UbText as="p" variant="caption" tone="secondary" data-testid="add-member-app-note">
            {t('team.access.addNote', { app: teamApp.label, business })}
          </UbText>
        )}
      </UbForm>
    </UbDialog>
  );
}
