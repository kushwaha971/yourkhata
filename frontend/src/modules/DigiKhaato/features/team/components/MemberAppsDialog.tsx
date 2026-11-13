'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  UbButton,
  UbDialog,
  UbEmptyState,
  UbSkeleton,
  UbStack,
  UbSwitch,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant, selectSessionApps } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { accountDisplayName } from 'src/utils/accountIdentity';

import { PERSONAL_APPS } from 'modules/DigiKhaato/features/navigation/personalApps';

import { getMemberApps, setMemberApps } from '../api/memberService';

import type { Member, MemberAppGrant, MemberApps } from '../types/member.types';

// Loaded with dynamic(), so its own words come with its own chunk.
import 'src/i18n/catalogues/team';

/**
 * Owner, 14 Nov 2026 — which apps a member can open in THIS business, without
 * blocking them. Block takes the whole business away; this takes one app.
 *
 * The switches start from what the server says the member OPENS today, not
 * from the saved grants: a member from before grants existed has none and
 * still opens every app their role opens. Money book is never a switch — it is
 * each person's own book — and is always sent, so choosing apps never takes a
 * member's own book away. An app already given in a role keeps that role; a
 * newly switched-on app gets the member's business role (or staff, when their
 * role belongs to one app only and this is another).
 */
export function MemberAppsDialog({
  member,
  onClose,
}: Readonly<{ member: Member; onClose: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectActiveTenant)?.name ?? '';
  const sessionApps = useAppSelector(selectSessionApps);
  const all = useMemo(() => sessionApps ?? [], [sessionApps]);
  const shared = useMemo(() => all.filter((app) => !PERSONAL_APPS.has(app.code)), [all]);
  const name = accountDisplayName({ name: member.fullName, email: member.email, mobile: member.mobile });

  const [loaded, setLoaded] = useState<MemberApps | null>(null);
  const [failed, setFailed] = useState(false);
  const [on, setOn] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getMemberApps(member.id, controller.signal)
      .then((apps) => {
        setLoaded(apps);
        setFailed(false);
        setOn(new Set(apps.opens));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [member.id, attempt]);

  const roleFor = useCallback(
    (code: string): string => {
      const given = loaded?.grants.find((g) => g.app === code)?.role;
      if (given) return given;
      return member.roleModule && member.roleModule !== code ? 'staff' : member.role;
    },
    [loaded, member.role, member.roleModule]
  );

  const toggle = (code: string, next: boolean): void => {
    setRefused(false);
    setOn((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(code);
      else copy.delete(code);
      return copy;
    });
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    const chosen = shared.filter((app) => on.has(app.code));
    if (chosen.length === 0) {
      setRefused(true);
      return;
    }
    const grants: MemberAppGrant[] = [
      ...chosen.map((app) => ({ app: app.code, role: roleFor(app.code) })),
      ...all.filter((app) => PERSONAL_APPS.has(app.code)).map((app) => ({ app: app.code, role: roleFor(app.code) })),
    ];
    setSaving(true);
    try {
      await setMemberApps(member.id, grants);
      dispatch(
        showSnackbar({
          severity: 'success',
          message: t('team.member.apps.saved', { name, apps: chosen.map((app) => t(app.labelId)).join(', ') }),
        })
      );
      onClose();
    } catch {
      dispatch(showSnackbar({ severity: 'error', message: t('team.member.apps.error') }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <UbDialog
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={t('team.member.apps.title', { name })}
      description={t('team.member.apps.body', { name, business })}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            onClick={() => void save()}
            busy={saving}
            busyLabel={t('team.member.apps.saving')}
            disabled={!loaded}
            data-testid="member-apps-save"
          >
            {t('team.member.apps.save')}
          </UbButton>
        </>
      }
    >
      {failed && !loaded ? (
        <UbEmptyState
          variant="error"
          title={t('team.member.apps.loadError')}
          action={<UbButton onClick={() => setAttempt((n) => n + 1)}>{t('team.member.apps.tryAgain')}</UbButton>}
        />
      ) : !loaded ? (
        <UbSkeleton variant="list" count={3} label={t('team.member.apps.loading')} />
      ) : (
        <UbStack gap={2} data-testid="member-apps">
          {shared.map((app) => (
            <UbSwitch
              key={app.code}
              checked={on.has(app.code)}
              onCheckedChange={(next) => toggle(app.code, next)}
              label={t(app.labelId)}
              disabled={saving}
            />
          ))}
          {refused && (
            <UbText as="p" variant="caption" role="alert" className="text-formError">
              {t('team.member.apps.none')}
            </UbText>
          )}
        </UbStack>
      )}
    </UbDialog>
  );
}
