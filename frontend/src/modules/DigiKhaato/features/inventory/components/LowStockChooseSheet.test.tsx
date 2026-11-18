import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { LowStockChooseSheet } from './LowStockChooseSheet';

import type { LowStockRow } from '../types/item.types';

const row = (id: string, name: string, onHand: string): LowStockRow => ({
  item: { id, name, sku: id, unitCode: 'NOS', allowDecimal: false },
  onHand,
  reorderPoint: '10',
  stockStatus: onHand === '0' ? 'out' : 'low',
  avgCost: null,
  lastPurchaseCost: null,
  suggestedQty: '17',
});
const ROWS = [row('a', 'Besan pack', '3'), row('b', 'Rava pack', '0'), row('c', 'Atta 5kg', '2')];

/** Owner, 16 Nov 2026: a phone orders CHOSEN items, not only the whole list. */
it('orders only the ticked items, and nothing until one is ticked', async () => {
  const onOrder = jest.fn();
  renderWithProviders(<LowStockChooseSheet rows={ROWS} onOrder={onOrder} onClose={jest.fn()} />);
  const order = await screen.findByTestId('low-stock-choose-order');
  expect(order).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: /Rava pack/ }));
  expect(order).toHaveTextContent('Order 1 item');
  await userEvent.click(order);
  expect(onOrder).toHaveBeenCalledWith([ROWS[1]]);
});

it('Tick all takes every row, and again clears them', async () => {
  const onOrder = jest.fn();
  renderWithProviders(<LowStockChooseSheet rows={ROWS} onOrder={onOrder} onClose={jest.fn()} />);
  const all = await screen.findByRole('checkbox', { name: 'Tick all' });
  await userEvent.click(all);
  expect(screen.getByTestId('low-stock-choose-order')).toHaveTextContent('Order 3 items');
  await userEvent.click(all);
  expect(screen.getByTestId('low-stock-choose-order')).toBeDisabled();
});
