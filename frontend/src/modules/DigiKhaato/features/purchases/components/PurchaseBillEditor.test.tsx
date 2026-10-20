import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserWentOffline, responseObserved } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { ModuleCode, PermissionCode } from 'src/types/domain.types';

import {
  usePurchaseBillEditor,
  type UsePurchaseBillEditorResult,
} from '../hooks/usePurchaseBillEditor';

import { PurchaseBillEditorPageContent } from './PurchaseBillEditorPageContent';

import type { PurchaseBill, PurchaseBillEnvelope } from '../types/purchase.types';

/**
 * PUR-01 on screen. The shop's context (GST type, rates by date) comes from
 * two other features' services, stubbed at the module boundary. What these
 * protect: the preview a merchant watches is the §17.7.0 figure; Record saves
 * the draft and then records it with the version it read and an
 * Idempotency-Key (BR-13); a duplicate supplier invoice 409 puts the
 * "Already recorded as …" line with its link under the number (FR-7); and a
 * composition shop is never offered ITC (FR-11).
 */
jest.mock('../api/purchaseBillService');
const mockProfile = { gstType: 'regular', stateCode: '27', businessType: 'retail' };
jest.mock('../../business-profile/api/businessProfileService', () => ({
  fetchTenant: jest.fn(async () => mockProfile),
}));
jest.mock('../../inventory/api/mastersService', () => ({
  listTaxRates: jest.fn(async () => [
    {
      code: 'GST5',
      name: 'GST 5%',
      rate: '5.000',
      cessRate: '0.000',
      effectiveTo: null,
      isCurrent: true,
    },
  ]),
}));
const mockPush = jest.fn();
const mockDriver = {
  id: 'driver',
  name: 'Radhe Krishna Enterprises LED driver',
  sku: 'DRIVER-12',
  barcode: '8900000000012',
  itemType: 'goods',
  category: null,
  unit: { id: 'u-nos', code: 'NOS', allowDecimal: false },
  sellingPrice: '55.00',
  purchasePrice: '42.00',
  taxCode: 'GST5',
  hsnSac: '8504',
  taxInclusiveSelling: false,
  trackStock: false,
  onHand: null,
  avgCost: null,
  reorderPoint: null,
  stockStatus: null,
  stockValue: null,
  status: 'active',
  matchField: 'name',
  updatedAt: '2026-10-20T10:00:00Z',
};
const mockRice = {
  ...mockDriver,
  id: 'rice',
  name: 'Rice',
  barcode: '8900000000001',
  purchasePrice: '46.00',
};
jest.mock('../../inventory/api/itemService', () => ({
  ...jest.requireActual('../../inventory/api/itemService'),
  searchItems: jest.fn(
    async (query: string, _page: number, _signal: unknown, options?: { status?: string }) => ({
      rows:
        options?.status === 'archived'
          ? []
          : [mockDriver, mockRice].filter((row) =>
              row.name.toLowerCase().includes(query.toLowerCase())
            ),
      hasMore: false,
    })
  ),
  lookupItemByBarcode: jest.fn(async (code: string) =>
    code === mockRice.barcode ? mockRice : null
  ),
}));
jest.mock('../../inventory/api/itemTradeService', () => ({
  getLastRate: jest.fn(async () => null),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/purchases/bills/b1/edit',
}));

const service = jest.requireMock('../api/purchaseBillService') as {
  createPurchaseBill: jest.Mock;
  getPurchaseBill: jest.Mock;
  updatePurchaseBill: jest.Mock;
  recordPurchaseBill: jest.Mock;
};

const line = (over: Partial<PurchaseBill['lines'][number]>): PurchaseBill['lines'][number] => ({
  id: 'l1',
  lineNo: 1,
  itemId: 'rice',
  description: 'Rice',
  hsnSac: null,
  qty: '20.000',
  unitCode: 'NOS',
  unitCost: '46.0000',
  discountType: null,
  discountValue: null,
  discountAmount: '0.00',
  taxableValue: '920.00',
  taxCode: 'GST5',
  taxRate: '5.000',
  cgst: '23.00',
  sgst: '23.00',
  igst: '0.00',
  cess: '0.00',
  lineTotal: '966.00',
  inboundUnitCost: null,
  trackStock: true,
  ...over,
});

