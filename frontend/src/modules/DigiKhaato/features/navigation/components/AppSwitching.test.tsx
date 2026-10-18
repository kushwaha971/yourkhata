import { fireEvent, screen, within } from '@testing-library/react';

import { MobileTabBar } from 'src/components/layout/MobileTabBar';
import { UbSidebar } from 'src/components/layout/UbSidebar';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded, type SessionApp } from 'src/redux/slice/sessionSlice';
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
let mockPath = '/library/members';
const push = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockPath,
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('../../auth/api/authService', () => ({
  ...jest.requireActual('../../auth/api/authService'),
  switchApp: jest.fn(() => new Promise(() => undefined)),
}));

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

const load = (apps: SessionApp[], appsAddable: SessionApp[] = []) => {
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
      activeTenant: { id: 't1', name: 'Kumar Kirana', timezone: 'Asia/Kolkata', role: 'owner' },
      tenants: [{ id: 't1', name: 'Kumar Kirana', timezone: 'Asia/Kolkata', role: 'owner' }],
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
  push.mockReset();
  window.sessionStorage.clear();
  resetNavigationSyncForTests();
  mockPath = '/library/members';
});

describe('phone App button', () => {
  it('replaces More with the open app, and opens a sheet of apps and More rows', async () => {
    load(APPS);
    renderWithProviders(<MobileTabBar />);
    const button = screen.getByRole('button', { name: 'Apps and more, now in Library' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('link', { name: 'More' })).not.toBeInTheDocument();

    fireEvent.click(button);
    const sheet = await screen.findByRole('dialog', { name: 'Apps and more' });
    const tiles = within(within(sheet).getByTestId('app-sheet-tiles')).getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual(['Library', 'Shop', 'Udhaar book']);
    expect(tiles[0]).toHaveAttribute('aria-current', 'true');
    // Everything the More page held is in the same sheet.
    expect(within(sheet).getByRole('searchbox', { name: 'Find a feature' })).toBeInTheDocument();
  });

  it('opens another app where the person left it', () => {
    load(APPS);
    rememberAppPlace('t1', 'shop', '/sales/invoices');
    renderWithProviders(<MobileTabBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Apps and more, now in Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
    expect(push).toHaveBeenCalledWith('/sales/invoices');
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
    expect(within(rail).getByRole('link', { name: 'Apps' })).toHaveAttribute('href', '/apps');
    for (const other of ['Shop', 'Udhaar book', 'Lending']) {
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

  it('opens another app from the Apps page where the person left it', () => {
    load(APPS, ADD_LENDING);
    rememberAppPlace('t1', 'khata', '/khata/aging');
    renderWithProviders(<AppsPageContent />);
    const tiles = within(screen.getByTestId('app-sheet-tiles')).getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual(['Library', 'Shop', 'Udhaar book']);
    expect(within(screen.getByTestId('app-add-tiles')).getByRole('button')).toHaveTextContent(
      'Add Lending'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Udhaar book' }));
    expect(push).toHaveBeenCalledWith('/khata/aging');
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
