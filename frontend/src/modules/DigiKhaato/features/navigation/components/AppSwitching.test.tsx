import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { MobileTabBar } from 'src/components/layout/MobileTabBar';
import { UbSidebar } from 'src/components/layout/UbSidebar';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded, type SessionApp, type SessionTenant } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import { MODULE_CODES, type PermissionCode } from 'src/types/domain.types';

import { APP_MANIFESTS } from 'modules/appManifests';

import { PLATFORM_NAV_ITEMS } from '../appManifest';
import { rememberAppPlace } from '../appPlace';
import { resetNavigationSyncForTests } from '../useNavigation';

import { AppsPageContent } from './AppsPageContent';

/**
 * Revamp 04 §2–3 (N-1) — switching app is one visible tap on both shapes.
 *
 * The defect: on a phone the only way to another app was the business menu at
 * the top of the screen, where apps and businesses were one list, and on a
 * laptop the rail showed one app's rows with no sign there were others. Now
 * the phone's fifth slot is the App button, and the rail has one "Apps" row
 * that opens the Apps page (R-DEC-09: the owner did not want every app listed
 * in the rail). With a single app and nothing to add, both stay as they were.
 */
let mockPath = '/library/students';
const push = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockPath,
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const mockAppsOf: Record<string, string[]> = {};
jest.mock('../../tenant-switcher/api/tenantSwitcherService', () => ({
  ...jest.requireActual('../../tenant-switcher/api/tenantSwitcherService'),
  fetchAppsPerBusiness: jest.fn(() => Promise.resolve(mockAppsOf)),
}));
jest.mock('../../auth/api/authService', () => ({
  ...jest.requireActual('../../auth/api/authService'),
  switchApp: jest.fn(() => new Promise(() => undefined)),
  setAppRunning: jest.fn(),
  leaveApp: jest.fn(),
}));
const authService = jest.requireMock('../../auth/api/authService') as {
  setAppRunning: jest.Mock;
  leaveApp: jest.Mock;
};

const PERMISSIONS = [
  ...APP_MANIFESTS.flatMap((app) => app.navigation.map((item) => item.permission)),
  ...PLATFORM_NAV_ITEMS.map((item) => item.permission),
] as PermissionCode[];

const APPS: SessionApp[] = [
  { code: 'library', labelId: 'nav.workspace.library', homePath: '/library', order: 10 },
  { code: 'shop', labelId: 'nav.workspace.shop', homePath: '/dashboard', order: 20 },
  { code: 'khata', labelId: 'nav.workspace.khata', homePath: '/khata', order: 30 },
];

const LIBRARY_ONLY: SessionApp[] = APPS.slice(0, 1);
const ADD_LENDING: SessionApp[] = [
  { code: 'lending', labelId: 'nav.workspace.lending', homePath: '/lending', order: 40 },
];

const load = (
  apps: SessionApp[],
  appsAddable: SessionApp[] = [],
  tenants: SessionTenant[] = [{ id: 't1', name: 'Kumar Kirana', timezone: 'Asia/Kolkata', role: 'owner' }],
  role: 'owner' | 'staff' = 'owner'
) => {
  store.dispatch(resetAllFeatureState());
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Suresh Kumar',
        email: 'suresh@kirana.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Kumar Kirana', timezone: 'Asia/Kolkata', role },
      tenants: tenants.map((row) => (row.id === 't1' ? { ...row, role } : row)),
      permissions: PERMISSIONS,
      enabledModules: [...MODULE_CODES],
      version: 1,
      apps,
      appsAddable,
      activeApp: 'library',
    })
  );
};

beforeEach(() => {
  for (const key of Object.keys(mockAppsOf)) delete mockAppsOf[key];
  push.mockReset();
  window.sessionStorage.clear();
  resetNavigationSyncForTests();
  mockPath = '/library/students';
});

