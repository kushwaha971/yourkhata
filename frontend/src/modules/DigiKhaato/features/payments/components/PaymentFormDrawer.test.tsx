import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { hideSnackbar } from 'src/redux/slice/snackbarSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import * as service from '../api/paymentService';

import { PaymentFormDrawer } from './PaymentFormDrawer';

import type { OpenDocument, PaymentContext } from '../types/payment.types';

/**
 * T-PAY-01-9 — the allocation panel, auto and manual: FIFO previewed across
 * the open bills, "Max ₹898" on a row over its bill, the advance hint, and the
 * drawer's save posting exactly the rows the merchant typed.
 */
jest.mock('../api/paymentService', () => ({
  ...jest.requireActual('../api/paymentService'),
  listOpenDocuments: jest.fn(),
  recordPayment: jest.fn(),
}));
jest.mock('../../parties/api/partyService');

const bill = (id: string, number: string, due: string, date: string): OpenDocument => ({
  documentType: 'sales_document',
  documentId: id,
  number,
  documentDate: date,
  dueOn: null,
  grandTotal: due,
  amountDue: due,
  status: 'issued',
});

const BILLS = [
  bill('d40', 'INV/26-27/0040', '898.00', '2026-09-10'),
  bill('d42', 'INV/26-27/0042', '898.00', '2026-09-18'),
];

const context: PaymentContext = {
  direction: 'in',
  partyId: 'p1',
  partyName: 'Ramesh Traders',
  receivable: '1000.00',
  entry: 'party',
};

beforeEach(() => {
  jest.mocked(service.listOpenDocuments).mockResolvedValue(BILLS);
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
      permissions: ['payments.payment.read', 'payments.payment.write', 'parties.party.read'],
      enabledModules: ['payments', 'parties'],
      version: 1,
    })
  );
});

it('previews FIFO over the open bills and says what stays as advance', async () => {
  /** AC-2 / AC-5 — ₹1,000 against two ₹898 bills: the older is paid in full,
   *  the newer takes ₹102, and nothing is left over. */
  renderWithProviders(<PaymentFormDrawer context={context} onClose={jest.fn()} />);
  const picker = await screen.findByTestId('alloc-picker');
  expect(within(picker).getByText('INV/26-27/0040')).toBeInTheDocument();
  // The older bill takes its whole due; the newer only what is left.
  expect(within(picker).getAllByText('₹898.00').length).toBeGreaterThan(0);
  expect(within(picker).getAllByText('₹102.00').length).toBeGreaterThan(0);
  expect(within(picker).getByText('Allocated ₹1,000.00')).toBeInTheDocument();
  expect(screen.queryByTestId('alloc-advance')).not.toBeInTheDocument();
});

it('refuses a manual row over its bill with "Max ₹898.00" and saves nothing', async () => {
  /** AC-3 / Alternate B — the cap is the bill's due, on the row that is wrong. */
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={context} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByRole('switch', { name: /Auto — oldest first/ }));
  const row = screen.getByRole('textbox', { name: 'Amount against INV/26-27/0042' });
  await user.type(row, '950');
  await user.click(screen.getByTestId('payment-save'));
  // Every row carries "Max ₹898.00" as its hint (P-D1); on the wrong row it becomes the error.
  await waitFor(() =>
    expect(document.getElementById('allocations.1.amount-error')).toHaveTextContent('Max ₹898.00')
  );
  expect(service.recordPayment).not.toHaveBeenCalled();
});

it('posts only the typed rows and shows the advance before saving', async () => {
  /** AC-3 — ₹500 to INV/0042 only: the older bill untouched, ₹500 advance. */
  const user = userEvent.setup();
  jest.mocked(service.recordPayment).mockResolvedValue({
    payment: {
      id: 'pay1',
      number: 'RCT/26-27/0017',
      direction: 'in',
      amount: '1000.00',
      unallocatedAmount: '500.00',
    } as never,
    partyBalance: '398.00',
    documents: [],
  });
  renderWithProviders(<PaymentFormDrawer context={context} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByRole('switch', { name: /Auto — oldest first/ }));
  await user.type(screen.getByRole('textbox', { name: 'Amount against INV/26-27/0042' }), '500');
  expect(await screen.findByTestId('alloc-advance')).toHaveTextContent(
    '₹500.00 will be kept as advance'
  );
  await user.click(screen.getByTestId('payment-save'));
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(1));
  const [sent] = jest.mocked(service.recordPayment).mock.calls[0] ?? [];
  expect(sent?.autoAllocate).toBe(false);
  expect(sent?.allocations.filter((r) => r.amount).map((r) => r.documentId)).toEqual(['d42']);
  expect(await screen.findByTestId('payment-saved')).toHaveTextContent('RCT/26-27/0017');
});