const DRAFT: PurchaseBill = {
  id: 'b1',
  kind: 'purchase_bill',
  number: null,
  fyLabel: '2026-27',
  status: 'draft',
  version: 3,
  party: {
    id: 'p1',
    name: 'Agro Traders',
    gstin: null,
    mobile: null,
    stateCode: '27',
    creditDays: 15,
  },
  partySnapshot: null,
  supplierInvoiceNumber: 'AT/778',
  supplierInvoiceDate: null,
  documentDate: '2026-09-18',
  dueOn: null,
  isInterState: false,
  reverseCharge: false,
  itcEligible: true,
  discountType: null,
  discountValue: null,
  roundOffEnabled: true,
  subtotal: '2782.00',
  discountAmount: '0.00',
  taxableTotal: '2782.00',
  cgstTotal: '69.55',
  sgstTotal: '69.55',
  igstTotal: '0.00',
  cessTotal: '0.00',
  roundOff: '-0.10',
  grandTotal: '2921.00',
  amountPaid: '0.00',
  amountDue: '2921.00',
  lines: [
    line({}),
    line({
      id: 'l2',
      lineNo: 2,
      itemId: 'sugar',
      description: 'Sugar',
      qty: '50.000',
      unitCode: 'KGS',
      unitCost: '38.0000',
      discountType: 'percent',
      discountValue: '2.00',
    }),
  ],
  notes: '',
  ledgerEntryId: null,
  payments: [],
  createdBy: null,
  recordedAt: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  links: {
    bill: null,
    order: null,
    cancelReason: null,
    against: null,
    reason: null,
    restock: false,
    applied: '0.00',
    supplierInvoiceNumber: null,
    debitNotes: [],
    debitApplied: '0.00',
    returned: {},
  },
  updatedAt: '2026-09-18T10:00:00Z',
};

const envelope = (
  bill: PurchaseBill,
  partyBalance: string | null = null,
  draftRecovered = false
): PurchaseBillEnvelope => ({
  draftRecovered,
  bill,
  warnings: [],
  partyBalance,
  payment: null,
  releasedPayments: [],
});

const signIn = (
  permissions: readonly PermissionCode[],
  modules: readonly ModuleCode[] = ['purchases', 'parties', 'inventory']
): void => {
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
      activeTenant: { id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: [...modules],
      version: 1,
    })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.gstType = 'regular';
  store.dispatch(resetAllFeatureState());
  service.getPurchaseBill.mockResolvedValue(envelope(DRAFT));
  service.updatePurchaseBill.mockResolvedValue(envelope({ ...DRAFT, version: 4 }));
  signIn([
    'purchases.bill.read',
    'purchases.bill.write',
    'parties.party.read',
    'inventory.item.read',
  ]);
});

it('previews the §17.7.0 bill at ₹2,921.00 from the draft it opened', async () => {
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  expect(await screen.findByTestId('purchase-grand-total')).toHaveTextContent('₹2,921.00');
  expect(screen.getByTestId('purchase-supplier')).toHaveTextContent('Agro Traders');
  expect(screen.getByText('Input tax credit')).toBeInTheDocument();
});

it('saves, then records with the version read and an Idempotency-Key, then opens the bill', async () => {
  service.recordPurchaseBill.mockResolvedValue(
    envelope(
      {
        ...DRAFT,
        number: 'PB/26-27/0001',
        status: 'recorded',
        version: 5,
        partySnapshot: { name: 'Agro Traders', gstin: null, stateCode: '27', mobile: null },
      },
      '-2921.00'
    )
  );
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalled());
  const [id, body, key] = service.recordPurchaseBill.mock.calls[0] as [
    string,
    { version: number },
    string,
  ];
  expect(id).toBe('b1');
  expect(body).toEqual({ version: 4 });
  expect(key).toMatch(/.{8,}/);
  expect(service.updatePurchaseBill.mock.calls[0]?.[1]).toMatchObject({
    version: 3,
    supplier_invoice_number: 'AT/778',
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/purchases/bills/b1'));
});

it('puts the duplicate supplier invoice under the number, with a link to the bill (FR-7)', async () => {
  service.recordPurchaseBill.mockRejectedValue({
    code: 'duplicate_supplier_invoice',
    message: 'Already recorded as PB/26-27/0003 on 12/08/2026.',
    details: { existing: { id: 'b0', number: 'PB/26-27/0003', document_date: '2026-08-12' } },
    requestId: null,
    status: 409,
  });
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  const warning = await screen.findByTestId('duplicate-warning');
  expect(warning).toHaveTextContent('Already recorded as PB/26-27/0003 on 12/08/2026.');
  expect(screen.getByRole('link', { name: 'Open it' })).toHaveAttribute(
    'href',
    '/purchases/bills/b0'
  );
  expect(mockPush).not.toHaveBeenCalled();
});

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Answers media queries as a screen of `width` px would. */
const atWidth = (width: number): (() => void) => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*([\d.]+)/.exec(query)?.[1];
    const max = /max-width:\s*([\d.]+)/.exec(query)?.[1];
    return {
      ...original(query),
      matches: min ? width >= Number(min) : max ? width <= Number(max) : false,
    };
  }) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

