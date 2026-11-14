'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus, Users } from 'lucide-react';
import { createPortal } from 'react-dom';

import { UbButton, UbDrawerLoading, UbEmptyState, UbFab, UbStack, UbText } from 'src/design-system';
import { UbDataGrid, type UbGridState } from 'src/design-system/UbDataGrid';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import { getAccessGroups } from '../api/accessGroupService';
import { useTeamGridLabels } from '../hooks/useTeamGridLabels';

import { createGroupColumns } from './AccessGroupColumns';

import type { TeamApp } from '../hooks/useTeamApp';
import type { AccessGroup, AccessGroupsPayload, AccessLevel } from '../types/accessGroup.types';

// The access words ride with the screens that show them (owner, 14 Nov 2026).
import 'src/i18n/catalogues/teamAccess';

const AccessGroupDrawer = dynamic(() => import('./AccessGroupDrawer').then((m) => m.AccessGroupDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

const GROUP_ICON = <Users aria-hidden className="h-4 w-4" />;
const groupIcon = (): React.ReactNode => GROUP_ICON;

type Editing = { group: AccessGroup | null; start: { name: string; levels: Readonly<Record<string, AccessLevel>> } };

/**
 * Team › Access groups for the OPEN app of the open business (design G1, G6).
 * Each group says what its members can do, by level, and how many are in it.
 * With none yet, members get everything their role allows here, and the empty
 * state says so and offers the server's ready-made example.
 */
export function AccessGroupsSection({ app }: Readonly<{ app: TeamApp }>): React.JSX.Element {
  const { t } = useTranslation();
  const business = useAppSelector(selectActiveTenant)?.name ?? '';
  const labels = useTeamGridLabels('team.access.loading');
  const [data, setData] = useState<AccessGroupsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAccessGroups(app.code, controller.signal)
      .then((payload) => {
        setData(payload);
        setFailed(false);
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [app.code, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const parts = useMemo(() => data?.parts ?? [], [data]);
  const allFull = useMemo(() => Object.fromEntries(parts.map((p) => [p.part, 'full' as AccessLevel])), [parts]);
  const openNew = useCallback(
    (fromExample: boolean) =>
      setEditing({
        group: null,
        start: fromExample && data ? data.suggested : { name: '', levels: allFull },
      }),
    [data, allFull]
  );

  const columns = useMemo(
    () =>
      createGroupColumns({
        t,
        parts,
        onEdit: (g) => setEditing({ group: g, start: { name: g.name, levels: g.levels } }),
      }),
    [t, parts]
  );

  const groups = data?.groups ?? [];
  const state: UbGridState = failed && !data ? 'error' : !data ? 'loading' : groups.length === 0 ? 'empty' : 'rows';

  return (
    <UbStack gap={3} className="pb-24 lg:pb-0" data-testid="access-groups">
      {state === 'empty' ? (
        <UbEmptyState
          variant="firstUse"
          title={t('team.access.empty.title', { app: app.label })}
          description={t('team.access.empty.body', { app: app.label })}
          action={
            <UbStack gap={2} className="w-full max-w-sm">
              <UbButton onClick={() => openNew(true)} icon={<Plus className="h-4 w-4" aria-hidden />} data-testid="access-group-example">
                {t('team.access.makeExample', { name: data?.suggested.name ?? '' })}
              </UbButton>
              <UbButton variant="outlineNeutral" onClick={() => openNew(false)}>
                {t('team.access.makeOwn')}
              </UbButton>
            </UbStack>
          }
        />
      ) : (
        <>
          <UbStack direction="row" align="center" gap={2} className="justify-end">
            <UbButton
              onClick={() => openNew(false)}
              icon={<Plus className="h-4 w-4" aria-hidden />}
              className="max-lg:hidden"
              data-testid="access-group-new"
            >
              {t('team.access.new')}
            </UbButton>
          </UbStack>
          <UbDataGrid
            rows={groups}
            columns={columns}
            rowId={(g) => g.id}
            rowName={(g) => g.name}
            state={state}
            labels={labels}
            caption={t('team.access.caption', { app: app.label })}
            // A group is not a person: an icon, never initials (PTY-05's lesson).
            cardAvatarIcon={groupIcon}
            emptyStates={{
              firstUse: { title: '', description: '' },
              filtered: { title: '', description: '' },
              error: {
                title: t('team.access.loadError'),
                action: (
                  <UbButton variant="secondary" onClick={reload}>
                    {t('common.action.retry')}
                  </UbButton>
                ),
              },
            }}
            page={{ page: 1, pageSize: Math.max(groups.length, 1), total: groups.length, totalPages: 1 }}
            onPageChange={() => undefined}
          />
          <UbText as="p" variant="caption" tone="secondary">
            {t('team.access.onlyHere', { app: app.label, business })}
          </UbText>
        </>
      )}
      {/* Owner, 14 Nov 2026: on a phone, New group floats at the bottom right,
          as Add does on the apps' own lists; desktop keeps the button above. */}
      {/* Drawn at page level: the tab panel fades in with a transform, and a
          transform turns "fixed to the screen" into "fixed to the panel",
          which left the button mid-list (found by e2e/access-groups.mjs). */}
      {state !== 'empty' &&
        typeof document !== 'undefined' &&
        createPortal(
          <UbFab
            label={t('team.access.new')}
            icon={<Plus className="h-4 w-4" aria-hidden />}
            mobileOnly
            extended
            onClick={() => openNew(false)}
          />,
          document.body
        )}
      {editing && (
        <AccessGroupDrawer
          app={app}
          business={business}
          parts={parts}
          group={editing.group}
          start={editing.start}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </UbStack>
  );
}