it('opens from a purchase bill as "Pay supplier", money out, preset to that bill', async () => {
  /** PUR-02 AC-3 / FR-4 — the bill page's Pay: the supplier's OPEN BILLS are asked for
   *  with direction out (never customers' invoices), the drawer says "Pay supplier", and
   *  the bill it came from is pre-allocated its due while the older bill is left alone. */
  const user = userEvent.setup();
  const bills: OpenDocument[] = [
    { ...bill('b6', 'PB/26-27/0006', '500.00', '2026-09-01'), documentType: 'purchase_document' },
    { ...bill('b7', 'PB/26-27/0007', '1921.00', '2026-09-18'), documentType: 'purchase_document' },
  ];
  jest.mocked(service.listOpenDocuments).mockClear().mockResolvedValue(bills);
  jest
    .mocked(service.recordPayment)
    .mockClear()
    .mockResolvedValue({
      payment: {
        id: 'pay2',
        number: 'PAYOUT/26-27/0004',
        direction: 'out',
        amount: '1921.00',
        unallocatedAmount: '0.00',
      } as never,
      partyBalance: '-500.00',
      documents: [],
    });
  renderWithProviders(
    <PaymentFormDrawer
      context={{
        direction: 'out',
        partyId: 'p9',
        partyName: 'Agro Traders',
        documentId: 'b7',
        documentNumber: 'PB/26-27/0007',
        documentDue: '1921.00',
        entry: 'bill',
      }}
      onClose={jest.fn()}
    />
  );
  expect(await screen.findByText('Pay supplier · Agro Traders')).toBeInTheDocument();
  await screen.findByTestId('alloc-picker');
  // DEC-019 — the fourth argument is the app's bucket; a bill's own drawer leaves it to the server.
  expect(service.listOpenDocuments).toHaveBeenCalledWith('p9', 'out', expect.anything(), undefined);
  await user.click(screen.getByTestId('payment-save'));
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(1));
  const [sent, , entry] = jest.mocked(service.recordPayment).mock.calls[0] ?? [];
  expect(sent?.direction).toBe('out');
  expect(entry).toBe('bill');
  expect(sent?.autoAllocate).toBe(false);
  expect(sent?.allocations.filter((r) => r.amount).map((r) => [r.documentId, r.amount])).toEqual([
    ['b7', '1921.00'],
  ]);
  expect(await screen.findByTestId('payment-saved')).toHaveTextContent('Paid ₹1,921.00');
});

const shop: PaymentContext = { ...context, bucket: 'shop' };

const fromInvoice: PaymentContext = {
  direction: 'in',
  partyId: 'p1',
  partyName: 'Ramesh Traders',
  documentId: 'd42',
  documentNumber: 'INV/26-27/0042',
  documentDue: '898.00',
  entry: 'invoice',
};

const savedAs = (amount: string) => ({
  payment: {
    id: 'pay3',
    number: 'RCT/26-27/0018',
    direction: 'in' as const,
    amount,
    unallocatedAmount: '0.00',
  } as never,
  partyBalance: '0.00',
  documents: [],
});

it('P-D2: a part payment from an invoice allocates what is paid, not the full due', async () => {
  /** QA P-D2 — Record payment on a ₹898 invoice, amount changed to ₹500: the
   *  invoice's row used to stay at ₹898, the footer said "Allocations exceed the
   *  payment" and Save did nothing. The preset row now follows min(amount, due). */
  const user = userEvent.setup();
  jest.mocked(service.recordPayment).mockClear().mockResolvedValue(savedAs('500.00'));
  renderWithProviders(<PaymentFormDrawer context={fromInvoice} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  const amount = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(amount);
  await user.type(amount, '500');
  expect(screen.queryByText('Allocations exceed the payment')).not.toBeInTheDocument();
  await user.click(screen.getByTestId('payment-save'));
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(1));
  const [sent] = jest.mocked(service.recordPayment).mock.calls[0] ?? [];
  expect(sent?.allocations.filter((r) => r.amount).map((r) => [r.documentId, r.amount])).toEqual([
    ['d42', '500.00'],
  ]);
});