it('keeps the item/GST caption and one server-save status beside the docked actions', async () => {
  // Counter §7: a bare total hid GST and the save status was away from Record.
  const restore = atWidth(390);
  try {
    renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
    const caption = await screen.findByTestId('total-dock-caption');
    expect(caption).toHaveTextContent('2 items · includes GST ₹139.10');
    const dock = screen.getByTestId('purchase-dock');
    await userEvent.click(within(dock).getByRole('button', { name: 'Save draft' }));
    expect(await within(dock).findByRole('status')).toHaveTextContent('Draft saved');
    expect(screen.getAllByText(/Draft saved/)).toHaveLength(1);
  } finally {
    restore();
  }
});

describe('current draft safety (purchase §7)', () => {
  const UNSAVED = "Not saved yet — don't close this screen";
  it('does not claim current typing saved when an older save reply arrives', async () => {
    // Defect: the server slice's last success stayed Saved after a newer edit.
    const restore = atWidth(390);
    const pending = deferred();
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const qty = await screen.findByLabelText('Qty, line 1');
      await userEvent.clear(qty);
      await userEvent.type(qty, '21');
      expect(within(screen.getByTestId('purchase-dock')).getByRole('status')).toHaveTextContent(
        UNSAVED
      );
      service.updatePurchaseBill.mockImplementationOnce(() => pending.promise);
      await userEvent.click(
        within(screen.getByTestId('purchase-dock')).getByRole('button', { name: 'Save draft' })
      );
      await waitFor(() => expect(service.updatePurchaseBill).toHaveBeenCalledTimes(1));
      await userEvent.clear(qty);
      await userEvent.type(qty, '22');
      await act(async () => pending.resolve(envelope({ ...DRAFT, version: 4 })));
      expect(qty).toHaveValue('22');
      expect(within(screen.getByTestId('purchase-dock')).getByRole('status')).toHaveTextContent(
        UNSAVED
      );
    } finally {
      pending.resolve(envelope(DRAFT));
      restore();
    }
  });

  it('keeps an incomplete line visibly unsaved when the draft request omits it', async () => {
    // Defect: a partial row is filtered out of the wire body, so Saved would lose it on reload.
    const restore = atWidth(390);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const qty = await screen.findByLabelText('Qty, line 1');
      await userEvent.clear(qty);
      await userEvent.click(
        within(screen.getByTestId('purchase-dock')).getByRole('button', { name: 'Save draft' })
      );
      await waitFor(() => expect(service.updatePurchaseBill).toHaveBeenCalled());
      expect(
        (service.updatePurchaseBill.mock.calls[0]?.[1] as { lines: unknown[] }).lines
      ).toHaveLength(1);
      expect(qty).toHaveValue('');
      expect(within(screen.getByTestId('purchase-dock')).getByRole('status')).toHaveTextContent(
        UNSAVED
      );
    } finally {
      restore();
    }
  });

  it('guards a custom GST choice on an unfinished new line', async () => {
    // Defect: an otherwise empty row is omitted from the draft, including a tax choice.
    renderWithProviders(<PurchaseBillEditorPageContent documentId={null} />);
    await userEvent.click(await screen.findByLabelText('GST, line 1'));
    await userEvent.click(await screen.findByRole('option', { name: /5\s*%/ }));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('asks before unsaved closing, lets the merchant stay, and guards a tab reload', async () => {
    // Defect: purchase edits have no device copy and closing the editor silently lost them.
    const restore = atWidth(390);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      await userEvent.type(
        await screen.findByLabelText('Notes'),
        'Radhe Krishna Enterprises electrical panel'
      );
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await act(async () => {
        store.dispatch(
          showSnackbar({ severity: 'error', id: 'purchases.line.incomplete', params: { n: 2 } })
        );
      });
      await userEvent.click(screen.getByRole('button', { name: 'Close bill' }));
      // A stale toast covered the leave question on the phone in the browser review.
      expect(store.getState().snackbar.snackbarOpen).toBe(false);
      expect(
        await screen.findByRole('dialog', { name: "Leave? This bill isn't saved." })
      ).toBeVisible();
      await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.getByLabelText('Notes')).toHaveValue(
        'Radhe Krishna Enterprises electrical panel'
      );
      expect(mockPush).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Close bill' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
      expect(mockPush).toHaveBeenCalledWith('/purchases/bills');
    } finally {
      restore();
    }
  });

  it('does not offer server save or Record while offline or imply a device copy exists', async () => {
    // Defect: an offline purchase could retain Saved and still offer finishing writes.
    const restore = atWidth(390);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      await screen.findByLabelText('Notes');
      await act(async () => {
        store.dispatch(browserWentOffline());
      });
      const dock = screen.getByTestId('purchase-dock');
      expect(within(dock).getByRole('status')).toHaveTextContent(UNSAVED);
      expect(within(dock).getByRole('button', { name: 'Save draft' })).toBeDisabled();
      expect(within(dock).getByRole('button', { name: 'Record' })).toBeDisabled();
    } finally {
      store.dispatch(responseObserved());
      restore();
    }
  });

  it('never records a bill with a visible half-entered row and focuses that row', async () => {
    // Defect: draft filtering omitted the bad row, then Record posted the remaining rows.
    const restore = atWidth(390);
    service.recordPurchaseBill.mockResolvedValue(envelope(RECORDED));
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const row = await screen.findByRole('button', { name: 'line 2' });
      await userEvent.click(row);
      await userEvent.clear(screen.getByLabelText('Qty, line 2'));
      await userEvent.click(row);
      await userEvent.click(
        within(screen.getByTestId('purchase-dock')).getByRole('button', { name: 'Record' })
      );
      await waitFor(() => expect(store.getState().snackbar.id).toBe('purchases.line.incomplete'));
      expect(service.updatePurchaseBill).not.toHaveBeenCalled();
      expect(service.recordPurchaseBill).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Qty, line 2')).toHaveFocus();
    } finally {
      restore();
    }
  });

  it('keeps an unchanged server cost saved when the input only removes trailing zeros', async () => {
    // Defect: blurring 46.0000 to 46.00 is formatting, not unsaved business data.
    renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
    const cost = await screen.findByLabelText('Cost, line 1');
    await userEvent.click(cost);
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved');
  });

  it('resolves a blank cost from the server before asking how much was paid', async () => {
    // Defect: blank means the item default on the server, but the client priced it as zero.
    signInPayer();
    renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
    const cost = await screen.findByLabelText('Cost, line 1');
    await userEvent.clear(cost);
    await userEvent.click(screen.getByTestId('purchase-record'));
    await waitFor(() => expect(service.updatePurchaseBill).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('purchase-paid-now-confirm')).toHaveTextContent('₹2,921.00');
    expect(Number((screen.getByLabelText('Cost, line 1') as HTMLInputElement).value)).toBe(46);
    expect(service.recordPurchaseBill).not.toHaveBeenCalled();
  });

  it('never replaces newer cost typing with a server-filled default from an older save', async () => {
    // Defect guard for source-default hydration: a late fallback must not overwrite an explicit price.
    const pending = deferred();
    service.updatePurchaseBill.mockImplementationOnce(() => pending.promise);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const cost = await screen.findByLabelText('Cost, line 1');
      await userEvent.clear(cost);
      await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      await waitFor(() => expect(service.updatePurchaseBill).toHaveBeenCalledTimes(1));
      await userEvent.type(cost, '40');
      await act(async () => pending.resolve(envelope({ ...DRAFT, version: 4 })));
      expect(Number((cost as HTMLInputElement).value)).toBe(40);
      expect(screen.getByRole('status')).toHaveTextContent(
        "Not saved yet — don't close this screen"
      );
    } finally {
      pending.resolve(envelope(DRAFT));
    }
  });

  it('locks the editor and drops repeated Record taps during the save before Record', async () => {
    // Defect: the draft save happened before recording=true, leaving the counter editable and tappable.
    const pending = deferred();
    service.updatePurchaseBill.mockImplementationOnce(() => pending.promise);
    service.recordPurchaseBill.mockResolvedValue(envelope(RECORDED));
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const record = await screen.findByTestId('purchase-record');
      await userEvent.dblClick(record);
      await waitFor(() => expect(service.updatePurchaseBill).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText('Qty, line 1')).toBeDisabled();
      expect(record).toBeDisabled();
      await act(async () => pending.resolve(envelope({ ...DRAFT, version: 4 })));
      await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalledTimes(1));
    } finally {
      pending.resolve(envelope(DRAFT));
    }
  });
});

