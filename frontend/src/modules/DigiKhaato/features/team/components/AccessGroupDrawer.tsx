'use client';

import { useId, useState } from 'react';

import {
  UbButton,
  UbDrawer,
  UbFieldError,
  UbStack,
  UbStatusBadge,
  UbSwitch,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';

import { createAccessGroup, deleteAccessGroup, updateAccessGroup } from '../api/accessGroupService';

import { PartLevelRow } from './PartLevelRow';

import type { TeamApp } from '../hooks/useTeamApp';
import type { AccessGroup, AccessLevel, AccessPart } from '../types/accessGroup.types';

// Loaded with dynamic(), so its own words come with its own chunk.
import 'src/i18n/catalogues/team';
import 'src/i18n/catalogues/teamAccess';

/**
 * Make or change an access group (design G2): a name, the default switch and
 * the open app's parts. Saving a group with members says how many change,
 * because every one of them changes at once. A group with members is not
 * deleted; the server says so and the drawer stays open.
 */
export function AccessGroupDrawer({
  app,
  business,
  parts,
  group,
  start,
  onClose,
  onSaved,
}: Readonly<{
  app: TeamApp;
  business: string;
  parts: readonly AccessPart[];
  /** The group being changed, or null for a new one. */
  group: AccessGroup | null;
  /** A new group's starting name and levels (the ready-made example, or all Full). */
  start: { name: string; levels: Readonly<Record<string, AccessLevel>> };
  onClose: () => void;
  onSaved: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [name, setName] = useState(group?.name ?? start.name);
  const [isDefault, setIsDefault] = useState(group?.isDefault ?? false);
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({ ...(group?.levels ?? start.levels) });
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const formId = useId();

  const save = async (): Promise<void> => {
    if (busy) return;
    if (!name.trim()) {
      setNameError(t('team.access.nameRequired'));
      return;
    }
    setBusy('save');
    try {
      const draft = { name: name.trim(), isDefault, levels };
      if (group) await updateAccessGroup(group.id, draft);
      else await createAccessGroup(app.code, draft);
      dispatch(
        showSnackbar({
          severity: 'success',
          message: group ? t('team.access.saved', { name: draft.name, count: group.members }) : t('team.access.made', { name: draft.name }),
        })
      );
      onSaved();
    } catch (e) {
      const error = toApiError(e, 'team.access.error');
      const field = (error.details as { name?: string[] } | undefined)?.name?.[0];
      if (field) setNameError(t('team.access.nameTaken'));
      else dispatch(showSnackbar({ severity: 'error', message: t('team.access.error') }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (): Promise<void> => {
    if (!group || busy) return;
    setBusy('delete');
    try {
      await deleteAccessGroup(group.id);
      dispatch(showSnackbar({ severity: 'success', message: t('team.access.deleted', { name: group.name }) }));
      onSaved();
    } catch (e) {
      const error = toApiError(e, 'team.access.error');
      dispatch(
        showSnackbar({
          severity: 'error',
          message: error.code === 'group_has_members' ? t('team.access.hasMembers', { count: group.members }) : t('team.access.error'),
        })
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && !busy && onClose()}
      title={group ? group.name : t('team.access.new')}
      description={group ? t('team.access.membersIn', { count: group.members }) : undefined}
      closeLabel={t('common.action.close')}
      keyboardAware
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose} disabled={busy !== null}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            onClick={() => void save()}
            busy={busy === 'save'}
            busyLabel={t('team.access.saving')}
            data-testid="access-group-save"
            className="flex-1"
          >
            {group && group.members > 0 ? t('team.access.saveCount', { count: group.members }) : t('team.access.save')}
          </UbButton>
        </>
      }
    >
      <UbStack gap={3} data-testid="access-group-form">
        <UbStack direction="row">
          <UbStatusBadge tone="info" label={t('team.access.context', { app: app.label, business })} />
        </UbStack>
        <UbStack gap={1.5}>
          <UbText as="span" variant="inherit" className="text-[13px] font-medium" id={`${formId}-name`}>
            {t('team.access.name')}
          </UbText>
          <UbTextInput
            aria-labelledby={`${formId}-name`}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? `${formId}-error` : undefined}
            invalid={nameError !== null}
            value={name}
            onChange={(v) => {
              setName(v);
              setNameError(null);
            }}
            maxLength={60}
            data-testid="access-group-name"
          />
          {nameError && <UbFieldError id={`${formId}-error`}>{nameError}</UbFieldError>}
        </UbStack>
        <UbSwitch
          checked={isDefault}
          onCheckedChange={setIsDefault}
          label={t('team.access.default')}
          description={t('team.access.defaultBody', { app: app.label })}
        />
        <UbStack gap={0} className="rounded-card border border-border-hairline p-4">
          <UbText as="span" variant="inherit" className="mb-1 font-semibold">
            {t('team.access.whatTheyCanDo', { app: app.label })}
          </UbText>
          {parts.map((part) => (
            <PartLevelRow
              key={part.part}
              part={part}
              value={levels[part.part] ?? 'full'}
              onChange={(level) => setLevels((prev) => ({ ...prev, [part.part]: level }))}
              disabled={busy !== null}
            />
          ))}
        </UbStack>
        <UbText as="p" variant="caption" tone="secondary">
          {t('team.access.ownerKeeps')}
        </UbText>
        {group && (
          <UbButton
            variant="outlineNeutral"
            onClick={() => void remove()}
            busy={busy === 'delete'}
            className="self-start"
            data-testid="access-group-delete"
          >
            {t('team.access.delete')}
          </UbButton>
        )}
      </UbStack>
    </UbDrawer>
  );
}
