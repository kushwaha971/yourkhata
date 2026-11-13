import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { resetMembers } from '../redux/memberSlice';

import { MembersSection } from './MembersSection';

/**
 * Owner, 14 Nov 2026 — choose which apps a member can open in this business,
 * without blocking them. Block took the whole business away, so an owner who
 * wanted the collection agent out of Business and in Ledger had no way to say
 * it. Each test names the defect it prevents.
 */
jest.mock('../api/memberService');
jest.mock('../api/roleService');

const memberService = jest.requireMock('../api/memberService') as {
  listMembers: jest.Mock;
  updateMember: jest.Mock;
  blockMember: jest.Mock;
  unblockMember: jest.Mock;
  removeMember: jest.Mock;
  getMemberApps: jest.Mock;
  setMemberApps: jest.Mock;
};
const roleService = jest.requireMock('../api/roleService') as { fetchRoles: jest.Mock };

const base = {
  email: 'x@shop.test',
  mobile: null,
  roleLabelId: '',
  roleModule: null,
  roleActive: true,
  status: 'active',
  joinedAt: '2026-09-21T09:00:00Z',
  lastLoginAt: null,
  mustChangePassword: false,
  passwordExpiresAt: null,
};

const OWNER_ROW = {
  ...base,
  id: 'm-owner',
  userId: 'u-owner',
  fullName: 'Asha Owner',
  role: 'owner',
};
const ADMIN_ROW = {
  ...base,
  id: 'm-admin',
  userId: 'u-admin',
  fullName: 'Vikram Admin',
  role: 'admin',
};
const STAFF_ROW = {
  ...base,
  id: 'm-staff',
  userId: 'u-staff',
  fullName: 'Ramesh Kumar',
  role: 'staff',
};
const BLOCKED_ROW = {
  ...base,
  id: 'm-blocked',
  userId: 'u-blocked',
  fullName: 'Suresh Blocked',
  role: 'staff',
  status: 'suspended',
};
const ROWS = [OWNER_ROW, ADMIN_ROW, STAFF_ROW, BLOCKED_ROW];

const page = (rows: readonly unknown[]) => ({
  rows,
  meta: { page: 1, pageSize: 25, total: rows.length, totalPages: 1 },
});

const signInAs = (userId: string, role: string): void => {
  store.dispatch(
    sessionLoaded({
      user: {
        id: userId,
        name: 'Viewer',
        email: 'viewer@shop.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata', role },
      tenants: [{ id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata', role }],
      permissions: ['platform.members.manage'],
      enabledModules: [],
      version: 1,
      apps: [
        { code: 'library', labelId: 'nav.workspace.library', homePath: '/library', order: 10 },
        { code: 'lending', labelId: 'nav.workspace.lending', homePath: '/lending', order: 20 },
        { code: 'shop', labelId: 'nav.workspace.shop', homePath: '/dashboard', order: 30 },
        { code: 'khata', labelId: 'nav.workspace.khata', homePath: '/money-book', order: 40 },
      ],
      activeApp: 'shop',
    })
  );
};

beforeEach(() => {
  store.dispatch(resetMembers());
  jest.clearAllMocks();
  memberService.listMembers.mockResolvedValue(page(ROWS));
  roleService.fetchRoles.mockResolvedValue([]);
});

const openApps = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await userEvent.click(await screen.findByRole('button', { name: /^Apps/ }));
  return screen.findByRole('dialog', { name: `Apps for ${name}` });
};

describe('apps a member can open', () => {
  beforeEach(() => {
    memberService.getMemberApps.mockResolvedValue({ grants: [], opens: ['library', 'lending', 'shop', 'khata'] });
    memberService.setMemberApps.mockImplementation(async (_id: string, grants: { app: string }[]) => ({
      grants,
      opens: grants.map((g) => g.app),
    }));
  });

  it('ticks what the member opens TODAY, even with no grants saved (an older member has every app)', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const dialog = await openApps('Ramesh Kumar');
    await waitFor(() => expect(within(dialog).getByRole('switch', { name: /Business/ })).toBeChecked());
    expect(within(dialog).getByRole('switch', { name: /Library/ })).toBeChecked();
    expect(within(dialog).getByRole('switch', { name: /Ledger/ })).toBeChecked();
    // Money book is the person's own: never a switch.
    expect(within(dialog).queryByRole('switch', { name: /Money book/ })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('They keep their own Money book');
  });

  it('saves only the apps left on, in their role, and keeps their own Money book', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const dialog = await openApps('Ramesh Kumar');
    const shop = await within(dialog).findByRole('switch', { name: /Business/ });
    await waitFor(() => expect(shop).toBeChecked());
    await userEvent.click(shop);
    await userEvent.click(within(dialog).getByRole('switch', { name: /Library/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(memberService.setMemberApps).toHaveBeenCalledWith('m-staff', [
        { app: 'lending', role: 'staff' },
        { app: 'khata', role: 'staff' },
      ])
    );
    // The global snackbar (mounted once in AppProviders) carries the sentence.
    await waitFor(() => expect(JSON.stringify(store.getState().snackbar)).toMatch(/Ramesh Kumar now opens Ledger only here/));
    expect(screen.queryByRole('dialog', { name: 'Apps for Ramesh Kumar' })).not.toBeInTheDocument();
  });

  it('keeps a role already given for one app instead of resetting it to their business role', async () => {
    memberService.getMemberApps.mockResolvedValue({
      grants: [{ app: 'shop', role: 'accountant' }, { app: 'lending', role: 'staff' }],
      opens: ['lending', 'shop'],
    });
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const dialog = await openApps('Ramesh Kumar');
    await waitFor(() => expect(within(dialog).getByRole('switch', { name: /Business/ })).toBeChecked());
    expect(within(dialog).getByRole('switch', { name: /Library/ })).not.toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(memberService.setMemberApps).toHaveBeenCalledWith('m-staff', [
        { app: 'lending', role: 'staff' },
        { app: 'shop', role: 'accountant' },
        { app: 'khata', role: 'staff' },
      ])
    );
  });

  it('will not save with every app off, and says Block is for stopping them', async () => {
    memberService.getMemberApps.mockResolvedValue({ grants: [{ app: 'lending', role: 'staff' }], opens: ['lending'] });
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const dialog = await openApps('Ramesh Kumar');
    const lending = await within(dialog).findByRole('switch', { name: /Ledger/ });
    await waitFor(() => expect(lending).toBeChecked());
    await userEvent.click(lending);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/Keep at least one app on/)).toBeInTheDocument();
    expect(memberService.setMemberApps).not.toHaveBeenCalled();
  });

  it('is not offered on a blocked row, the owner row, or to an admin on another admin', async () => {
    signInAs('u-admin', 'admin');
    renderWithProviders(<MembersSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Suresh Blocked' }));
    expect(screen.queryByRole('button', { name: /^Apps/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Vikram Admin' })).not.toBeInTheDocument();
  });
});
