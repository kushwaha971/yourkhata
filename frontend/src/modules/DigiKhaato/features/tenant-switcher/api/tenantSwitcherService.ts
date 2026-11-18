import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import type { TWriteClass } from 'src/types/api.types';

/**
 * Part 19 §19.3.4 — the service layer for PLT-04's two membership writes.
 *
 * `switchTenant` itself is NOT here: it lives in `authService` because it is a
 * token operation, not a membership one, and it has been registered since
 * Sprint 0. Duplicating it would give the codebase two ways to change tenant
 * and one INVALIDATION entry.
 *
 * Both writes are class **C, online-only** (§19.10.4): a default set in an
 * outbox is a preference the server does not know about, and a "leave" replayed
 * six hours later would remove a membership the user has since used.
 */

/**
 * PATCH /memberships/{id} `{ is_default: true }` — FR-5.
 *
 * Only `true` is ever sent (§10): "not the default" is not a state a user sets,
 * it is what happens to the previous default when the server clears it. A
 * client that could send `false` could leave a user with no default at all.
 */
export const setDefaultMembership = async (membershipId: string, primaryApp?: string): Promise<void> => {
  await api.patch(
    API_PATHS.MEMBERSHIP(membershipId),
    // `primary_app`: the app the Apps screen's ★ was set in (owner, 12 Nov 2026).
    primaryApp ? { is_default: true, primary_app: primaryApp } : { is_default: true },
    ubConfig({ suppressErrorSnackbar: true })
  );
};
/**
 * GET /memberships/apps — for each business, the apps this person opens there
 * (owner, 12 Nov 2026: the Apps screen lists places under each app). Kept out
 * of `/auth/me`, whose query budget is the first request of every load.
 */
export const fetchAppsPerBusiness = async (signal?: AbortSignal): Promise<Readonly<Record<string, readonly string[]>>> => {
  const r = await api.get(API_PATHS.MEMBERSHIP_APPS, ubConfig({ suppressErrorSnackbar: true, signal }));
  const rows = (r.data?.data ?? []) as { tenant_id: string; apps?: string[] }[];
  return Object.fromEntries(rows.map((row) => [row.tenant_id, row.apps ?? []]));
};

export const setDefaultMembershipWriteClass: TWriteClass = 'online-only';

/**
 * DELETE /memberships/{id} on one's OWN row — FR-7, "Leave business".
 *
 * 409 `last_owner` is the documented refusal and is rendered by the caller
 * rather than toasted: a business must always have one owner, and the merchant
 * needs to be told what to do about it (promote someone first), not merely that
 * it failed.
 */
export const leaveMembership = async (membershipId: string): Promise<void> => {
  await api.delete(API_PATHS.MEMBERSHIP(membershipId), ubConfig({ suppressErrorSnackbar: true }));
};
export const leaveMembershipWriteClass: TWriteClass = 'online-only';
