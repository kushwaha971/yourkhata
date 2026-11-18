import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { PartyQuickSearch } from './PartyQuickSearch';

/**
 * Owner, 5 Oct 2026 — the header's "Search customers and suppliers" opened
 * onto nothing until two characters were typed. It lists on focus (the people
 * traded with most recently), pages with ↓ past the last row or by scrolling,
 * and narrows as the merchant types.
 */
jest.mock('../api/partyService', () => ({ listParties: jest.fn() }));
const partyService = jest.requireMock('../api/partyService') as { listParties: jest.Mock };

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}));

const party = (n: number) => ({
  id: `p${n}`,
  name: `Party ${n}`,
  mobile: null,
  balance: '0.00',
  isCustomer: true,
  isSupplier: false,
});
const page = (from: number, count: number, pageNo: number, totalPages: number) => ({
  rows: Array.from({ length: count }, (_, i) => party(from + i)),
  meta: { page: pageNo, pageSize: 20, total: totalPages * 20, totalPages },
  totals: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Owner',
        email: 'owner@shop.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Sharma Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Sharma Store', timezone: 'Asia/Kolkata' }],
      permissions: ['parties.party.read'] as PermissionCode[],
      enabledModules: ['parties'],
      version: 1,
    })
  );
});

it('asks for nothing until it is focused', () => {
  renderWithProviders(<PartyQuickSearch />);
  expect(partyService.listParties).not.toHaveBeenCalled();
});

it('lists the most recent parties on focus, before anything is typed', async () => {
  partyService.listParties.mockResolvedValue(page(1, 20, 1, 2));
  const user = userEvent.setup();
  renderWithProviders(<PartyQuickSearch />);
  await user.click(screen.getByRole('combobox'));
  expect(await screen.findAllByRole('option')).toHaveLength(20);
  expect(partyService.listParties.mock.calls[0]?.[0]).toMatchObject({
    q: '',
    ordering: '-last_activity_at',
    page: 1,
  });
});

it('fetches the next page with ↓ on the last row', async () => {
  partyService.listParties
    .mockResolvedValueOnce(page(1, 20, 1, 2))
    .mockResolvedValueOnce(page(21, 5, 2, 2));
  const user = userEvent.setup();
  renderWithProviders(<PartyQuickSearch />);
  await user.click(screen.getByRole('combobox'));
  await screen.findAllByRole('option');
  for (let i = 0; i < 19; i += 1) await user.keyboard('{ArrowDown}');
  await user.keyboard('{ArrowDown}');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(25));
  expect(partyService.listParties.mock.calls[1]?.[0]).toMatchObject({ page: 2 });
});

it('narrows by name as the merchant types', async () => {
  partyService.listParties.mockResolvedValue(page(1, 3, 1, 1));
  const user = userEvent.setup();
  renderWithProviders(<PartyQuickSearch />);
  await user.type(screen.getByRole('combobox'), 'Ram');
  await waitFor(() =>
    expect(partyService.listParties).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'Ram', ordering: 'name', page: 1 }),
      expect.any(AbortSignal)
    )
  );
});

it('keeps Shop header search scoped and opens a supplier in its supplier workspace', async () => {
  /** Global search must neither borrow Udhaar rights nor show a netted Shop amount. */
  partyService.listParties.mockResolvedValue({rows:[{...party(1),isCustomer:false,isSupplier:true,balance:'-500.00'}],meta:{page:1,pageSize:20,total:1,totalPages:1},totals:null});
  renderWithProviders(<PartyQuickSearch book="shop" />);
  await userEvent.click(screen.getByRole('combobox'));
  const option=await screen.findByRole('option');
  expect(partyService.listParties).toHaveBeenLastCalledWith(expect.objectContaining({book:'shop'}),expect.any(AbortSignal));
  expect(option).not.toHaveTextContent('500');
  await userEvent.click(option);
  expect(push).toHaveBeenCalledWith('/parties/p1?from=suppliers');
});

it('does not open an old contact when Enter is pressed before a new query answers', async () => {
  /** A quick typist must not navigate to the previous name's retained row. */
  partyService.listParties.mockResolvedValue(page(1,1,1,1));
  const user=userEvent.setup();
  renderWithProviders(<PartyQuickSearch book="shop" />);
  await user.click(screen.getByRole('combobox'));
  await screen.findByRole('option');
  partyService.listParties.mockImplementation(()=>new Promise(()=>undefined));
  await user.type(screen.getByRole('combobox'),'Electrical');
  await user.keyboard('{Enter}');
  expect(push).not.toHaveBeenCalled();
});