describe('the supplier details on a 1280 laptop (WP-05 compact context)', () => {
  /* The review measured the supplier block at about 410 px before the first
     line on a laptop. Once the bill has its supplier invoice number, the
     details fold to one line that says what they hold. */
  it('folds a filled draft to one line naming the invoice number and the dates', async () => {
    const restore = atWidth(1280);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      const fold = await screen.findByRole('button', { name: /More details/ });
      expect(fold).toHaveAttribute('aria-expanded', 'false');
      expect(fold).toHaveTextContent('AT/778');
      expect(fold).toHaveTextContent('Due date');
      expect(screen.queryByText('Input tax credit')).toBeNull();
    } finally {
      restore();
    }
  });

  it('opens the folded details when the number is a duplicate, so the warning is seen', async () => {
    service.recordPurchaseBill.mockRejectedValue({
      code: 'duplicate_supplier_invoice',
      message: 'Already recorded as PB/26-27/0003 on 12/08/2026.',
      details: { existing: { id: 'b0', number: 'PB/26-27/0003', document_date: '2026-08-12' } },
      requestId: null,
      status: 409,
    });
    const restore = atWidth(1280);
    try {
      renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
      await screen.findByRole('button', { name: /More details/ });
      await userEvent.click(
        within(screen.getByTestId('purchase-dock')).getByRole('button', { name: 'Record' })
      );
      expect(await screen.findByTestId('duplicate-warning')).toBeVisible();
      expect(screen.getByRole('button', { name: /More details/ })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    } finally {
      restore();
    }
  });
});

