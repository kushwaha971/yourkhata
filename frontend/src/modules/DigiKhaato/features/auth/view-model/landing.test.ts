import { ROUTES } from 'src/routes';
import type { Landing } from 'src/types/landing.types';
import { toLanding } from 'src/types/landing.types';

import { entryRoute, isPersonalPath, isTenantless, landingRoute } from './landing';

/**
 * docs/platform/14 §4.1 — the server decides where a session goes and this is
 * the ONE place its answer becomes a path. Every kind is spelled here, so a new
 * one the server adds cannot be routed by accident to somewhere plausible.
 */
describe('landingRoute', () => {
  const next = '/lending/loans';

  it.each<[Landing, string]>([
    [{ kind: 'set_password' }, ROUTES.SET_PASSWORD],
    [{ kind: 'choose_business' }, ROUTES.SWITCH_TENANT],
    [{ kind: 'invitation' }, ROUTES.SWITCH_TENANT],
    [{ kind: 'admin' }, ROUTES.ADMIN_TENANTS],
    [{ kind: 'no_business' }, '/onboarding/step/1'],
    [{ kind: 'business_setup', tenantId: 't1', step: 3 }, '/onboarding/step/3'],
    [{ kind: 'app', tenantId: 't1' }, next],
  ])('%j goes to %s', (landing, path) => {
    expect(landingRoute(landing, next)).toBe(path);
  });

  it('honours ?next= only when the person can use the app now', () => {
    expect(landingRoute({ kind: 'set_password' }, next)).not.toBe(next);
    expect(landingRoute({ kind: 'business_setup', tenantId: 't', step: 2 }, next)).not.toBe(next);
  });

  it('knows which kinds leave no business to show', () => {
    expect(isTenantless({ kind: 'no_business' })).toBe(true);
    expect(isTenantless({ kind: 'choose_business' })).toBe(true);
    expect(isTenantless({ kind: 'app', tenantId: 't' })).toBe(false);
    expect(isTenantless({ kind: 'business_setup', tenantId: 't', step: 2 })).toBe(false);
  });
});

describe('toLanding', () => {
  it('reads the wire shape', () => {
    expect(toLanding({ kind: 'business_setup', tenant_id: 't1', step: 2 })).toEqual({
      kind: 'business_setup',
      tenantId: 't1',
      step: 2,
    });
    expect(toLanding({ kind: 'app', tenant_id: 't1' })).toEqual({ kind: 'app', tenantId: 't1' });
  });

  it('refuses what it does not know rather than guessing a route', () => {
    expect(toLanding({ kind: 'somewhere_new' })).toBeNull();
    expect(toLanding(undefined)).toBeNull();
  });
});

describe('entryRoute (owner, 18 Nov 2026)', () => {
  const app: Landing = { kind: 'app', tenantId: 't1', app: 'shop', path: '/dashboard' };
  const home = ROUTES.DASHBOARD;

  /** Without this, a person with no starred business opens a business they never chose. */
  it('opens Money Book when no business is starred', () => {
    expect(entryRoute(app, [{ isDefault: false, status: 'active' }], home)).toBe(ROUTES.KHATA);
    expect(entryRoute({ kind: 'no_business' }, [], home)).toBe(ROUTES.KHATA);
    expect(entryRoute({ kind: 'choose_business' }, [{ status: 'active' }], home)).toBe(ROUTES.KHATA);
  });

  it('opens the starred business when there is one', () => {
    expect(entryRoute(app, [{ isDefault: true, status: 'active' }], home)).toBe('/dashboard');
  });

  it('keeps a page the person was heading to, and the password change', () => {
    expect(entryRoute(app, [], '/items')).toBe('/items');
    expect(entryRoute({ kind: 'set_password' }, [], home)).not.toBe(ROUTES.KHATA);
  });

  it('lets a session with no business open Money Book pages only', () => {
    expect(isPersonalPath(ROUTES.KHATA)).toBe(true);
    expect(isPersonalPath(`${ROUTES.KHATA}/report`)).toBe(true);
    expect(isPersonalPath(ROUTES.DASHBOARD)).toBe(false);
  });
});
