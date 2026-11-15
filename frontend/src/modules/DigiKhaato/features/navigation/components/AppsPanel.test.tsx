import { screen } from '@testing-library/react';

import { sessionLoaded, type SessionApp } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { AppsPanel } from './AppsPanel';

/**
 * Design settings-and-profile S11 step 7 (owner-approved 14 Nov 2026). A role
 * belongs to a person in one business: somebody who is Staff in one shop and
 * Owner of their own is told who adds apps where they are not the owner, and
 * an owner everywhere is not told anything.
 */
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => '/apps',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('../../tenant-switcher/api/tenantSwitcherService', () => ({
  ...jest.requireActual('../../tenant-switcher/api/tenantSwitcherService'),
  fetchAppsPerBusiness: jest.fn(() => Promise.resolve({ t1: ['shop'], t2: ['shop'] })),
}));

const APPS: SessionApp[] = [{ code: 'shop', labelId: 'nav.workspace.shop', homePath: '/dashboard', order: 90 }];

const load = (roles: readonly [string, string]) =>
  store.dispatch(
    sessionLoaded({
      user: { id: 'u1', name: 'Mohan', email: 'm@x.test', mobile: null, locale: 'en', mustChangePassword: false, passwordExpiresAt: null },
      activeTenant: { id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata', role: roles[0] },
      tenants: [
        { id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata', role: roles[0], status: 'active' },
        { id: 't2', name: 'Mohan Mobile Shop', timezone: 'Asia/Kolkata', role: roles[1], status: 'active' },
      ],
      permissions: [],
      enabledModules: [],
      version: 1,
      apps: APPS,
      activeApp: 'shop',
    })
  );

it('staff in one shop and owner of another are told who adds apps', async () => {
  load(['staff', 'owner']);
  renderWithProviders(<AppsPanel />);
  expect(await screen.findByTestId('apps-not-owner')).toHaveTextContent('the owner adds apps');
});

it('an owner in every business is not told', async () => {
  load(['owner', 'owner']);
  renderWithProviders(<AppsPanel />);
  await screen.findByText('Shree Ganesh Kirana');
  expect(screen.queryByTestId('apps-not-owner')).toBeNull();
});
