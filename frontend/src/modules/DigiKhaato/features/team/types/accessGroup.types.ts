/**
 * Access groups (owner, 14 Nov 2026; design docs/revamp/design/access-groups.html).
 *
 * Everything here belongs to ONE business and ONE app: the one that is open.
 * A level is what a member may do with one part of that app.
 */
export type AccessLevel = 'off' | 'view' | 'full';

/** One part of the open app and the levels it offers (an action has no view). */
export interface AccessPart {
  readonly part: string;
  readonly levels: readonly AccessLevel[];
}

export interface AccessGroup {
  readonly id: string;
  readonly app: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly levels: Readonly<Record<string, AccessLevel>>;
  readonly members: number;
}

export interface AccessGroupsPayload {
  readonly app: string;
  readonly parts: readonly AccessPart[];
  readonly groups: readonly AccessGroup[];
  /** The ready-made group the empty tab offers. */
  readonly suggested: { readonly name: string; readonly levels: Readonly<Record<string, AccessLevel>> };
}

export interface AccessGroupDraft {
  readonly name: string;
  readonly isDefault: boolean;
  readonly levels: Readonly<Record<string, AccessLevel>>;
}

/** One part as one member has it: the group's level and theirs. */
export interface MemberAccessPart extends AccessPart {
  readonly groupLevel: AccessLevel;
  readonly level: AccessLevel;
}

export interface MemberAccess {
  readonly app: string;
  readonly canUse: boolean;
  /** False for the owner and admins: they are never narrowed. */
  readonly narrowed: boolean;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly parts: readonly MemberAccessPart[];
  readonly changes: number;
}

export interface MemberAccessChange {
  readonly canUse?: boolean;
  readonly groupId?: string | null;
  readonly exceptions?: Readonly<Record<string, AccessLevel>>;
}

/** A member's access in the open app, as the Members list shows it. */
export interface MemberAccessSummary {
  readonly canUse: boolean;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly changes: number;
}
