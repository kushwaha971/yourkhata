'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import {
  UbButton,
  UbDialog,
  UbEmptyState,
  UbSelect,
  UbSkeleton,
  UbStack,
  UbSwitch,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { accountDisplayName } from 'src/utils/accountIdentity';
import { toApiError } from 'src/utils/apiError';

import { getAccessGroups, getMemberAccess, setMemberAccess } from '../api/accessGroupService';

import { PartLevelRow } from './PartLevelRow';

import type { TeamApp } from '../hooks/useTeamApp';
import type { AccessGroup, AccessLevel, MemberAccess } from '../types/accessGroup.types';
import type { Member } from '../types/member.types';

// Loaded with dynamic(), so its own words come with its own chunk.
import 'src/i18n/catalogues/team';
import 'src/i18n/catalogues/teamAccess';

/** The select's value for "no group" (a select cannot hold an empty value). */
const NO_GROUP = 'none';

/**
 * One member's access in the OPEN app of the open business (design G4). Can
 * they use the app here; which group they follow; and each part's level, with
 * any part that differs from the group marked and "Use group again" to drop
 * the differences. Saving changes this app only; they keep signing in, their
 * other apps, their own Money book and every other business.
 */
export function MemberAccessSheet({
  member,
  app,
  onClose,
  onSaved,
}: Readonly<{ member: Member; app: TeamApp; onClose: () => void; onSaved: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectActiveTenant)?.name ?? '';
  const name = accountDisplayName({ name: member.fullName, email: member.email, mobile: member.mobile });
  const groupLabelId = useId();
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [groups, setGroups] = useState<readonly AccessGroup[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [canUse, setCanUse] = useState(true);
  const [groupId, setGroupId] = useState<string>(NO_GROUP);
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getMemberAccess(member.id, app.code, controller.signal), getAccessGroups(app.code, controller.signal)])
      .then(([mine, all]) => {
        setFailed(false);
        setAccess(mine);
        setGroups(all.groups);
        setCanUse(mine.canUse);
        setGroupId(mine.groupId ?? NO_GROUP);
        setLevels(Object.fromEntries(mine.parts.map((p) => [p.part, p.level])));
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [member.id, app.code, attempt]);

  const group = groups.find((g) => g.id === groupId) ?? null;
  const groupLevelOf = useMemo(
    () => (part: string): AccessLevel => (group?.levels[part] as AccessLevel | undefined) ?? 'full',
    [group]
  );
  const parts = access?.parts ?? [];
  const changes = parts.filter((p) => (levels[p.part] ?? 'full') !== groupLevelOf(p.part));

  const chooseGroup = (id: string): void => {
    setGroupId(id);
    // A new group brings its own levels; the member's differences start again.
    const next = groups.find((g) => g.id === id);
    setLevels(Object.fromEntries(parts.map((p) => [p.part, (next?.levels[p.part] as AccessLevel | undefined) ?? 'full'])));
  };

  const save = async (): Promise<void> => {
    if (saving || !access) return;
    setSaving(true);
    try {
      await setMemberAccess(member.id, app.code, {
        ...(canUse !== access.canUse ? { canUse } : {}),
        groupId: groupId === NO_GROUP ? null : groupId,
        exceptions: Object.fromEntries(changes.map((p) => [p.part, levels[p.part] ?? 'full'])),
      });
      dispatch(
        showSnackbar({
          severity: 'success',
          message: canUse ? t('team.access.memberSaved', { name, app: app.label }) : t('team.access.memberOff', { name, app: app.label }),
        })
      );
      onSaved();
    } catch (e) {
      const error = toApiError(e, 'team.access.error');
      const lastApp = (error.details as { can_use?: string[] } | undefined)?.can_use?.[0];
      dispatch(showSnackbar({ severity: 'error', message: lastApp ? t('team.access.lastApp') : t('team.access.error') }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <UbDialog
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={name}
      description={t('team.access.context', { app: app.label, business })}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton onClick={() => void save()} busy={saving} busyLabel={t('team.access.saving')} disabled={!access} data-testid="member-access-save">
            {t('team.access.save')}
          </UbButton>
        </>
      }
    >
      {failed && !access ? (
        <UbEmptyState
          variant="error"
          title={t('team.access.loadError')}
          action={<UbButton onClick={() => setAttempt((n) => n + 1)}>{t('common.action.retry')}</UbButton>}
        />
      ) : !access ? (
        <UbSkeleton variant="list" count={3} label={t('team.access.loading')} />
      ) : !access.narrowed ? (
        <UbText as="p" variant="inherit">
          {t('team.access.everything', { name, app: app.label })}
        </UbText>
      ) : (
        <UbStack gap={3} data-testid="member-access">
          <UbSwitch
            checked={canUse}
            onCheckedChange={setCanUse}
            label={t('team.access.canUse', { app: app.label })}
            description={t('team.access.canUseBody', { name, app: app.label })}
            disabled={saving}
          />
          {canUse && (
            <>
              <UbStack gap={1.5}>
                <UbText as="span" variant="inherit" className="text-[13px] font-medium" id={groupLabelId}>
                  {t('team.access.group')}
                </UbText>
                <UbSelect
                  aria-label={t('team.access.group')}
                  value={groupId}
                  onChange={chooseGroup}
                  disabled={saving}
                  options={[
                    { value: NO_GROUP, label: t('team.access.noGroup') },
                    ...groups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                />
              </UbStack>
              {changes.length > 0 && (
                <UbStack gap={1} className="rounded-card bg-warning-dim p-4" data-testid="member-access-changes">
                  <UbText as="span" variant="inherit" className="font-semibold">
                    {t('team.access.changes', { count: changes.length })}
                  </UbText>
                  <UbButton
                    size="sm"
                    variant="outlineNeutral"
                    className="mt-1 self-start"
                    onClick={() => setLevels(Object.fromEntries(parts.map((p) => [p.part, groupLevelOf(p.part)])))}
                  >
                    {t('team.access.useGroupAgain')}
                  </UbButton>
                </UbStack>
              )}
              <UbStack gap={0} className="rounded-card border border-border-hairline p-4">
                <UbText as="span" variant="inherit" className="mb-1 font-semibold">
                  {t('team.access.whatTheyCanDo', { app: app.label })}
                </UbText>
                {parts.map((part) => (
                  <PartLevelRow
                    key={part.part}
                    part={part}
                    value={levels[part.part] ?? 'full'}
                    groupLevel={groupId !== NO_GROUP ? groupLevelOf(part.part) : undefined}
                    onChange={(level) => setLevels((prev) => ({ ...prev, [part.part]: level }))}
                    disabled={saving}
                  />
                ))}
              </UbStack>
            </>
          )}
        </UbStack>
      )}
    </UbDialog>
  );
}
