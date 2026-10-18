import { fireEvent, screen, within } from '@testing-library/react';

import { MobileTabBar } from 'src/components/layout/MobileTabBar';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded, type SessionApp } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import { MODULE_CODES, type PermissionCode } from 'src/types/domain.types';

import { APP_MANIFESTS } from 'modules/appManifests';

import { PLATFORM_NAV_ITEMS } from '../appManifest';
import { rememberAppPlace } from '../appPlace';
import { resetNavigationSyncForTests } from '../useNavigation';

import { SidebarAppTree } from './SidebarAppTree';

/**
 * Revamp 04 §2–3 (N-1) — switching app is one visible tap on both shapes.
 *
 * The defect: on a phone the only way to another app was the business menu at
 * the top of the screen, where apps and businesses were one list, and on a
 * laptop the rail showed one app's rows with no sign there were others. Now
 * the phone's fifth slot is the App button and the rail is an app tree; with a
 * single app both stay exactly as they were.
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

const load = (apps: SessionApp[]) => {
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

describe('desktop app tree', () => {
  it('expands the open app to its rows and keeps the others one row each', () => {
    load(APPS);
    renderWithProviders(<SidebarAppTree />);
    const tree = screen.getByTestId('sidebar-app-tree');
    const appRows = within(tree)
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-expanded'));
    expect(appRows.map((row) => [row.textContent, row.getAttribute('aria-expanded')])).toEqual([
      ['Library', 'true'],
      ['Shop', 'false'],
      ['Udhaar book', 'false'],
    ]);
    expect(within(tree).getByRole('link', { name: /Members|Students/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    // Team and Settings belong to the business, not to the open app.
    expect(within(tree).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens a collapsed app where the person left it', () => {
    load(APPS);
    rememberAppPlace('t1', 'khata', '/khata/aging');
    renderWithProviders(<SidebarAppTree />);
    fireEvent.click(screen.getByRole('link', { name: 'Udhaar book' }));
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
    renderWithProviders(<SidebarAppTree />);
    const labels = within(screen.getByTestId('sidebar-app-tree'))
      .getAllByRole('link')
      .flatMap((link) => [...link.querySelectorAll('span')])
      .filter((span) => span.textContent?.trim());
    expect(labels.length).toBeGreaterThan(3);
    for (const label of labels) {
      expect(label.className).not.toMatch(/\btext-text-(primary|secondary|tertiary)\b/);
    }
  });
});
