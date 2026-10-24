import { screen } from '@testing-library/react';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { VoidExpenseDialog } from './VoidExpenseDialog';

import type { UseExpenseFormResult } from '../hooks/useExpenseForm';
import type { Expense } from '../types/expense.types';

/**
 * 08 §12.2 — the cancel dialog says what will change BEFORE it happens, in the
 * Shop's words. Before the revamp it said "Void", and an unpaid expense
 * promised to come off "the khata of" the supplier, which is the Udhaar
 * book's word for a balance this expense never touched (DEC-019).
 */
const RENT: Expense = {
  id: 'e1',
  number: 'EXP/26-27/0031',
  expenseDate: '2026-10-17',
  amount: '12000.00',
  category: { id: 'c-rent', name: 'Rent', color: 'viz-1', status: 'active' },
  party: { id: 'p1', name: 'Gupta Oil Mills' },
  mode: 'cash',
  upiApp: null,
  reference: '',
  note: '',
  paid: true,
  dueOn: null,
  status: 'recorded',
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdBy: null,
  createdAt: '2026-10-17T05:00:00Z',
};

const form = (voiding: Expense, canOwe = true): UseExpenseFormResult =>
  ({
    voiding,
    isVoiding: false,
    voidErrors: [],
    canOwe,
    closeVoid: jest.fn(),
    submitVoid: jest.fn(),
  }) as unknown as UseExpenseFormResult;

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
      permissions: ['expenses.expense.read', 'expenses.expense.void'],
      enabledModules: ['expenses'],
      version: 1,
    })
  );
});

it('asks to cancel, says a paid Shop expense leaves the cash book, and offers Keep', () => {
  renderWithProviders(<VoidExpenseDialog form={form(RENT)} />);
  expect(screen.getByRole('heading', { name: 'Cancel EXP/26-27/0031?' })).toBeInTheDocument();
  expect(screen.getByText(/It leaves the cash book for 17\/10\/2026/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Entered twice' })).toBeInTheDocument();
  expect(screen.queryByText(/void/i)).not.toBeInTheDocument();
});

it('says an unpaid one comes off what the Shop owes the supplier, never a khata', () => {
  renderWithProviders(<VoidExpenseDialog form={form({ ...RENT, paid: false, mode: null })} />);
  expect(
    screen.getByText(/₹12,000.00 comes off what the Shop owes Gupta Oil Mills/)
  ).toBeInTheDocument();
  expect(screen.queryByText(/khata|cash book/i)).not.toBeInTheDocument();
});

it('names no cash book for an app that keeps none', () => {
  renderWithProviders(<VoidExpenseDialog form={form(RENT, false)} />);
  expect(screen.getByText(/It comes off your expenses for 17\/10\/2026/)).toBeInTheDocument();
  expect(screen.queryByText(/cash book/i)).not.toBeInTheDocument();
});