it('P-D2: once the merchant sets a row by hand, the amount no longer moves it', async () => {
  /** QA P-D2 — "unless the user edited the allocation manually": a typed row is theirs. */
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={fromInvoice} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  const row = screen.getByRole('textbox', { name: 'Amount against INV/26-27/0042' });
  await user.clear(row);
  await user.type(row, '300');
  const amount = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(amount);
  await user.type(amount, '400');
  expect(row).toHaveValue('300.00');
});

it('P-D1: manual rows show "Max ₹…" and a Fill that puts the rest on that bill', async () => {
  /** QA P-D1 — with Auto off every row read ₹0.00 and nothing said what it could
   *  take: `payments.alloc.max` existed and was never rendered. */
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={context} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByRole('switch', { name: /Auto — oldest first/ }));
  expect(screen.getAllByText('Max ₹898.00')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Fill ₹898.00 against INV/26-27/0040' }));
  expect(screen.getByRole('textbox', { name: 'Amount against INV/26-27/0040' })).toHaveValue(
    '898.00'
  );
  // ₹1,000 − ₹898 leaves ₹102 for the newer bill.
  await user.click(screen.getByRole('button', { name: 'Fill ₹102.00 against INV/26-27/0042' }));
  expect(screen.getByRole('textbox', { name: 'Amount against INV/26-27/0042' })).toHaveValue(
    '102.00'
  );
  expect(screen.queryByRole('button', { name: /^Fill ₹/ })).not.toBeInTheDocument();
});

it('P-D6: "Fill remaining" on a split works to the amount set, not the receivable', async () => {
  /** QA P-D6 — ₹700 typed against a ₹1,000 receivable, then "Add mode" and ₹500
   *  on PhonePe: line 1's "Fill remaining" offered ₹500 (the receivable less ₹500)
   *  instead of ₹200 (the ₹700 being split, less ₹500). */
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={context} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  const first = document.querySelector<HTMLInputElement>('input[name="lines.0.amount"]');
  if (!first) throw new Error('no first line');
  await user.clear(first);
  await user.type(first, '700');
  await user.click(screen.getByRole('button', { name: 'Add mode' }));
  const second = document.querySelector<HTMLInputElement>('input[name="lines.1.amount"]');
  if (!second) throw new Error('no second line');
  expect(second).toHaveValue('');
  await user.type(second, '500');
  await user.click(screen.getByRole('button', { name: 'Fill remaining ₹200.00' }));
  expect(first).toHaveValue('200.00');
});

it('B37 asks before allocating an earlier payment and saves only after confirmation', async () => {
  // A date mismatch must never silently mark a later bill paid.
  const user = userEvent.setup();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  jest
    .mocked(service.listOpenDocuments)
    .mockResolvedValue([bill('d1', 'INV/early', '100.00', today)]);
  jest
    .mocked(service.recordPayment)
    .mockClear()
    .mockResolvedValue({
      payment: {
        id: 'early',
        number: 'RCT/early',
        direction: 'in',
        amount: '10.00',
        unallocatedAmount: '0.00',
      } as never,
      partyBalance: '90.00',
      documents: [],
    });
  renderWithProviders(
    <PaymentFormDrawer
      context={{ ...context, documentId: 'd1', documentDue: '100.00' }}
      onClose={jest.fn()}
    />
  );
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByRole('button', { name: 'Yesterday' }));
  await user.click(screen.getByTestId('payment-save'));
  const confirmation = await screen.findByRole('dialog', { name: 'Payment dated before the bill' });
  expect(service.recordPayment).not.toHaveBeenCalled();
  await user.click(within(confirmation).getByRole('button', { name: 'Keep editing' }));
  expect(service.recordPayment).not.toHaveBeenCalled();
  await user.click(screen.getByTestId('payment-save'));
  await user.click(
    within(await screen.findByRole('dialog', { name: 'Payment dated before the bill' })).getByRole(
      'button',
      { name: 'Allocate this payment' }
    )
  );
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(1));
  expect(jest.mocked(service.recordPayment).mock.calls[0]?.[0]).toMatchObject({
    confirmEarlyAllocation: true,
  });
});