const RECORDED = {
  ...DRAFT,
  number: 'PB/26-27/0001',
  status: 'recorded' as const,
  version: 5,
  partySnapshot: { name: 'Agro Traders', gstin: null, stateCode: '27', mobile: null },
};

const signInPayer = (): void =>
  signIn(
    [
      'purchases.bill.read',
      'purchases.bill.write',
      'parties.party.read',
      'inventory.item.read',
      'payments.payment.read',
      'payments.payment.write',
    ],
    ['purchases', 'parties', 'inventory', 'payments']
  );

it('asks "Paid now?" at Record and sends the money with the record call (PUR-01 FR-6h)', async () => {
  /** PUR-02 AC-3 path — the sheet defaults to the whole bill in cash; confirming sends
   *  PAY-01's `mode_breakup` dated with the bill ON the record call (one transaction on the
   *  server), and the toast names what was paid. */
  signInPayer();
  service.recordPurchaseBill.mockResolvedValue({
    ...envelope({ ...RECORDED, status: 'paid' }, '0.00'),
    payment: { paymentId: 'pay1', number: 'PAYOUT/26-27/0001', amount: '2921.00' },
  });
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  const confirm = await screen.findByTestId('purchase-paid-now-confirm');
  expect(confirm).toHaveTextContent('Paid ₹2,921.00 · Record');
  expect(service.recordPurchaseBill).not.toHaveBeenCalled();
  await userEvent.click(confirm);
  await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalled());
  const [, body] = service.recordPurchaseBill.mock.calls[0] as [string, Record<string, unknown>];
  expect(body).toEqual({
    version: 4,
    payment: {
      payment_date: '2026-09-18',
      mode_breakup: [{ mode: 'cash', amount: '2921.00', reference: '' }],
    },
  });
  await waitFor(() =>
    expect(store.getState().snackbar.id).toBe('purchases.editor.recordedSettled')
  );
  expect(mockPush).toHaveBeenCalledWith('/purchases/bills/b1');
});

