import { screen } from '@testing-library/react';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import MyProfilePage from '../../app/(app)/settings/me/page';

/**
 * Design settings-and-profile S2/S11 (owner-approved 14 Nov 2026). A person who
 * is Staff in one shop and Owner of their own sees their own profile with the
 * role they hold in EACH business — the role belongs to the person in one
 * business, never to the person. Prevents the profile being gated like a
 * business page, and a role shown once for every business.
 */
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => '/settings/me',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  store.dispatch(
    sessionLoaded({
      user: { id: 'u1', name: 'Mohan Lal', email: 'm@x.test', mobile: '+919700011102', locale: 'en', mustChangePassword: false, passwordExpiresAt: null },
      activeTenant: { id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata', role: 'staff' },
      tenants: [
        { id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata', role: 'staff' },
        { id: 't2', name: 'Mohan Mobile Shop', timezone: 'Asia/Kolkata', role: 'owner' },
      ],
      permissions: [],
      enabledModules: [],
      version: 1,
    })
  );
});

it("a staff member's own profile opens, with their role in each business", async () => {
  renderWithProviders(<MyProfilePage />);
  expect(await screen.findByDisplayValue('Mohan Lal')).toBeInTheDocument();
  expect(screen.queryByText(/not available/i)).toBeNull();
  expect(screen.getByText('+91 97000 11102')).toBeInTheDocument();
  expect(screen.getByText('Mohan Mobile Shop')).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
  expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});
