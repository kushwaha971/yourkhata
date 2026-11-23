'use client';

import { useMemo } from 'react';

import { usePermissions } from 'src/hooks/usePermissions';

/**
 * What this team member may DO in Lending — mirrored from
 * `apps/lending/views.py`, which decides again on every request. Reading is the
 * menu's gate; these three decide which actions a screen draws. An action the
 * member may not take is hidden, never drawn to be refused (R-SEC-2): staff
 * collect, add borrowers and give loans (owner, 13 Nov 2026) but do not manage
 * routes, close loans or change settings; an accountant only reads.
 */
export interface LendingAccess {
  /** Collect, Not paid, remove a wrong collection, send a reminder. */
  readonly canCollect: boolean;
  /** Add or edit a borrower, give a new loan. */
  readonly canLend: boolean;
  /** Routes, closing or writing off a loan, settings. */
  readonly canManage: boolean;
}

export const useLendingAccess = (): LendingAccess => {
  const { can } = usePermissions();
  return useMemo(
    () => ({
      canCollect: can('lending.collection.create'),
      canLend: can('lending.loan.create'),
      canManage: can('lending.settings.manage'),
    }),
    [can]
  );
};