it('P-D4: "Paid now" by PhonePe is sent as UPI with upi_app phonepe, not Other UPI', async () => {
  /** QA P-D4 — the drawer passed `app=""` to the mode chips and dropped the app they
   *  reported, so the voucher's `mode_breakup` had no `upi_app` and PhonePe read "Other UPI". */
  signInPayer();
  service.recordPurchaseBill.mockResolvedValue({
    ...envelope({ ...RECORDED, status: 'paid' }, '0.00'),
    payment: { paymentId: 'pay1', number: 'PAYOUT/26-27/0001', amount: '2921.00' },
  });
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  const confirm = await screen.findByTestId('purchase-paid-now-confirm');
  const phonePe = screen.getByRole('radio', { name: 'PhonePe' });
  await userEvent.click(phonePe);
  expect(phonePe).toBeChecked();
  await userEvent.click(confirm);
  await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalled());
  const [, body] = service.recordPurchaseBill.mock.calls[0] as [string, Record<string, unknown>];
  expect(body.payment).toEqual({
    payment_date: '2026-09-18',
    mode_breakup: [{ mode: 'upi', amount: '2921.00', reference: '', upi_app: 'phonepe' }],
  });
});

it('"Pay later" records the bill on credit with no payment (PUR-01 FR-6h)', async () => {
  signInPayer();
  service.recordPurchaseBill.mockResolvedValue(envelope(RECORDED, '-2921.00'));
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  await userEvent.click(await screen.findByTestId('purchase-pay-later'));
  await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalled());
  expect(service.recordPurchaseBill.mock.calls[0]?.[1]).toEqual({ version: 4 });
  await waitFor(() => expect(store.getState().snackbar.id).toBe('purchases.editor.recorded'));
});

it('never opens the "Paid now" sheet for a role that cannot pay suppliers', async () => {
  /** The default sign-in has no payments write: Record goes straight to the server, and the
   *  test above ('saves, then records…') is the proof that the body carries no payment. */
  service.recordPurchaseBill.mockResolvedValue(envelope(RECORDED, '-2921.00'));
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await userEvent.click(await screen.findByTestId('purchase-record'));
  await waitFor(() => expect(service.recordPurchaseBill).toHaveBeenCalled());
  expect(screen.queryByTestId('purchase-paid-now-confirm')).not.toBeInTheDocument();
});

it('never offers input tax credit to a composition shop (FR-11)', async () => {
  mockProfile.gstType = 'composition';
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  expect(await screen.findByTestId('purchase-grand-total')).toHaveTextContent('₹2,921.00');
  expect(screen.queryByText('Input tax credit')).not.toBeInTheDocument();
  expect(screen.getAllByText(/CGST \(cost\)/).length).toBeGreaterThan(0);
});

