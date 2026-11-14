import { UbButton, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';

import { accessSummary } from '../view-model/accessSummary';

import { MemberMetaCell } from './MemberRow';

import type { AccessGroup, AccessPart } from '../types/accessGroup.types';

// The access words ride with the screens that show them (owner, 14 Nov 2026).
import 'src/i18n/catalogues/teamAccess';

export interface GroupColumnDeps {
  /** Already-bound `t` from the screen; a column never calls `useTranslation`. */
  readonly t: (id: string, values?: Record<string, string | number | Date>) => string;
  readonly parts: readonly AccessPart[];
  readonly onEdit: (group: AccessGroup) => void;
}

/** The access groups list's columns (design G1): the group, what it lets members do, how many. */
export const createGroupColumns = ({ t, parts, onEdit }: GroupColumnDeps): readonly UbDataGridColumn<AccessGroup>[] => [
      {
        id: 'name',
        header: t('team.access.column.group'),
        priority: 1,
        cardSlot: 'title',
        widthShare: 26,
        cell: (g) => (
          <UbStack direction="row" gap={2} align="center" className="min-w-0 flex-wrap">
            <UbText as="span" variant="inherit" className="font-semibold">
              {g.name}
            </UbText>
            {g.isDefault && <UbStatusBadge tone="info" label={t('team.access.defaultBadge')} />}
          </UbStack>
        ),
      },
      {
        id: 'summary',
        header: t('team.access.column.can'),
        priority: 1,
        cardSlot: 'meta',
        widthShare: 50,
        // Wraps, never cut: a summary cut at "View onl…" hides what is off (owner rule).
        cell: (g) => (
          <UbText as="span" variant="body-sm" tone="secondary" className="whitespace-normal break-words">
            {accessSummary(t, parts, g.levels)}
          </UbText>
        ),
      },
      {
        id: 'members',
        header: t('team.access.column.members'),
        priority: 2,
        cardSlot: 'meta',
        widthShare: 10,
        align: 'end',
        cell: (g) => <MemberMetaCell text={t('team.access.people', { count: g.members })} />,
      },
      {
        id: 'edit',
        header: t('team.members.column.actions'),
        priority: 1,
        cardSlot: 'trailing',
        widthShare: 14,
        align: 'end',
        cell: (g) => (
          <UbButton size="sm" variant="outlineNeutral" onClick={() => onEdit(g)} data-testid="access-group-edit">
            {t('team.access.edit')}
          </UbButton>
        ),
      },
    ];
