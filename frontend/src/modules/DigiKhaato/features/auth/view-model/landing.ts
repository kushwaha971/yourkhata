import { ROUTES } from 'src/routes';
import type { Landing } from 'src/types/landing.types';

import { AUTH_CONFIG } from '../config';

/**
 * docs/platform/14 §4.1 — the ONE place a `landing` becomes a path.
 *
 * The server decides where a session goes (`selectors/landing.py`); this only
 * spells each answer as a route, so sign-in, the route guard and both password
 * screens cannot disagree. `nextPath` is `safeNextPath`'s output and is honoured
 * only for `app`: every other kind is something the person must do first, and
 * the server would refuse the page they were heading to until they do.
 */
export const landingRoute = (landing: Landing, nextPath: string): string => {
  switch (landing.kind) {
    case 'set_password':
      return AUTH_CONFIG.setPasswordRoute;
    case 'choose_business':
    case 'invitation':
      return AUTH_CONFIG.chooserRoute;
    case 'admin':
      return ROUTES.ADMIN_TENANTS;
    case 'no_business':
      return AUTH_CONFIG.onboardingStepPath(1);
    case 'business_setup':
      return AUTH_CONFIG.onboardingStepPath(landing.step);
    case 'app':
      // `?next=` wins when it named a page; otherwise the app they were in.
      return nextPath === AUTH_CONFIG.defaultPostLoginPath && landing.path
        ? landing.path
        : nextPath;
    default:
      return AUTH_CONFIG.defaultPostLoginPath;
  }
};

/**
 * Where a person lands when they sign in or open the app (owner, 18 Nov 2026):
 * the business they starred (★ on the Apps screen), and otherwise Money Book,
 * their own book that needs no business. The server still opens a business in
 * the session (`preferred_membership`), so every business screen works the
 * moment they switch to it; this only decides the first page. A `?next=` the
 * person was heading to, a password change, an operator and an invitation keep
 * their own routes, because each is something specific they came to do.
 */
export const entryRoute = (
  landing: Landing,
  tenants: readonly { readonly isDefault?: boolean; readonly status?: string }[],
  nextPath: string
): string => {
  const keeps =
    landing.kind === 'set_password' ||
    landing.kind === 'admin' ||
    landing.kind === 'invitation' ||
    nextPath !== AUTH_CONFIG.defaultPostLoginPath;
  if (keeps) return landingRoute(landing, nextPath);
  const starred = tenants.some((t) => t.isDefault && (t.status ?? 'active') === 'active');
  return starred ? landingRoute(landing, nextPath) : ROUTES.KHATA;
};

/** Money Book belongs to the person, so a session with no business may open it. */
export const isPersonalPath = (pathname: string): boolean =>
  pathname === ROUTES.KHATA || pathname.startsWith(`${ROUTES.KHATA}/`);

/** Kinds that leave no business to show: the guard must not render the app page. */
export const isTenantless = (landing: Landing): boolean =>
  landing.kind === 'choose_business' ||
  landing.kind === 'invitation' ||
  landing.kind === 'admin' ||
  landing.kind === 'no_business';