describe('SH-011 — first-save recovery and one save lane (ADR-063)', () => {
  /**
   * The purchase editor saves from four places: autosave, the supplier pick,
   * "Save draft" and the save before Record. Before ADR-063 reached purchases a
   * first POST carried no identity and nothing serialised the four, so a lost
   * reply or two overlapping saves made a SECOND draft bill of the same paper.
   */
  let editor: UsePurchaseBillEditorResult;
  function Probe({
    kind = 'purchase_bill',
  }: Readonly<{ kind?: 'purchase_bill' | 'purchase_order' }>) {
    editor = usePurchaseBillEditor(null, kind);
    return null;
  }
  const fresh = (version = 1, over: Partial<PurchaseBill> = {}) =>
    envelope({ ...DRAFT, version, ...over }, null, false);
  const recovered = (version: number, over: Partial<PurchaseBill> = {}) =>
    envelope({ ...DRAFT, version, ...over }, null, true);
  const open = async (kind?: 'purchase_bill' | 'purchase_order') => {
    const view = renderWithProviders(<Probe kind={kind} />);
    await waitFor(() => expect(editor.editor.context).not.toBeNull());
    return view;
  };
  // A lost reply marks the network degraded, which correctly pauses autosave;
  // each scenario starts online.
  beforeEach(() => {
    store.dispatch(responseObserved());
  });

  it('retries a lost first save with the same creation key', async () => {
    await open();
    service.createPurchaseBill.mockRejectedValueOnce(new Error('lost response'));
    service.createPurchaseBill.mockResolvedValueOnce(fresh());
    await act(async () => {
      await editor.save(true);
    });
    await act(async () => {
      await editor.save(true);
    });
    const first = service.createPurchaseBill.mock.calls[0]?.[0] as Record<string, unknown>;
    const retry = service.createPurchaseBill.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(first.client_draft_key).toEqual(expect.any(String));
    expect(retry.client_draft_key).toBe(first.client_draft_key);
    expect(editor.editor.documentId).toBe('b1');
  });

  it('queues an overlapping save behind the first create instead of POSTing twice', async () => {
    await open('purchase_order');
    const pending = deferred();
    service.createPurchaseBill.mockImplementationOnce(() => pending.promise);
    let first!: Promise<unknown>;
    act(() => {
      first = editor.save(true);
    });
    await waitFor(() => expect(service.createPurchaseBill).toHaveBeenCalledTimes(1));
    act(() => editor.form.setValue('notes', 'typed during save', { shouldDirty: true }));
    let second!: Promise<unknown>;
    act(() => {
      second = editor.save(false);
    });
    await act(async () => {
      pending.resolve(fresh(1, { kind: 'purchase_order' }));
      await first;
      await second;
    });
    expect(service.createPurchaseBill).toHaveBeenCalledTimes(1);
    expect(service.createPurchaseBill.mock.calls[0]?.[1]).toMatchObject({ kind: 'purchase_order' });
    expect(service.updatePurchaseBill).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ version: 1, notes: 'typed during save' }),
      expect.objectContaining({ kind: 'purchase_order' })
    );
  });

  it('adopts a recovered untouched draft with an explicit version-1 PATCH of current typing', async () => {
    await open();
    act(() => editor.form.setValue('notes', 'current typing', { shouldDirty: true }));
    service.createPurchaseBill.mockResolvedValueOnce(recovered(1, { notes: 'old body' }));
    service.updatePurchaseBill.mockResolvedValueOnce(fresh(2, { notes: 'current typing' }));
    let result: unknown;
    await act(async () => {
      result = await editor.save(false);
    });
    expect(service.updatePurchaseBill).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ version: 1, notes: 'current typing' }),
      expect.anything()
    );
    expect(result).not.toBeNull();
    expect(editor.editor.version).toBe(2);
    expect(editor.editor.saveState).toBe('saved');
  });

  it('asks for review instead of overwriting a recovered draft edited elsewhere', async () => {
    await open();
    service.createPurchaseBill.mockResolvedValueOnce(recovered(3));
    let result: unknown;
    await act(async () => {
      result = await editor.save(false);
    });
    expect(result).toBeNull();
    expect(editor.editor.saveState).toBe('conflict');
    await act(async () => {
      await editor.save(true);
    });
    expect(service.updatePurchaseBill).not.toHaveBeenCalled();
  });

  it('never records again a recovered bill that was already recorded', async () => {
    await open();
    const RECORDED_BILL = {
      ...DRAFT,
      status: 'recorded' as const,
      number: 'PB/26-27/0009',
      version: 2,
    };
    service.createPurchaseBill.mockResolvedValueOnce(envelope(RECORDED_BILL, null, true));
    act(() => {
      editor.form.setValue('partyId', 'p1', { shouldDirty: true });
      editor.form.setValue('supplierInvoiceNumber', 'AT/778');
      editor.form.setValue('documentDate', '2026-09-18');
    });
    let result: PurchaseBillEnvelope | null = null;
    await act(async () => {
      result = await editor.record(null);
    });
    expect(service.recordPurchaseBill).not.toHaveBeenCalled();
    expect(service.updatePurchaseBill).not.toHaveBeenCalled();
    expect((result as PurchaseBillEnvelope | null)?.bill.number).toBe('PB/26-27/0009');
    expect(editor.editor.recorded?.bill.id).toBe('b1');
  });

  it('keeps typing made during a slow autosave dirty, and saves it next', async () => {
    jest.useFakeTimers();
    try {
      await open();
      const pending = deferred();
      service.createPurchaseBill.mockImplementationOnce(() => pending.promise);
      service.updatePurchaseBill.mockResolvedValueOnce(fresh(2));
      act(() => editor.form.setValue('partyId', 'p1', { shouldDirty: true }));
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      expect(service.createPurchaseBill).toHaveBeenCalledTimes(1);
      act(() => editor.form.setValue('notes', 'typed while saving', { shouldDirty: true }));
      await act(async () => {
        pending.resolve(fresh());
      });
      expect(editor.form.formState.isDirty).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      expect(service.updatePurchaseBill).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ version: 1, notes: 'typed while saving' }),
        expect.anything()
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a late save reply after the editor and account are gone', async () => {
    const view = await open();
    const pending = deferred();
    service.createPurchaseBill.mockImplementationOnce(() => pending.promise);
    act(() => {
      void editor.save(true);
    });
    await waitFor(() => expect(service.createPurchaseBill).toHaveBeenCalledTimes(1));
    view.unmount();
    act(() => {
      store.dispatch(resetAllFeatureState());
    });
    await act(async () => {
      pending.resolve(fresh());
    });
    expect(store.getState().purchaseBillEditor?.documentId ?? null).toBeNull();
  });
});

