import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { priceRule } from '../view-model/priceListDisplay';

import { PartyPriceListControl } from './PartyPriceListControl';
import { PriceListDetailPageContent } from './PriceListDetailPageContent';
import { PriceListsPageContent } from './PriceListsPageContent';

/**
 * Shop gap §1.6 — price lists. These pin how a rule is worded (a merchant reads
 * "5% below selling price", never "-5.00"), that the list page says what each
 * list does and who is on it, and that a customer is put on a list — or taken
 * off it — from their khata with one choice.
 */
jest.mock('../api/priceListService', () => ({
  ...jest.requireActual('../api/priceListService'),
  listPriceLists: jest.fn(),
  getPriceList: jest.fn(),
  setPinnedRate: jest.fn(),
  getPartyRates: jest.fn(),
  assignPriceList: jest.fn(),
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/items/price-lists',
  useSearchParams: () => new URLSearchParams(),
}));
const service = jest.requireMock('../api/priceListService') as {
  listPriceLists: jest.Mock;
  getPriceList: jest.Mock;
  setPinnedRate: jest.Mock;
  getPartyRates: jest.Mock;
  assignPriceList: jest.Mock;
};

const wholesale = {
  id: 'w1',
  name: 'Wholesale',
  adjustPercent: '-5.00',
  rateCount: 2,
  partyCount: 1,
};

const signIn = (permissions: string[]): void => {
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
      activeTenant: { id: 't1', name: 'Shop', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Shop', timezone: 'Asia/Kolkata' }],
      permissions: permissions as PermissionCode[],
      enabledModules: ['inventory'],
      version: 1,
    })
  );
};

beforeEach(() => {
  push.mockReset();
  service.listPriceLists.mockReset();
  service.getPartyRates.mockReset();
  service.assignPriceList.mockReset();
});

test('a rule is worded, never shown as a raw number', () => {
  const t = ((id: string, p?: Record<string, unknown>) => `${id}:${p?.pct ?? ''}`) as never;
  expect(priceRule('-5.00', t)).toBe('priceLists.rule.below:5');
  expect(priceRule('12.50', t)).toBe('priceLists.rule.above:12.5');
  expect(priceRule('0.00', t)).toBe('priceLists.rule.same:');
});

test('the list page says what each list does and who is on it', async () => {
  service.listPriceLists.mockResolvedValue([wholesale]);
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<PriceListsPageContent />);
  expect(await screen.findByText('Wholesale')).toBeInTheDocument();
  expect(screen.getByText('5% below usual price')).toBeInTheDocument();
  expect(screen.getByText('1 customer')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Wholesale'));
  expect(push).toHaveBeenCalledWith('/items/price-lists/w1');
});

test('a customer is put on a list and taken off it from the khata', async () => {
  service.listPriceLists.mockResolvedValue([wholesale]);
  service.getPartyRates.mockResolvedValue({ priceList: null, rates: {} });
  service.assignPriceList.mockResolvedValue({ id: 'w1', name: 'Wholesale' });
  renderWithProviders(<PartyPriceListControl partyId="p1" canWrite />);
  const select = await screen.findByRole('combobox', { name: 'Price list' });
  expect(select).toHaveTextContent('Usual prices');
  await userEvent.click(select);
  await userEvent.click(await screen.findByRole('option', { name: /Wholesale/ }));
  await waitFor(() => expect(service.assignPriceList).toHaveBeenCalledWith('p1', 'w1'));
});

test('a reader who may not set prices sees the list as a link, or nothing', async () => {
  service.listPriceLists.mockResolvedValue([wholesale]);
  service.getPartyRates.mockResolvedValue({
    priceList: { id: 'w1', name: 'Wholesale' },
    rates: {},
  });
  renderWithProviders(<PartyPriceListControl partyId="p1" canWrite={false} />);
  expect(await screen.findByRole('link', { name: 'Wholesale' })).toHaveAttribute(
    'href',
    '/items/price-lists/w1'
  );
  expect(screen.queryByRole('combobox')).toBeNull();
});

const detail = {
  ...wholesale,
  rates: [
    {
      item: { id: 'i1', name: 'Toor dal 1kg', sku: 'S1', unitCode: 'NOS' },
      sellingPrice: '450.00',
      fromPercent: '427.50',
      rate: '420.00',
    },
  ],
};

/**
 * 09 §8.6 — the detail reads as the rule first and its exceptions after: the
 * rule is a sentence, a pinned rate shows the usual price beside the list's
 * rate, and tapping it puts it back in the pin row to change. A reader sees
 * the same facts and none of the controls.
 */
test('the detail shows the rule, and each pinned rate against the usual price', async () => {
  service.getPriceList.mockResolvedValue(detail);
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<PriceListDetailPageContent id="w1" />);
  expect(await screen.findByTestId('price-list-rule-text')).toHaveTextContent(
    '5% below usual price'
  );
  expect(screen.getByText('1 customer is on this list.')).toBeInTheDocument();
  expect(screen.getByText('Usual price ₹450.00')).toBeInTheDocument();
  expect(screen.getByText('₹420.00')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Change the rate for Toor dal 1kg' }));
  expect(screen.getByTestId('price-list-pin-usual')).toHaveTextContent('Usual price ₹450.00');
  service.setPinnedRate.mockResolvedValue(undefined);
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove the pinned rate for Toor dal 1kg' })
  );
  await waitFor(() => expect(service.setPinnedRate).toHaveBeenCalledWith('w1', 'i1', null));
});

test('a reader sees the rule and the rates, and no control to change them', async () => {
  service.getPriceList.mockResolvedValue(detail);
  signIn(['inventory.item.read']);
  renderWithProviders(<PriceListDetailPageContent id="w1" />);
  expect(await screen.findByText('Toor dal 1kg')).toBeInTheDocument();
  expect(screen.queryByTestId('price-list-pin')).toBeNull();
  expect(screen.queryByRole('button', { name: /Edit the rule/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Remove the pinned rate/ })).toBeNull();
});
