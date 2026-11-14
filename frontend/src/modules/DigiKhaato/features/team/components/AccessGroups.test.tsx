import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { resetMembers } from '../redux/memberSlice';

import { MembersSection } from './MembersSection';
import { TeamPageContent } from './TeamPageContent';

/**
 * Access groups (owner, 14 Nov 2026; design docs/revamp/design/access-groups.html).
 * Team follows the open business AND app: here Business is open, so the page
 * manages Business only. Each test names what the owner would see go wrong.
 */
jest.mock('../api/memberService');
jest.mock('../api/roleService');

const memberService = jest.requireMock('../api/memberService') as {
  listMembers: jest.Mock;
  updateMember: jest.Mock;
  blockMember: jest.Mock;
  unblockMember: jest.Mock;
  removeMember: jest.Mock;
};
jest.mock('../api/accessGroupService');
jest.mock('../api/invitationService');
const invitations = jest.requireMock('../api/invitationService') as { listInvitations: jest.Mock };
const access = jest.requireMock('../api/accessGroupService') as {
  getAccessGroups: jest.Mock;
  createAccessGroup: jest.Mock;
  updateAccessGroup: jest.Mock;
  deleteAccessGroup: jest.Mock;
  getMemberAccess: jest.Mock;
  setMemberAccess: jest.Mock;
};
let mockPath = '/dashboard';
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
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

const PARTS = [
  { part: 'sales', levels: ['off', 'view', 'full'] },
  { part: 'purchases', levels: ['off', 'view', 'full'] },
  { part: 'stock', levels: ['off', 'view', 'full'] },
];
const COUNTER = { id: 'g1', app: 'shop', name: 'Counter staff', isDefault: true, levels: { sales: 'full', purchases: 'off', stock: 'view' }, members: 2 };
const PAYLOAD = { app: 'shop', parts: PARTS, groups: [COUNTER], suggested: { name: 'Counter staff', levels: COUNTER.levels } };
const MINE = {
  app: 'shop',
  canUse: true,
  narrowed: true,
  groupId: 'g1',
  groupName: 'Counter staff',
  parts: [
    { part: 'sales', levels: ['off', 'view', 'full'], groupLevel: 'full', level: 'full' },
    { part: 'purchases', levels: ['off', 'view', 'full'], groupLevel: 'off', level: 'off' },
    { part: 'stock', levels: ['off', 'view', 'full'], groupLevel: 'view', level: 'full' },
  ],
  changes: 1,
};

beforeEach(() => {
  mockPath = '/dashboard';
  invitations.listInvitations.mockResolvedValue({ rows: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  access.getAccessGroups.mockResolvedValue(PAYLOAD);
  access.getMemberAccess.mockResolvedValue(MINE);
  access.setMemberAccess.mockResolvedValue(MINE);
  access.createAccessGroup.mockResolvedValue(COUNTER);
  access.updateAccessGroup.mockResolvedValue(COUNTER);
  memberService.listMembers.mockResolvedValue(
    page(ROWS.map((r) => ({ ...r, access: r.role === 'owner' || r.role === 'admin' ? null : { canUse: true, groupId: 'g1', groupName: 'Counter staff', changes: r.id === 'm-staff' ? 1 : 0 } })))
  );
});

describe('Team follows the open business and app', () => {
  it('says which app and business it is for, and asks the server for this app only', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<TeamPageContent />);
    expect(await screen.findByText('Business · Kumar Stores')).toBeInTheDocument();
    await waitFor(() => expect(memberService.listMembers).toHaveBeenCalledWith(expect.objectContaining({ app: 'shop' }), expect.anything()));
    // Each member's group in Business, and the one who differs from it.
    expect((await screen.findAllByText('Counter staff')).length).toBeGreaterThan(0);
    expect(screen.getByText('1 change from the group')).toBeInTheDocument();
  });

  it('lists this app\u2019s groups by level, every part named once', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<TeamPageContent />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Access groups' }));
    expect(await screen.findByText('Full: Sales · View only: Stock · Off: Purchases')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(access.getAccessGroups).toHaveBeenCalledWith('shop', expect.anything());
  });

  it('offers the server\u2019s example when there are no groups, and starts the form from it', async () => {
    access.getAccessGroups.mockResolvedValue({ ...PAYLOAD, groups: [] });
    signInAs('u-owner', 'owner');
    renderWithProviders(<TeamPageContent />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Access groups' }));
    expect(await screen.findByText('No groups for Business yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make "Counter staff"' }));
    const name = await screen.findByTestId('access-group-name');
    expect(name).toHaveValue('Counter staff');
    await userEvent.click(screen.getByTestId('access-group-save'));
    await waitFor(() =>
      expect(access.createAccessGroup).toHaveBeenCalledWith('shop', { name: 'Counter staff', isDefault: false, levels: COUNTER.levels })
    );
  });

  it('will not save a group with no name', async () => {
    access.getAccessGroups.mockResolvedValue({ ...PAYLOAD, groups: [] });
    signInAs('u-owner', 'owner');
    renderWithProviders(<TeamPageContent />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Access groups' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Make my own group' }));
    await userEvent.click(await screen.findByTestId('access-group-save'));
    expect(await screen.findByText('Give the group a name.')).toBeInTheDocument();
    expect(access.createAccessGroup).not.toHaveBeenCalled();
  });

  it('says how many members change when a group with members is saved', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<TeamPageContent />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Access groups' }));
    const [edit] = await screen.findAllByTestId('access-group-edit');
    if (!edit) throw new Error('no Edit button');
    await userEvent.click(edit);
    expect(await screen.findByRole('button', { name: 'Save · 2 members change' })).toBeInTheDocument();
  });
});