describe('purchase counter quick-add', () => {
  it('adds a list pick as the third line, preserves purchase cost defaults and focuses its Qty', async () => {
    // Missing composition: entering a supplier item required opening a line picker first.
    renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
    const user = userEvent.setup();
    const search = await screen.findByRole('combobox', { name: 'Search items to add' });
    await user.click(search);
    await user.type(search, 'driver');
    await user.click(await screen.findByRole('option', { name: /LED driver/, selected: true }));
    await waitFor(() => {
      const cell = document.activeElement?.closest<HTMLElement>('[data-line-cell]');
      expect({ row: cell?.dataset.row, col: cell?.dataset.col }).toEqual({ row: '2', col: '1' });
    });
    const cost = document.querySelector<HTMLInputElement>(
      '[data-line-cell][data-row="2"][data-col="2"] input'
    );
    expect(cost).toHaveValue('42.00');
    expect(document.querySelectorAll('[data-testid="line-items-editor"] section')).toHaveLength(3);
    expect(mockDriver.purchasePrice).toBe('42.00');
    expect(service.recordPurchaseBill).not.toHaveBeenCalled();
  });

  it('a repeated barcode raises the existing Qty from20 to21 without adding a row or moving the scan caret', async () => {
    // Missing counter path: a repeat scan must not create another supplier bill line.
    renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
    const user = userEvent.setup();
    const search = await screen.findByRole('combobox', { name: 'Search items to add' });
    await user.click(search);
    await user.type(search, '8900000000001{Enter}');
    await waitFor(() =>
      expect(document.querySelector('[data-testid="line-items-editor"] section')).toHaveTextContent(
        '21 NOS'
      )
    );
    expect(document.querySelectorAll('[data-testid="line-items-editor"] section')).toHaveLength(2);
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
    expect(service.recordPurchaseBill).not.toHaveBeenCalled();
  });
});

it("re-picking an item preserves this bill's edited cost and focuses the existing Qty", async () => {
  // Regression: a repeat pick must not overwrite a supplier's bill-specific cost.
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  await screen.findByTestId('purchase-grand-total');
  const user = userEvent.setup();
  const first = document.querySelector('[data-testid="line-items-editor"] section');
  if (!first) throw new Error('Missing purchase line');
  const toggle = first.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (toggle?.getAttribute('aria-expanded') === 'false') await user.click(toggle);
  const cost = screen.getByLabelText('Cost, line 1');
  await user.clear(cost);
  await user.type(cost, '40');
  const search = await screen.findByRole('combobox', { name: 'Search items to add' });
  await user.click(search);
  await user.type(search, 'Rice');
  await user.click(await screen.findByRole('option', { name: /^Rice/, selected: true }));
  await waitFor(() =>
    expect(
      document.querySelector<HTMLInputElement>('[data-line-cell][data-row="0"][data-col="1"] input')
    ).toHaveValue('21')
  );
  expect(cost).toHaveValue('40.00');
  expect(document.activeElement?.closest<HTMLElement>('[data-line-cell]')?.dataset.row).toBe('0');
  expect(document.querySelectorAll('[data-testid="line-items-editor"] section')).toHaveLength(2);
});

it('finds a numbered line on a long purchase bill, including identical item names', async () => {
  // Prevents a long bill's finder selecting an indistinguishable duplicate name.
  service.getPurchaseBill.mockResolvedValue(
    envelope({
      ...DRAFT,
      lines: Array.from({ length: 10 }, (_, i) => line({ id: `l${i}`, lineNo: i + 1 })),
    })
  );
  renderWithProviders(<PurchaseBillEditorPageContent documentId="b1" />);
  const user = userEvent.setup();
  const finder = await screen.findByRole('combobox', { name: 'Find a line on this bill' });
  await user.click(finder);
  await user.click(await screen.findByRole('option', { name: /^line 5 · Rice/i }));
  await waitFor(() =>
    expect(document.activeElement?.closest<HTMLElement>('[data-line-cell]')?.dataset.row).toBe('4')
  );
});
