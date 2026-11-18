import { screen } from '@testing-library/react';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import BusinessDaysPage from '../../app/(app)/settings/business-days/page';
import MessagesPage from '../../app/(app)/settings/messages/page';
import PlanPage from '../../app/(app)/settings/plan/page';
import ShopFeaturesPage from '../../app/(app)/settings/shop-features/page';

/**
 * Settings round, 14 Nov 2026 (owner: "test that setting … for all user"). A
 * staff member who opened these pages by address got a blank Business features
 * page, a Messages page that showed grey loading bars for ever, and the Plan
 * and Business days pages that their Settings hub never offers them. Each now
 * says the setting is not available, like Profile, Branding and Activity.
 */
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => '/settings',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  store.dispatch(
    sessionLoaded({
      user: { id: 'u-staff', name: 'Ravi', email: 'r@x.test', mobile: null, locale: 'en', mustChangePassword: false, passwordExpiresAt: null },
      activeTenant: { id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata', role: 'staff' },
      tenants: [{ id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata', role: 'staff' }],
      permissions: ['parties.party.read', 'sales.invoice.read'],
      enabledModules: [],
      version: 1,
    })
  );
});

it.each([
  ['Business features', ShopFeaturesPage],
  ['Messages', MessagesPage],
  ['Plan', PlanPage],
  ['Business days', BusinessDaysPage],
])('%s tells staff the setting is not available', async (_name, Page) => {
  renderWithProviders(<Page />);
  expect(await screen.findByText('This setting is not available')).toBeInTheDocument();
});