describe('one member\u2019s access in the open app', () => {
  const openAccess = async (name: string) => {
    await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
    await userEvent.click(await within(screen.getByRole('dialog', { name })).findByRole('button', { name: /^Access/ }));
    return screen.findByTestId('member-access');
  };

  it('marks a part that differs from the group, and "Use group again" drops it', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const sheet = await openAccess('Ramesh Kumar');
    expect(within(sheet).getByText('1 change from the group')).toBeInTheDocument();
    expect(within(sheet).getByText('Group: View only')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Use group again' }));
    expect(within(sheet).queryByText('Group: View only')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('member-access-save'));
    await waitFor(() => expect(access.setMemberAccess).toHaveBeenCalledWith('m-staff', 'shop', { groupId: 'g1', exceptions: {} }));
  });

  it('sends a part changed from the group as an exception', async () => {
    access.getMemberAccess.mockResolvedValue({ ...MINE, changes: 0, parts: MINE.parts.map((p) => ({ ...p, level: p.groupLevel })) });
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const sheet = await openAccess('Ramesh Kumar');
    await userEvent.click(within(within(sheet).getByTestId('part-purchases')).getByRole('button', { name: 'View only' }));
    await userEvent.click(screen.getByTestId('member-access-save'));
    await waitFor(() =>
      expect(access.setMemberAccess).toHaveBeenCalledWith('m-staff', 'shop', { groupId: 'g1', exceptions: { purchases: 'view' } })
    );
  });

  it('sends can_use only when it changes, so a plain save never touches their apps', async () => {
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    const sheet = await openAccess('Ramesh Kumar');
    await userEvent.click(within(sheet).getByRole('switch', { name: /Can use Business here/ }));
    await userEvent.click(screen.getByTestId('member-access-save'));
    await waitFor(() => expect(access.setMemberAccess).toHaveBeenCalledWith('m-staff', 'shop', expect.objectContaining({ canUse: false })));
  });

  it('offers no Access row in a person\u2019s own app (Money book)', async () => {
    mockPath = '/money-book';
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Ramesh Kumar' }));
    expect(within(screen.getByRole('dialog', { name: 'Ramesh Kumar' })).queryByRole('button', { name: /^Access/ })).not.toBeInTheDocument();
  });
});

describe('Add member inside an app', () => {
  it('keeps what the owner typed when the app\u2019s groups arrive, and picks the default group', async () => {
    let arrive: (value: unknown) => void = () => undefined;
    access.getAccessGroups.mockReturnValue(new Promise((resolve) => (arrive = resolve)));
    signInAs('u-owner', 'owner');
    renderWithProviders(<MembersSection />);
    await userEvent.click(await screen.findByRole('button', { name: /Add member/ }));
    const name = await screen.findByLabelText(/Full name/);
    await userEvent.type(name, 'Suresh Patil');
    arrive(PAYLOAD);
    expect((await screen.findAllByText('Counter staff (default)')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Suresh Patil');
  });
});
