import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import * as stock from '../api/stockService';
import { useStockAdjustment } from '../hooks/useStockAdjustment';
import { adjustmentClosed, adjustmentOpened } from '../redux/stockAdjustmentSlice';

import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';

import type { AdjustmentFormLine, StockAdjustment } from '../types/item.types';

/**
 * 09 §8.4 — the adjustment drawer as a shopkeeper uses it after a shelf count:
 * a reason chip, then Add / Remove / Set to with an unsigned number, the figure
 * each line will leave, and a consequence line that shows internal cost only to
 * a member allowed to see it. Each test names the defect it keeps out.
 */
jest.mock('../hooks/useInventoryMasters', () => ({
  useInventoryMasters: () => ({ units: [], categories: [], taxRates: [] }),
}));
jest.mock('../api/stockService', () => ({
  ...jest.requireActual('../api/stockService'),
  postAdjustment: jest.fn(),
}));

const LINE: AdjustmentFormLine = {
  itemId: 'i1',
  itemName: 'Atta 10 kg bag',
  unitCode: 'BAG',
  allowDecimal: false,
  onHand: '5.000',
  avgCost: '380.0000',
  mode: 'remove',
  qty: '',
  unitCost: '',
};

const signIn = (permissions: readonly PermissionCode[]): void => {
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
      activeTenant: { id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['inventory'],
      version: 1,
    } as Parameters<typeof sessionLoaded>[0])
  );
};

function Host(): React.JSX.Element | null {
  const adjustment = useStockAdjustment();
  return adjustment.open ? <StockAdjustmentDrawer adjustment={adjustment} /> : null;
}

const open = async (permissions: readonly PermissionCode[]) => {
  signIn(permissions);
  renderWithProviders(<Host />);
  act(() => {
    store.dispatch(adjustmentOpened([LINE]));
  });
  return screen.findByRole('dialog');
};

afterEach(() => {
  act(() => {
    store.dispatch(adjustmentClosed());
  });
  jest.mocked(stock.postAdjustment).mockReset();
});

const ADJUST: readonly PermissionCode[] = ['inventory.stock.adjust', 'inventory.stock.read'];

test('the reason is five chips, and Counted turns an untyped line into "Set to"', async () => {
  const user = userEvent.setup();
  const dialog = await open(ADJUST);
  const reasons = within(dialog).getByRole('radiogroup', { name: 'Reason' });
  expect(within(reasons).getAllByRole('radio')).toHaveLength(5);
  // A select of five words hid the choice behind a tap; a count is "Set to".
  await user.click(within(reasons).getByRole('radio', { name: 'Counted' }));
  expect(within(dialog).getByPlaceholderText('Count')).toBeInTheDocument();
  await user.click(within(reasons).getByRole('radio', { name: 'Damaged' }));
  expect(within(dialog).getByPlaceholderText('How many')).toBeInTheDocument();
});

test('Remove takes an unsigned number and the line says what it leaves', async () => {
  const user = userEvent.setup();
  const dialog = await open(ADJUST);
  await user.type(within(dialog).getByPlaceholderText('How many'), '2');
  // No minus typed, and still a loss of two: the mode is the sign.
  expect(within(dialog).getAllByText('3 BAG').length).toBeGreaterThan(0);
});

test('without cost permission the consequence counts units, not rupees', async () => {
  const user = userEvent.setup();
  const dialog = await open(ADJUST);
  await user.type(within(dialog).getByPlaceholderText('How many'), '2');
  const line = screen.getByTestId('adjust-consequence');
  expect(line).toHaveTextContent('1 item · −2 BAG');
  expect(line).not.toHaveTextContent('₹');
  expect(within(dialog).queryByText('Value impact')).toBeNull();
});

test('with cost permission the consequence carries the value at average cost', async () => {
  const user = userEvent.setup();
  const dialog = await open([...ADJUST, 'reports.financial.read']);
  await user.type(within(dialog).getByPlaceholderText('How many'), '2');
  expect(screen.getByTestId('adjust-consequence')).toHaveTextContent('₹760.00');
});

test('Save posts the signed quantity and the snackbar offers View', async () => {
  const user = userEvent.setup();
  jest.mocked(stock.postAdjustment).mockResolvedValue({
    id: 'adj1',
    number: 'ADJ-0007',
  } as StockAdjustment);
  const dialog = await open(ADJUST);
  await user.click(within(dialog).getByRole('radio', { name: 'Damaged' }));
  await user.type(within(dialog).getByPlaceholderText('How many'), '2');
  await user.click(within(dialog).getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() => expect(stock.postAdjustment).toHaveBeenCalled());
  const [body] = jest.mocked(stock.postAdjustment).mock.calls[0] ?? [];
  expect(body?.reason).toBe('damage');
  expect(body?.lines[0]).toMatchObject({ item_id: 'i1', qty: '-2.000' });
  await waitFor(() =>
    expect(store.getState().snackbar.action).toEqual({
      labelId: 'stock.adjust.view',
      then: expect.objectContaining({ payload: 'adj1' }),
    })
  );
});
