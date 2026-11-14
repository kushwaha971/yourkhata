import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { ExpenseFormDrawer } from './ExpenseFormDrawer';

import type { UseExpenseFormResult } from '../hooks/useExpenseForm';

/**
 * EXP-01 FR-2 / FR-4 / FR-6 — the drawer's two shapes.
 *
 * Paid (the default) asks how it was paid; "I still owe this" asks who to and
 * by when, and hides "Paid by", because money that has not moved has no "how".
 * The cross-field rule must land its message on the control the merchant can
 * see — a refusal attached to a hidden field is a form that will not submit
 * and cannot say why.
 */
jest.mock('../../parties/api/partyService');

const form = (overrides: Partial<UseExpenseFormResult> = {}): UseExpenseFormResult => ({
  open: true,
  isSaving: false,
  canWrite: true,
  canVoid: true,
  canOwe: true,
  draft: null,
  formErrors: [],
  categories: [
    {
      id: 'c-rent',
      name: 'Rent',
      systemCode: 'rent',
      color: 'viz-1',
      isSystem: true,
      status: 'active',
    },
    {
      id: 'c-old',
      name: 'Old',
      systemCode: null,
      color: 'viz-2',
      isSystem: false,
      status: 'archived',
    },
  ],
  categoriesStatus: 'succeeded',
  creatingCategory: false,
  detail: null,
  voiding: null,
  isVoiding: false,
  voidErrors: [],
  openDrawer: jest.fn(),
  openPrefilled: jest.fn(),
  close: jest.fn(),
  discardDraft: jest.fn(),
  submit: jest.fn().mockResolvedValue(true),
  addCategory: jest.fn(),
  openDetail: jest.fn(),
  openDetailById: jest.fn(),
  closeDetail: jest.fn(),
  openVoid: jest.fn(),
  closeVoid: jest.fn(),
  submitVoid: jest.fn(),
  ...overrides,
});

beforeEach(() => {
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
      permissions: ['expenses.expense.read', 'expenses.expense.write', 'parties.party.read'],
      enabledModules: ['expenses', 'parties'],
      version: 1,
    })
  );
});

it('opens clean, paid, with the payment chips', () => {
  // LED-01's sweep: a drawer that opened red before a touch. Not again.
  renderWithProviders(<ExpenseFormDrawer form={form()} />);
  expect(screen.queryByText('Enter an amount.')).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: /Paid now/ })).toBeChecked();
  expect(screen.getByRole('radiogroup', { name: 'Paid by' })).toBeInTheDocument();
  expect(screen.queryByText('Pay by')).not.toBeInTheDocument();
});

it('asks who is owed and by when once Paid now is off, and hides Paid by', async () => {
  const submit = jest.fn().mockResolvedValue(true);
  renderWithProviders(<ExpenseFormDrawer form={form({ submit })} />);
  await userEvent.click(screen.getByRole('switch', { name: /Paid now/ }));
  expect(screen.queryByRole('radiogroup', { name: 'Paid by' })).not.toBeInTheDocument();
  expect(screen.getByText('To pay')).toBeInTheDocument();
  expect(screen.getByText('Pay by')).toBeInTheDocument();
  // 08 §12.1, DEC-019 — the Shop's balance, never the Udhaar book's "khata".
  expect(screen.getByText('This is added to what the Business has to pay them.')).toBeInTheDocument();
  expect(screen.queryByText(/khata/i)).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/Amount/), '12000');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  // The refusal is under the field the merchant can see, not a hidden one.
  expect(await screen.findByText('Choose who you have to pay')).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});

it('offers only live categories, one tap each', async () => {
  // EXP-02 FR-6 — an archived category is gone from pickers, kept on old rows.
  // 08 §12.1 — the category is ONE tap: a chip, not a list to open.
  renderWithProviders(<ExpenseFormDrawer form={form()} />);
  const chips = screen.getByRole('radiogroup', { name: 'Common categories' });
  expect(within(chips).queryByRole('radio', { name: 'Old' })).not.toBeInTheDocument();
  await userEvent.click(within(chips).getByRole('radio', { name: 'Rent' }));
  expect(within(chips).getByRole('radio', { name: 'Rent' })).toBeChecked();
  // Two live categories need no search box.
  expect(screen.queryByRole('combobox', { name: 'More categories' })).not.toBeInTheDocument();
});

it('keeps the six most used as chips and the rest in a search, showing the one picked', async () => {
  const many = ['Tea', 'Rent', 'Salary', 'Transport', 'Electricity', 'Porter', 'Repairs'].map(
    (name, i) => ({
      id: `c-${i}`,
      name,
      systemCode: null,
      color: 'viz-1',
      isSystem: false,
      status: 'active' as const,
    })
  );
  renderWithProviders(<ExpenseFormDrawer form={form({ categories: many })} />);
  const chips = screen.getByRole('radiogroup', { name: 'Common categories' });
  expect(within(chips).getAllByRole('radio')).toHaveLength(6);
  expect(within(chips).queryByRole('radio', { name: 'Repairs' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', { name: 'More categories' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Repairs' }));
  expect(within(chips).getByRole('radio', { name: 'Repairs' })).toBeChecked();
});

it('says nothing is wrong with the amount until Save is pressed', async () => {
  /* 08 §12.1 — "Amount missing only after Save". With `onTouched`, moving on
     from the empty amount to the category painted it red. */
  renderWithProviders(<ExpenseFormDrawer form={form()} />);
  await userEvent.click(screen.getByLabelText(/Amount/));
  await userEvent.tab();
  expect(screen.queryByText('Enter an amount.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter an amount.')).toBeInTheDocument();
});

it('saves once for a double tap on Save and add another', async () => {
  let answer: (ok: boolean) => void = () => undefined;
  const submit = jest.fn(
    () =>
      new Promise<boolean>((resolve) => {
        answer = resolve;
      })
  );
  renderWithProviders(<ExpenseFormDrawer form={form({ submit })} />);
  await userEvent.type(screen.getByLabelText(/Amount/), '500');
  await userEvent.click(screen.getByRole('radio', { name: 'Rent' }));
  const again = screen.getByRole('button', { name: 'Save and add another' });
  await userEvent.dblClick(again);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  answer(true);
  await waitFor(() => expect(screen.getByLabelText(/Amount/)).toHaveValue(''));
  expect(submit).toHaveBeenCalledTimes(1);
  // …and the caret is back in Amount for the next one.
  await waitFor(() => expect(screen.getByLabelText(/Amount/)).toHaveFocus());
});

it('does not offer a New category to a role that cannot record', () => {
  renderWithProviders(<ExpenseFormDrawer form={form({ canWrite: false })} />);
  expect(screen.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument();
  expect(screen.getByText('You can view expenses but not record them')).toBeInTheDocument();
});

it('offers no "I still owe this" in an app that records only paid expenses', () => {
  // DEC-019 (QA B10) — an unpaid expense is owed to a supplier in the Shop's book,
  // so the Library and Lending record an expense when it is paid. A switch the
  // server would refuse is a form that cannot say why it will not save.
  renderWithProviders(<ExpenseFormDrawer form={form({ canOwe: false })} />);
  expect(screen.queryByRole('switch', { name: /Paid now/ })).not.toBeInTheDocument();
  expect(screen.getByRole('radiogroup', { name: 'Paid by' })).toBeInTheDocument();
});
