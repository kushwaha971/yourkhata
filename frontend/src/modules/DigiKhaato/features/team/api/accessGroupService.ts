import { API_PATHS } from 'src/api/APIPaths';
import { api } from 'src/api/AxiosInstances';
import type { TWriteClass } from 'src/types/api.types';
import { toQueryString } from 'src/utils/queryString';

import type {
  AccessGroup,
  AccessGroupDraft,
  AccessGroupsPayload,
  AccessLevel,
  MemberAccess,
  MemberAccessChange,
} from '../types/accessGroup.types';

/**
 * Access groups (owner, 14 Nov 2026) — one exported async function per
 * endpoint, every request naming the open app. Writes are online-only for the
 * reason `updateMember` gives: access must not wait in a queue.
 */
type Levels = Readonly<Record<string, AccessLevel>>;

interface GroupApi {
  readonly id: string;
  readonly app: string;
  readonly name: string;
  readonly is_default: boolean;
  readonly levels: Levels;
  readonly members: number;
}

const toGroup = (row: GroupApi): AccessGroup => ({
  id: row.id,
  app: row.app,
  name: row.name,
  isDefault: row.is_default,
  levels: row.levels,
  members: row.members,
});

export const getAccessGroups = async (app: string, signal?: AbortSignal): Promise<AccessGroupsPayload> => {
  const response = await api.get<{
    data: { app: string; parts: AccessGroupsPayload['parts']; groups: GroupApi[]; suggested: AccessGroupsPayload['suggested'] };
  }>(`${API_PATHS.ACCESS_GROUPS}${toQueryString({ app })}`, { signal });
  const data = response.data.data;
  return { app: data.app, parts: data.parts, groups: data.groups.map(toGroup), suggested: data.suggested };
};

export const createAccessGroup = async (app: string, draft: AccessGroupDraft): Promise<AccessGroup> => {
  const response = await api.post<{ data: GroupApi }>(API_PATHS.ACCESS_GROUPS, {
    app,
    name: draft.name,
    is_default: draft.isDefault,
    levels: draft.levels,
  });
  return toGroup(response.data.data);
};
export const createAccessGroupWriteClass: TWriteClass = 'online-only';

export const updateAccessGroup = async (groupId: string, draft: AccessGroupDraft): Promise<AccessGroup> => {
  const response = await api.patch<{ data: GroupApi }>(API_PATHS.ACCESS_GROUP(groupId), {
    name: draft.name,
    is_default: draft.isDefault,
    levels: draft.levels,
  });
  return toGroup(response.data.data);
};
export const updateAccessGroupWriteClass: TWriteClass = 'online-only';

export const deleteAccessGroup = async (groupId: string): Promise<void> => {
  await api.delete(API_PATHS.ACCESS_GROUP(groupId));
};
export const deleteAccessGroupWriteClass: TWriteClass = 'online-only';

interface MemberAccessApi {
  readonly app: string;
  readonly can_use: boolean;
  readonly narrowed: boolean;
  readonly group_id: string | null;
  readonly group_name: string | null;
  readonly parts: readonly { part: string; levels: AccessLevel[]; group_level: AccessLevel; level: AccessLevel }[];
  readonly changes: number;
}

const toMemberAccess = (data: MemberAccessApi): MemberAccess => ({
  app: data.app,
  canUse: data.can_use,
  narrowed: data.narrowed,
  groupId: data.group_id,
  groupName: data.group_name,
  parts: data.parts.map((p) => ({ part: p.part, levels: p.levels, groupLevel: p.group_level, level: p.level })),
  changes: data.changes,
});

export const getMemberAccess = async (membershipId: string, app: string, signal?: AbortSignal): Promise<MemberAccess> => {
  const response = await api.get<{ data: MemberAccessApi }>(
    `${API_PATHS.MEMBER_ACCESS(membershipId)}${toQueryString({ app })}`,
    { signal }
  );
  return toMemberAccess(response.data.data);
};

export const setMemberAccess = async (
  membershipId: string,
  app: string,
  change: MemberAccessChange
): Promise<MemberAccess> => {
  const response = await api.put<{ data: MemberAccessApi }>(
    `${API_PATHS.MEMBER_ACCESS(membershipId)}${toQueryString({ app })}`,
    {
      ...(change.canUse !== undefined ? { can_use: change.canUse } : {}),
      ...(change.groupId !== undefined ? { group_id: change.groupId } : {}),
      ...(change.exceptions !== undefined ? { exceptions: change.exceptions } : {}),
    }
  );
  return toMemberAccess(response.data.data);
};
export const setMemberAccessWriteClass: TWriteClass = 'online-only';
