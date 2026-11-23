import { useMemo } from 'react';

import { usePermissions } from 'src/hooks/usePermissions';

export interface LibraryAccess {
  /** Enrol, move, hold, leave, books, reminders. */
  readonly canWrite: boolean;
  /** Take a fee, remove one, mark in and out. */
  readonly canCollect: boolean;
  /** Seats, shift fees, expenses and settings: the owner's. */
  readonly canManage: boolean;
}

/**
 * What the signed-in member may do in the Library. The server refuses the rest
 * (`apps/library/views.py`); a control it would refuse is hidden, not shown and
 * then answered with an error (R-SEC-2).
 */
export const useLibraryAccess = (): LibraryAccess => {
  const { can } = usePermissions();
  return useMemo(
    () => ({
      canWrite: can('library.member.write'),
      canCollect: can('library.fee.create'),
      canManage: can('library.settings.manage'),
    }),
    [can]
  );
};
