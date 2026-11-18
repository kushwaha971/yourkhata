'use client';

import { useEffect } from 'react';

import { UbPageSkeleton } from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { ROUTES } from 'src/routes';

import { useAppWords } from 'modules/DigiKhaato/features/navigation/useAppWords';
import { useNavigation } from 'modules/DigiKhaato/features/navigation/useNavigation';

/**
 * The person page and its statement belong to the Shop's book only (owner,
 * 13 Nov 2026). The Money Book, Lending and the Library were rebuilt with their
 * own screens and tables, and no menu of theirs links here; opened from one of
 * them by address, these pages still drew the old Udhaar view (Gave money / Got
 * money, the credit limit) over the old shared ledger. So outside the Shop the
 * visitor is sent to the home of the app they have open, and nothing is drawn.
 */
export function ShopBookOnly({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const router = useAppRouter();
  const { book, app } = useAppWords();
  const { apps } = useNavigation();
  const allowed = book === 'shop';
  const home = apps.find((a) => a.code === app)?.href ?? ROUTES.APPS;

  useEffect(() => {
    if (!allowed) router.replace(home);
  }, [allowed, home, router]);

  return allowed ? <>{children}</> : <UbPageSkeleton variant="card" />;
}
