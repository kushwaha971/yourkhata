import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { InventoryMastersPageContent } from './InventoryMastersPageContent';

import type { Category, Unit } from '../types/item.types';

/**
 * 09 §8.5 — the categories and units page is "find → add". These guard the
 * three things it promises: a search that finds nothing offers to add what was
 * typed (and the dialog opens with it), a name that already exists is refused
 * in words before any request, and the standard GST units come first, locked,
 * saying so to a screen reader.
 */
jest.mock('../api/mastersService', () => ({
  listUnits: jest.fn(),
  listCategories: jest.fn(),
  listTaxRates: jest.fn().mockResolvedValue([]),
  createCategory: jest.fn(),
  createUnit: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/items/masters',
}));

const service = jest.requireMock('../api/mastersService') as {
  listUnits: jest.Mock;
  listCategories: jest.Mock;
  createCategory: jest.Mock;
  createUnit: jest.Mock;
};

const unit = (code: string, isSystem: boolean): Unit => ({
  id: code,
  code,
  name: code === 'NOS' ? 'Numbers' : `${code} name`,
  allowDecimal: false,
  isSystem,
  isUqc: isSystem,
});
const category = (id: string, name: string, children: Category[] = []): Category => ({
  id,
  name,
  parentId: null,
  itemCount: 2,
  children,
});

const signIn = (permissions: readonly PermissionCode[]) =>
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
      activeTenant: { id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['inventory'],
      version: 1,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(resetAllFeatureState());
  service.listUnits.mockResolvedValue([unit('BAG', false), unit('NOS', true), unit('KGS', true)]);
  service.listCategories.mockResolvedValue([
    category('c1', 'Grocery', [{ ...category('c2', 'Dal'), parentId: 'c1' }]),
    category('c3', 'Snacks'),
  ]);
  signIn(['inventory.item.read', 'inventory.item.write']);
});

it('offers to add a category nobody has made yet, with the searched name filled in', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InventoryMastersPageContent />);
  await screen.findByText('Grocery');
  await user.type(screen.getByRole('searchbox', { name: 'Find a category' }), 'Dry fruits');
  expect(screen.getByText('Nothing matches “Dry fruits”.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add it as a category' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('textbox', { name: /Category name/ })).toHaveValue('Dry fruits');
});

it('keeps a parent on screen when only its child matches', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InventoryMastersPageContent />);
  await screen.findByText('Grocery');
  await user.type(screen.getByRole('searchbox', { name: 'Find a category' }), 'dal');
  const list = screen.getByTestId('category-list');
  expect(within(list).getByText('Grocery')).toBeInTheDocument();
  expect(within(list).getByText('Dal')).toBeInTheDocument();
  expect(within(list).queryByText('Snacks')).not.toBeInTheDocument();
});

it('says a category already exists instead of sending it', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InventoryMastersPageContent />);
  await screen.findByText('Grocery');
  await user.click(screen.getByRole('button', { name: 'Add category' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByRole('textbox', { name: /Category name/ }), ' snacks ');
  await user.click(within(dialog).getByRole('button', { name: 'Add category' }));
  expect(await within(dialog).findByText('Already exists.')).toBeInTheDocument();
  expect(service.createCategory).not.toHaveBeenCalled();
});

it('lists the standard units first, locked, and the shop’s own below', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InventoryMastersPageContent />);
  await user.click(await screen.findByRole('tab', { name: 'Units' }));
  const standard = await screen.findByTestId('unit-list-standard');
  const own = screen.getByTestId('unit-list-own');
  expect(standard.compareDocumentPosition(own) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(standard).getAllByText("Standard unit, can't be changed")).toHaveLength(2);
  expect(within(own).getByText('BAG')).toBeInTheDocument();
});

it('refuses a unit code that already exists, standard or not', async () => {
  const user = userEvent.setup();
  renderWithProviders(<InventoryMastersPageContent />);
  await user.click(await screen.findByRole('tab', { name: 'Units' }));
  await user.type(screen.getByRole('searchbox', { name: 'Find a unit' }), 'box');
  await user.click(screen.getByRole('button', { name: 'Add it as a unit' }));
  const dialog = await screen.findByRole('dialog');
  const code = within(dialog).getByRole('textbox', { name: /Code/ });
  expect(code).toHaveValue('BOX');
  await user.clear(code);
  await user.type(code, 'nos');
  await user.type(within(dialog).getByRole('textbox', { name: /Unit name/ }), 'Pieces');
  await user.click(within(dialog).getByRole('button', { name: 'Add unit' }));
  expect(await within(dialog).findByText('Already exists.')).toBeInTheDocument();
  expect(service.createUnit).not.toHaveBeenCalled();
});

it('shows no Add to a member who may only read', async () => {
  signIn(['inventory.item.read']);
  renderWithProviders(<InventoryMastersPageContent />);
  await screen.findByText('Grocery');
  expect(screen.queryByRole('button', { name: 'Add category' })).not.toBeInTheDocument();
  await waitFor(() => expect(service.listUnits).toHaveBeenCalled());
});