it('keeps the Shop amount before the method and secondary fields behind More details', async () => {
  /** R-DEC-14: the old drawer led with a wall of method chips and exposed date/note on every payment. */
  const user = userEvent.setup();
  renderWithProviders(
    <PaymentFormDrawer context={{ ...context, bucket: 'shop' }} onClose={jest.fn()} />
  );
  const dialog = screen.getByRole('dialog');
  const amount = within(dialog).getByRole('textbox', { name: 'Amount' });
  const mode = within(dialog).getByRole('combobox', { name: 'Paid by' });
  expect(amount.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(dialog).queryByLabelText('Date')).not.toBeInTheDocument();
  expect(within(dialog).getByText('Still due after this')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: /More details/ }));
  expect(within(dialog).getByText('Date')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Receive ₹1,000.00' })).toBeInTheDocument();
});

it('asks before discarding a changed Shop payment instead of losing the amount on Escape', async () => {
  /** Counter drawer defect: closing the old form silently discarded a payment being entered. */
  const user = userEvent.setup(),
    onClose = jest.fn();
  renderWithProviders(
    <PaymentFormDrawer context={{ ...context, bucket: 'shop' }} onClose={onClose} />
  );
  const input = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(input);
  await user.type(input, '200');
  await user.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();
  const confirm = screen.getByRole('dialog', { name: 'Leave without saving?' });
  await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }));
  expect(input).toHaveValue('200.00');
  await user.click(input);
  await user.keyboard('{Escape}');
  await user.click(
    within(screen.getByRole('dialog', { name: 'Leave without saving?' })).getByRole('button', {
      name: 'Discard changes',
    })
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not record a Shop payment against a bill before that bill is available', async () => {
  /** Counter defect: an empty loading/error result must not silently classify a
   *  collection as an advance. A payment for ONE bill waits for that bill. */
  jest.mocked(service.listOpenDocuments).mockReturnValue(new Promise(() => undefined));
  renderWithProviders(
    <PaymentFormDrawer context={{ ...fromInvoice, bucket: 'shop' }} onClose={jest.fn()} />
  );
  expect(screen.getByTestId('payment-save')).toBeDisabled();
});

/** 08 §6 Loading — with Auto on, the server settles oldest first under its lock,
 *  so a slow bill list does not hold up the counter. */
it('lets the counter receive with Auto on while the bills are still loading', () => {
  jest.mocked(service.listOpenDocuments).mockReturnValue(new Promise(() => undefined));
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  expect(screen.getByTestId('payment-save')).toBeEnabled();
});

it('uses Shop search for a default payment context without an explicit bucket', async () => {
  /** The payment API defaults to Shop; its empty party picker must not default to Udhaar. */
  const parties = jest.requireMock('../../parties/api/partyService') as { listParties: jest.Mock };
  parties.listParties.mockResolvedValue({
    rows: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    totals: null,
  });
  renderWithProviders(
    <PaymentFormDrawer context={{ direction: 'in', entry: 'list' }} onClose={jest.fn()} />
  );
  await userEvent.click(screen.getByRole('combobox', { name: /from/i }));
  await waitFor(() =>
    expect(parties.listParties).toHaveBeenLastCalledWith(
      expect.objectContaining({ book: 'shop' }),
      expect.any(AbortSignal)
    )
  );
});

it('loading the selected bill allocation does not count as a merchant edit', async () => {
  // Defect: an untouched invoice payment prompted Discard after its server rows arrived.
  const close = jest.fn();
  renderWithProviders(
    <PaymentFormDrawer
      context={{ ...fromInvoice, bucket: 'shop', tradeRole: 'customer' }}
      onClose={close}
    />
  );
  await screen.findByText('INV/26-27/0040');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument();
  expect(close).toHaveBeenCalledTimes(1);
});

