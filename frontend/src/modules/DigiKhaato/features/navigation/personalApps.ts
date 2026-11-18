import { selectAppsAddable, type SessionApp } from 'src/redux/slice/sessionSlice';
import type { RootState } from 'src/redux/store';

/**
 * The person's own apps: one book per person, not per business (owner, 12 Nov
 * 2026). The Apps screen lists no places for them, and the Team screen never
 * offers to take one away from a member (owner, 14 Nov 2026).
 */
export const PERSONAL_APPS: ReadonlySet<string> = new Set(['khata']);

/**
 * What a business may still add, without the person's own apps: Money Book is
 * always listed and never "added" (owner, 18 Nov 2026), whatever the server
 * still offers. Memoised by hand on its one input, as `selectLanding` is, so
 * every caller gets the same array until the session changes.
 */
let lastAddable: readonly SessionApp[] | null = null;
let lastBusinessAddable: readonly SessionApp[] = [];
export const selectBusinessAppsAddable = (state: RootState): readonly SessionApp[] => {
  const addable = selectAppsAddable(state);
  if (addable !== lastAddable) {
    lastAddable = addable;
    lastBusinessAddable = addable.filter((a) => !PERSONAL_APPS.has(a.code));
  }
  return lastBusinessAddable;
};