describe('phone App button', () => {
  it('still reads More with several apps, and its sheet opens the Apps screen from one row', async () => {
    load(APPS);
    renderWithProviders(<MobileTabBar />);
    const button = screen.getByRole('button', { name: 'Apps and more, now in Library' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('link', { name: 'More' })).not.toBeInTheDocument();
    // Owner, 13 Nov 2026: the slot reads "More" in every app, never the app's
    // own name (it read "Library"); the header already says which app is open.
    expect(button).toHaveTextContent(/^More$/);

    fireEvent.click(button);
    const sheet = await screen.findByRole('dialog', { name: 'Apps and more' });
    // Owner, 12 Nov 2026: one "Apps" row (what is open now), not a grid of tiles.
    const row = within(sheet).getByTestId('more-apps-row');
    expect(row).toHaveAttribute('href', '/apps');
    expect(row).toHaveTextContent('Library · Kumar Kirana');
    expect(within(sheet).queryByTestId('app-sheet-tiles')).not.toBeInTheDocument();
    // Everything the More page held is in the same sheet.
    expect(within(sheet).getByRole('searchbox', { name: 'Find a feature' })).toBeInTheDocument();
  });

  it('lists, under the open app, every business where it opens, the open one ticked and the ★ one Primary', async () => {
    Object.assign(mockAppsOf, { t1: ['library', 'shop', 'khata'], t2: ['library'], t3: ['lending'] });
    load(APPS, [], [
      { id: 't1', name: 'Kumar Kirana', timezone: 'Asia/Kolkata', role: 'owner', membershipId: 'm1' },
      { id: 't2', name: 'Gyan Library Baner', timezone: 'Asia/Kolkata', role: 'owner', membershipId: 'm2', isDefault: true, primaryApp: 'library' },
      { id: 't3', name: 'Verma Finance', timezone: 'Asia/Kolkata', role: 'staff', membershipId: 'm3' },
    ]);
    renderWithProviders(<AppsPageContent />);
    expect(screen.getByRole('heading', { name: 'Your libraries' })).toBeInTheDocument();
    // The other businesses arrive with `GET /memberships/apps`.
    await screen.findByText('Gyan Library Baner');
    const places = within(screen.getByTestId('apps-places')).getAllByTestId('apps-place');
    expect(places.map((p) => p.textContent)).toEqual(['Kumar KiranaOwner · Open now', 'Gyan Library BanerOwner · ★ Primary']);
    expect(places[0]).toHaveAttribute('aria-current', 'true');
    const stars = screen.getAllByTestId('apps-star');
    expect(stars.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(screen.getByTestId('apps-add')).toHaveTextContent('Add library');
    // A Ledger only another business runs still gets its card.
    expect(screen.getByTestId('apps-card-lending')).toHaveTextContent('Ledger');
  });

  it('keeps More for a person with one app', () => {
    load([APPS[0] as SessionApp]);
    renderWithProviders(<MobileTabBar />);
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
    expect(screen.queryByRole('button', { name: /Apps and more/ })).not.toBeInTheDocument();
  });
});

describe('desktop rail and the Apps page (R-DEC-09)', () => {
  /**
   * The owner, looking at F4: the rail listed Library, Lending, Shop and
   * Udhaar book. A person who never chose an app should not see it there, so
   * the rail has the open app's rows and ONE "Apps" row to a page of apps.
   */
  it('lists no other app in the rail, only one Apps row and the open app', () => {
    load(APPS);
    renderWithProviders(<UbSidebar />);
    const rail = screen.getByRole('navigation');
    // Owner, 12 Nov 2026: Apps is its own page, never a popover or a drawer.
    expect(within(rail).getByRole('link', { name: 'Apps' })).toHaveAttribute('href', '/apps');
    for (const other of ['Business', 'Money book', 'Ledger']) {
      expect(within(rail).queryByRole('link', { name: other })).not.toBeInTheDocument();
    }
    expect(within(rail).getByRole('link', { name: /Members|Students/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(rail).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('draws no Apps row for one app with nothing to add', () => {
    load(LIBRARY_ONLY);
    renderWithProviders(<UbSidebar />);
    expect(screen.queryByTestId('sidebar-apps-row')).not.toBeInTheDocument();
  });

  it('draws the Apps row for an owner with one app and one to add', () => {
    load(LIBRARY_ONLY, ADD_LENDING);
    renderWithProviders(<UbSidebar />);
    expect(screen.getByRole('link', { name: 'Apps' })).toBeInTheDocument();
  });

  it('opens another app from the Apps page where the person left it; Money book has no places', () => {
    load(APPS, ADD_LENDING);
    rememberAppPlace('t1', 'khata', '/khata/aging');
    renderWithProviders(<AppsPageContent />);
    const cards = within(screen.getByTestId('app-sheet-tiles')).getAllByRole('button');
    expect(cards.map((card) => card.textContent)).toEqual(['LibraryOpen now', 'BusinessBills, stock', 'Money bookYou gave, you got']);
    expect(within(screen.getByTestId('app-add-tiles')).getByRole('button')).toHaveTextContent(
      'Add Ledger'
    );
    fireEvent.click(screen.getByTestId('apps-card-khata'));
    expect(push).toHaveBeenCalledWith('/khata/aging');
    // Money book is the person's own (owner, 12 Nov 2026): no list, no ★, no Add.
    expect(screen.getByText('Your own money book')).toBeInTheDocument();
    expect(screen.queryByTestId('apps-places')).not.toBeInTheDocument();
  });

  /**
   * F4 screenshots: on the dark rail in the LIGHT theme every row label was
   * dark ink, nearly invisible. The row set the rail's light ink, and the
   * label inside it (`UbText`) applied its own default tone, `text-primary`,
   * which is dark in light and light in dark, so only the light theme broke
   * and the contrast gate, which reads tokens and not elements, passed.
   */
  it('lets every rail label take the rail ink from its row', () => {
    load(APPS);
    renderWithProviders(<UbSidebar />);
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('link')
      .flatMap((link) => [...link.querySelectorAll('span')])
      .filter((span) => span.textContent?.trim());
    expect(labels.length).toBeGreaterThan(3);
    for (const label of labels) {
      expect(label.className).not.toMatch(/\btext-text-(primary|secondary|tertiary)\b/);
    }
  });
});

/**
 * Owner, 14 Nov 2026: "Yes, bring back". Turn off (owner) and Leave (anyone
 * else) lived in the business menu at the top of the side menu; when the Apps
 * screen replaced that menu (12 Nov) nothing carried them over, so an owner
 * could add an app and never take it away, and a member could not step out of
 * one. They are on the Apps screen now, under the app they act on.
 */
describe('turn an app off or leave it, from the Apps page', () => {
  const after = (apps: SessionApp[], activeApp: string) => ({ ...store.getState().session, version: 2, apps, activeApp, appsAddable: [] });

  it('lets the owner turn off the open app after a confirmation, then opens the app that is left', async () => {
    load(APPS);
    authService.setAppRunning.mockResolvedValue(after(APPS.slice(1), 'shop'));
    renderWithProviders(<AppsPageContent />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off Library' }));
    expect(await screen.findByText('Turn off Library for Kumar Kirana?')).toBeInTheDocument();
    expect(authService.setAppRunning).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off Library' }));
    await waitFor(() => expect(authService.setAppRunning).toHaveBeenCalledWith('library', false));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByRole('button', { name: 'Leave Library' })).not.toBeInTheDocument();
  });

  it('lets a staff member leave the open app, and never offers them Turn off', async () => {
    load(APPS, [], undefined, 'staff');
    authService.leaveApp.mockResolvedValue(after(APPS.slice(1), 'shop'));
    renderWithProviders(<AppsPageContent />);
    expect(screen.queryByRole('button', { name: 'Turn off Library' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Library' }));
    expect(await screen.findByText('Leave Library at Kumar Kirana?')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave Library' }));
    await waitFor(() => expect(authService.leaveApp).toHaveBeenCalledWith('library'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('offers neither with one app (the last app cannot go), nor on the person\u2019s own Money book', () => {
    load(LIBRARY_ONLY);
    const { unmount } = renderWithProviders(<AppsPageContent />);
    expect(screen.queryByTestId('apps-app-action')).not.toBeInTheDocument();
    unmount();
    load(APPS);
    renderWithProviders(<AppsPageContent />);
    fireEvent.click(screen.getByTestId('apps-card-khata'));
    expect(screen.queryByTestId('apps-app-action')).not.toBeInTheDocument();
  });
});