// ── 08 §6 — the Shop's counter drawer ──────────────────────────────────────

const apiError = (code: string) => ({
  code,
  message: '',
  details: {},
  requestId: null,
  status: null,
  warnings: [],
});

it('says who owes what, how many bills are unpaid, and what the amount leaves due', async () => {
  /** 08 §6 Ready — the header and the amount's line were bare: "Receive payment ·
   *  Ramesh Traders" and nothing under the amount until the footer. */
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  expect(screen.getByText('Ramesh Traders · owes ₹1,000.00')).toBeInTheDocument();
  expect(await screen.findByText('2 unpaid bills')).toBeInTheDocument();
  expect(screen.getByTestId('payment-hint')).toHaveTextContent('This clears everything due.');
  const amount = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(amount);
  await user.type(amount, '600');
  expect(screen.getByTestId('payment-hint')).toHaveTextContent(
    '₹400.00 will still be due after this.'
  );
  expect(screen.getByTestId('payment-left')).toHaveTextContent('₹400.00');
});

it("shows each bill's share and the advance as a row before saving", async () => {
  /** 08 §6 More than due — ₹600 against ₹445: the bill "clears it", ₹155 is an
   *  advance row in the Shop book, and the amount's line says it is not a refund. */
  const user = userEvent.setup();
  jest
    .mocked(service.listOpenDocuments)
    .mockResolvedValue([bill('d1', 'INV-0412', '445.00', '2026-10-08')]);
  renderWithProviders(
    <PaymentFormDrawer context={{ ...shop, receivable: '445.00' }} onClose={jest.fn()} />
  );
  await screen.findByTestId('alloc-picker');
  const amount = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(amount);
  await user.type(amount, '600');
  expect(screen.getByText('clears it')).toBeInTheDocument();
  const advance = screen.getByTestId('alloc-advance-row');
  expect(advance).toHaveTextContent('Advance');
  expect(advance).toHaveTextContent('₹155.00');
  expect(advance).toHaveTextContent('Shop book');
  expect(screen.getByTestId('payment-hint')).toHaveTextContent(
    '₹155.00 more than what is due. It stays with Ramesh Traders as advance, not a refund.'
  );
  expect(screen.getByTestId('payment-left')).toHaveTextContent('₹0.00');
});

it('says a failure in the drawer and tries again with the same key', async () => {
  /** 08 §0.2 Failed — the drawer stayed as it was with only a toast; "Try again"
   *  must resend the SAME idempotency key so a request that landed is not doubled. */
  const user = userEvent.setup();
  jest
    .mocked(service.recordPayment)
    .mockReset()
    .mockRejectedValueOnce(apiError('timeout'))
    .mockResolvedValueOnce(savedAs('1000.00'));
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByTestId('payment-save'));
  expect(await screen.findByRole('alert')).toHaveTextContent('No answer yet.');
  const retry = screen.getByTestId('payment-save');
  expect(retry).toHaveTextContent('Try again');
  await user.click(retry);
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(2));
  const calls = jest.mocked(service.recordPayment).mock.calls;
  expect(calls[1]?.[1]).toBe(calls[0]?.[1]);
  // The counter drawer says it; the global toast does not repeat it.
  expect(calls[0]?.[4]).toBe(true);
});

it('says plainly that nothing was saved when the server refuses', async () => {
  const user = userEvent.setup();
  jest.mocked(service.recordPayment).mockReset().mockRejectedValueOnce(apiError('server_error'));
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByTestId('payment-save'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Didn't go through. Nothing was saved."
  );
});

it('stops a save when the dues changed on another device, and offers the new figures', async () => {
  /** 08 §6 Changed elsewhere (P-08-04) — ₹898 was received on the other phone
   *  meanwhile. The drawer re-reads just before Save, says so, and records
   *  nothing until the merchant takes the new figure. */
  const user = userEvent.setup();
  jest.mocked(service.recordPayment).mockReset().mockResolvedValue(savedAs('102.00'));
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  jest.mocked(service.listOpenDocuments).mockResolvedValue([BILLS[1] as OpenDocument]);
  await user.click(screen.getByTestId('payment-save'));
  expect(
    await screen.findByText('Dues for Ramesh Traders changed on another device.')
  ).toBeInTheDocument();
  expect(screen.getByText(/Now due ₹102.00, not ₹1,000.00/)).toBeInTheDocument();
  expect(service.recordPayment).not.toHaveBeenCalled();
  expect(screen.getByTestId('payment-save')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Use the new figures' }));
  expect(await screen.findByText('Ramesh Traders · now owes ₹102.00')).toBeInTheDocument();
  // The amount was the old figure in full, so it follows.
  expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('102.00');
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByTestId('payment-save'));
  await waitFor(() => expect(service.recordPayment).toHaveBeenCalledTimes(1));
});

it('ends on one saved message with Share receipt first, and no toast repeating it', async () => {
  /** 08 §6 Success — the panel and a snackbar said the same thing, and the next
   *  act at a counter (send the receipt) was two screens away. */
  const user = userEvent.setup();
  jest.mocked(service.recordPayment).mockReset().mockResolvedValue(savedAs('1000.00'));
  store.dispatch(hideSnackbar());
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  await user.click(screen.getByTestId('payment-save'));
  const saved = await screen.findByTestId('payment-saved');
  expect(saved).toHaveTextContent('Received ₹1,000.00 from Ramesh Traders.');
  expect(saved).toHaveTextContent('Nothing due now · RCT/26-27/0018');
  expect(screen.getByRole('button', { name: 'Share receipt' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Print' })).toHaveAttribute(
    'href',
    '/payments/pay3?print=1'
  );
  expect(store.getState().snackbar.snackbarOpen).toBe(false);
});

it('lets the counter save with Auto when the bills could not be read, and says how', async () => {
  /** 08 §6 Error / partial — a failed read blocked every save; with Auto the
   *  server decides, so the counter goes on, told what will happen. */
  jest.mocked(service.listOpenDocuments).mockRejectedValue(apiError('server_error'));
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  expect(await screen.findByText("Couldn't load bills")).toBeInTheDocument();
  expect(screen.getByTestId('payment-save')).toBeEnabled();
  expect(screen.getByText('Bills will be matched oldest first when saved.')).toBeInTheDocument();
});

it('names an over-allocation with its figures and holds Save until it is fixed', async () => {
  const user = userEvent.setup();
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  await screen.findByTestId('alloc-picker');
  const amount = screen.getByRole('textbox', { name: 'Amount' });
  await user.clear(amount);
  await user.type(amount, '500');
  await user.click(screen.getByRole('switch', { name: /Auto, oldest first/ }));
  await user.type(screen.getByRole('textbox', { name: 'Amount against INV/26-27/0040' }), '700');
  expect(screen.getByTestId('alloc-over')).toHaveTextContent(
    "You've put ₹700.00 on bills but are receiving only ₹500.00."
  );
  expect(screen.getByTestId('payment-save')).toBeDisabled();
});

it('says a customer with nothing due keeps the money as advance, in Shop words', async () => {
  jest.mocked(service.listOpenDocuments).mockResolvedValue([]);
  renderWithProviders(
    <PaymentFormDrawer context={{ ...shop, receivable: '0.00' }} onClose={jest.fn()} />
  );
  const amount = await screen.findByRole('textbox', { name: 'Amount' });
  await userEvent.setup().type(amount, '1000');
  expect(await screen.findByTestId('alloc-none')).toHaveTextContent(
    'No unpaid bills. The full ₹1,000.00 is kept as advance for the next bill.'
  );
  expect(screen.queryByText(/khata/)).not.toBeInTheDocument();
});

it('says money with no bill to pay goes against the old balance, not the next bill', async () => {
  /**
   * A6. A Shop customer with an old balance from before the app and no unpaid
   * bill still has money due. "Kept as advance for the next bill" told the
   * merchant the ₹1,000 was waiting for a future bill while the customer still
   * had ₹1,000 to pay; the balance was right and the sentence was not.
   */
  jest.mocked(service.listOpenDocuments).mockResolvedValue([]);
  renderWithProviders(<PaymentFormDrawer context={shop} onClose={jest.fn()} />);
  expect(await screen.findByTestId('alloc-none')).toHaveTextContent(
    'No unpaid bills. The ₹1,000.00 goes against their old balance.'
  );
});
