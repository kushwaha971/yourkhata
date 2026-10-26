import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserWentOffline, responseObserved } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';
import { formatClock } from 'src/utils/dates';
import { localDraftKey, readLocalDraft } from 'src/utils/localDrafts';

import { useInvoiceEditor, type UseInvoiceEditorResult } from '../hooks/useInvoiceEditor';
import { wireDocument } from '../testing/salesFixtures';

import { InvoiceEditorPageContent } from './InvoiceEditorPageContent';
import { InvoicePaymentDrawer } from './InvoicePaymentDrawer';

import type { InvoiceFormValues } from '../view-model/invoiceForm';

/**
 * SAL-02 / SAL-07 on screen. The editor's context (the shop's GST type and
 * the rates by date) comes from two other features' services, stubbed at the
 * module boundary; nothing here reaches the network.
 */
// The item search waits out its debounce and a mocked round trip; under a
// full parallel run that has taken past 3 s, so these waits are generous.
jest.setTimeout(20000);
jest.mock('../api/salesService');
jest.mock('../../business-profile/api/businessProfileService', () => ({
  fetchTenant: jest.fn(async () => ({
    gstType: 'regular',
    stateCode: '27',
    businessType: 'retail',
  })),
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
jest.mock('../../parties/api/partyService', () => ({
  ...jest.requireActual('../../parties/api/partyService'),
  listParties: jest.fn(async () => ({
    rows: [
      {
        id: 'p-ka',
        name: 'Bengaluru Traders',
        displayCode: null,
        mobile: null,
        isCustomer: true,
        isSupplier: false,
        balance: '0.00',
        status: 'active',
        lastActivityAt: null,
        tags: [],
      },
    ],
    meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
    totals: null,
  })),
  getParty: jest.fn(async () => ({
    party: { id: 'p-ka', name: 'Bengaluru Traders', stateCode: '29', billingAddress: {} },
    summary: { balance: '0.00' },
    credit: null,
  })),
}));
let mockSearch = '';
const mockLedBulb = {
  id: 'i-bulb',
  name: 'Syska LED bulb 9W',
  sku: 'LED-9W',
  barcode: '8901234567890',
  itemType: 'goods',
  category: null,
  unit: { code: 'PCS', allowDecimal: false },
  sellingPrice: '450.00',
  purchasePrice: null,
  taxCode: 'GST5',
  hsnSac: '8539',
  taxInclusiveSelling: false,
  trackStock: true,
  onHand: '40.000',
  avgCost: null,
  reorderPoint: null,
  stockStatus: 'in_stock',
  stockValue: null,
  status: 'active',
  matchField: 'name',
  updatedAt: '2026-10-20T10:00:00Z',
};
const mockTubeLight = {
  ...mockLedBulb,
  id: 'i-tube',
  name: 'Philips tube light 20W',
  sku: 'TUBE-20W',
  barcode: '8901234567891',
};
const mockRagi = {
  ...mockLedBulb,
  id: 'i-ragi',
  name: 'Ragi flour 1 kg',
  sku: 'RAGI-1',
  barcode: null,
  status: 'archived',
};
jest.mock('../../inventory/api/itemService', () => ({
  ...jest.requireActual('../../inventory/api/itemService'),
  getItem: jest.fn(),
  searchItems: jest.fn(
    async (q: string, _page: number, _signal: unknown, options?: { status?: string }) => ({
      rows: (options?.status === 'archived' ? [mockRagi] : [mockLedBulb, mockTubeLight]).filter(
        (row) => !q || row.name.toLowerCase().includes(q.toLowerCase())
      ),
      hasMore: false,
    })
  ),
  lookupItemByBarcode: jest.fn(async (code: string) =>
    code === mockLedBulb.barcode
      ? mockLedBulb
      : code === mockRagi.sku
        ? { ...mockRagi, status: 'active' }
        : code === 'NEW-1'
          ? { ...mockTubeLight, id: 'i-new', sku: 'NEW-1', name: 'ragi' }
          : null
  ),
  restoreItem: jest.fn(async () => ({})),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => '/sales/invoices/new',
}));

const sales = jest.requireMock('../api/salesService') as {
  createInvoice: jest.Mock;
  updateInvoice: jest.Mock;
  issueInvoice: jest.Mock;
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
      activeTenant: { id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['sales', 'parties', 'inventory'],
      version: 1,
    })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  // The editor asks for the bills on hold; none unless a test says so.
  (sales as unknown as { listInvoices: jest.Mock }).listInvoices.mockResolvedValue({
    rows: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totals: { count: 0, grandTotal: '0.00', amountDue: '0.00' },
    tabs: null,
  });
  mockSearch = '';
  store.dispatch(resetAllFeatureState());
  window.localStorage.clear();
});

describe('the bill editor', () => {
  it('opens a retail shop on a walk-in Tax Invoice with Issue disabled until a line exists', async () => {
    // An Issue that is live on an empty bill posts a ₹0 invoice and burns a number.
    signIn(['sales.invoice.read', 'sales.invoice.write']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    expect(await screen.findByTestId('invoice-issue')).toBeDisabled();
    // Design §A4: "New bill", with the kind of bill underneath.
    expect(screen.getByRole('heading', { name: 'New bill' })).toBeInTheDocument();
    expect(screen.getByText('Tax Invoice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick sale', pressed: true })).toBeInTheDocument();
    // Design §A4: a bill with no item has no totals card yet.
    expect(screen.queryByTestId('invoice-grand-total')).not.toBeInTheDocument();
    // Nothing typed, nothing saved: an untouched editor must not create a draft.
    // Let the context thunks and the form seed settle before the last look.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    expect(sales.createInvoice).not.toHaveBeenCalled();
  });

  it('tells a member who cannot bill so, instead of an editor that will refuse', async () => {
    signIn(['sales.invoice.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    expect(screen.getByText('Bills are not available')).toBeInTheDocument();
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
  });
});

describe('the line table on a desktop (design §A4 dBill)', () => {
  it('puts the search in row one and every column the design names in the header', async () => {
    /* Prevents: the table losing a column (B17 clipped Total) or the search
       moving out of the table, where the design keeps it. The table scrolls
       sideways rather than clipping, so no column can be cut. */
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches:
        /min-width/.test(query) &&
        1536 >= Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? Infinity),
    })) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const table = await screen.findByTestId('invoice-line-table');
      expect(table).toHaveClass('overflow-x-auto');
      expect(screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())).toEqual(
        expect.arrayContaining(['#', 'Item', 'Qty', 'Rate', 'Amount'])
      );
      expect(
        await within(screen.getByTestId('ub-edit-table-leading')).findByRole('combobox', {
          name: 'Search items to add',
        })
      ).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('says the scanner is ready and brings the caret back to the search on F2', async () => {
    /* Prevents: a cashier at a desktop who clicked into a Qty having to reach
       for the mouse before the next scan (design §A4 billTable: F2). */
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: /min-width/.test(query),
    })) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const search = await screen.findByRole('combobox', { name: 'Search items to add' });
      expect(search).toHaveAttribute('placeholder', 'Search or scan item');
      expect(screen.getByText('Scanner ready')).toBeInTheDocument();
      search.blur();
      expect(search).not.toHaveFocus();
      fireEvent.keyDown(window, { key: 'F2' });
      expect(search).toHaveFocus();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('a 1280 laptop (WP-05 dock, design §A4 dBill columns)', () => {
  it('docks the total and Issue under the lines, since the totals panel is no longer beside them', async () => {
    // The review measured a 290 px phone card per line at 1280: the totals
    // panel beside the lines left them 696 px. The owner chose to move the
    // totals under the lines below 1536 px and keep Issue in a docked bar.
    const width = 1280;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*([\d.]+)/.exec(query)?.[1];
      const max = /max-width:\s*([\d.]+)/.exec(query)?.[1];
      return {
        ...original(query),
        matches: min ? width >= Number(min) : max ? width <= Number(max) : false,
      };
    }) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const dock = await screen.findByTestId('invoice-dock');
      // A Quick Sale finishes on "Paid cash" or "UPI or other"; a saved
      // customer's bill on Issue (below).
      expect(within(dock).getByRole('button', { name: /Paid cash/ })).toBeInTheDocument();
      expect(screen.getByTestId('invoice-issue')).toHaveClass('max-2xl:hidden');
      await userEvent.click(screen.getByRole('button', { name: 'Saved customer' }));
      expect(within(dock).getByRole('button', { name: /Issue/ })).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('puts More details and the totals in the column beside the lines, and says a quick sale needs no name', async () => {
    /* Owner, 26 Oct 2026, over WP-05: at 1280 the design's 340 px column
       holds More details and the totals, so the lines and the total are
       seen together. Prevents: the totals dropping back under the lines, or
       More details staying in the customer card as well (two of them). */
    const width = 1280;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*([\d.]+)/.exec(query)?.[1];
      const max = /max-width:\s*([\d.]+)/.exec(query)?.[1];
      return {
        ...original(query),
        matches: min ? width >= Number(min) : max ? width <= Number(max) : false,
      };
    }) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const column = await screen.findByTestId('invoice-side');
      const details = screen.getAllByRole('button', { name: /More details/ });
      expect(details).toHaveLength(1);
      expect(column).toContainElement(details[0] ?? null);
      expect(column).not.toContainElement(screen.getByTestId('invoice-no-name'));
      expect(screen.getByTestId('invoice-no-name')).toHaveTextContent(
        'Walk-in customer. No name needed.'
      );
      expect(details[0]).toHaveAttribute('aria-expanded', 'false');
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('the bill details on a 1280 laptop (WP-05 compact context)', () => {
  it('folds the date and place of supply under one line that says what they hold', async () => {
    const width = 1280;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      const min = /min-width:\s*([\d.]+)/.exec(query)?.[1];
      const max = /max-width:\s*([\d.]+)/.exec(query)?.[1];
      return {
        ...original(query),
        matches: min ? width >= Number(min) : max ? width <= Number(max) : false,
      };
    }) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const fold = await screen.findByRole('button', { name: /More details/ });
      expect(fold).toHaveTextContent(/\d{4}/); // the bill date
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('a new bill on a phone (design §A4 pBillEmpty)', () => {
  it('starts with no line and says how to begin, instead of an empty line card', async () => {
    /* Prevents: a blank "Line 1" card the cashier has to fill or delete. */
    const original = window.matchMedia;
    // A 390 px phone: only max-width queries match.
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches:
        /max-width/.test(query) && 390 <= Number(/max-width:\s*([\d.]+)/.exec(query)?.[1] ?? 0),
    })) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      await screen.findByTestId('task-bar');
      // Design §A4 phone bar: × · New bill / its kind · ⋯, not the app's own bar.
      expect(
        within(screen.getByTestId('task-bar')).getByRole('heading', { name: 'New bill' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.queryByTestId('invoice-lines')).not.toBeInTheDocument();
      expect(await screen.findByText('No items yet')).toBeInTheDocument();
      expect(screen.getByText('Type a name or code above to add an item.')).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('keeps the pay buttons off and says why in the line above them', async () => {
    /* Design §A4: "Empty bill: pay buttons stay off, and the line above them
       says why". Prevents: two grey buttons that say nothing at a counter. */
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches:
        /max-width/.test(query) && 390 <= Number(/max-width:\s*([\d.]+)/.exec(query)?.[1] ?? 0),
    })) as typeof window.matchMedia;
    try {
      signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      const dock = await screen.findByTestId('invoice-dock');
      expect(within(dock).getByText('Add an item to finish the bill')).toBeInTheDocument();
      expect(within(dock).getByRole('button', { name: /Paid cash/ })).toBeDisabled();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('the place of supply for a picked party (QA S-D1)', () => {
  it("previews IGST for a party in another state, not the shop's CGST + SGST", async () => {
    // S-D1: an empty place of supply was previewed as the SHOP's state, so a
    // Karnataka party of a Maharashtra shop saw CGST + SGST while the issued
    // bill (resolved on the server from the party) carried IGST.
    signIn(['sales.invoice.read', 'sales.invoice.write', 'parties.party.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await screen.findByTestId('invoice-issue');
    expect(screen.getByText('Intra-state supply — CGST + SGST')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Saved customer' }));
    await userEvent.type(screen.getByLabelText('Saved customer'), 'Beng');
    const match = await screen.findByRole('option', { name: /Bengaluru Traders/ });
    await waitFor(() => expect(match).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(match);
    expect(await screen.findByText('Inter-state supply — IGST')).toBeInTheDocument();
  });
});

describe('the walk-in payment sheet (SAL-07 FR-3)', () => {
  it('defaults to the whole amount in cash and confirms it', async () => {
    const onConfirm = jest.fn();
    renderWithProviders(
      <InvoicePaymentDrawer
        open
        grandTotal="473.00"
        busy={false}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    const confirm = await screen.findByTestId('invoice-payment-confirm');
    expect(confirm).toHaveTextContent('Received ₹473.00 · Issue');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith([{ mode: 'cash', amount: '473.00', reference: '' }]);
  });

  it('refuses a split that does not add up to the bill', async () => {
    // A walk-in is never a receivable: ₹400 of a ₹473 bill cannot be issued.
    renderWithProviders(
      <InvoicePaymentDrawer
        open
        grandTotal="473.00"
        busy={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    const amount = await screen.findByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '400');
    await waitFor(() => expect(screen.getByTestId('invoice-payment-confirm')).toBeDisabled());
    expect(screen.getByRole('alert')).toHaveTextContent('₹473.00');
  });
});

describe('the payment sheet’s row checks (PAY-02 §10)', () => {
  it('says why a split row cannot be confirmed instead of greying the button silently', async () => {
    // The server refuses a zero row, a repeated mode and a cheque without its
    // number; before, the sheet either greyed the button with no reason or let
    // the row through to a snackbar after the tap. `paymentRowProblems` covers
    // all three; this pins that the reason reaches the screen.
    renderWithProviders(
      <InvoicePaymentDrawer
        open
        grandTotal="473.00"
        busy={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onCredit={jest.fn()}
      />
    );
    await screen.findByTestId('invoice-payment-confirm');
    await userEvent.click(screen.getByRole('button', { name: 'Split payment' }));
    const amounts = screen.getAllByLabelText('Amount');
    await userEvent.type(amounts[1] as HTMLElement, '0');
    expect(await screen.findByText(/Enter an amount above zero/)).toBeInTheDocument();
    expect(screen.getByTestId('invoice-payment-confirm')).toBeDisabled();
  });
});

describe('a bill the stock cannot cover (QA B1)', () => {
  it('names the short item and what is on hand instead of going quiet', async () => {
    // The 409 was a locally presented code with no local surface: Issue did
    // nothing, the payment sheet stayed open and nothing said why.
    signIn(['sales.invoice.write', 'sales.invoice.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await screen.findByTestId('invoice-issue');
    act(() => {
      store.dispatch({
        type: 'invoiceEditor/issueInvoice/rejected',
        payload: {
          code: 'insufficient_stock',
          status: 409,
          message: 'Not enough stock.',
          details: {
            lines: [
              {
                index: 0,
                item_name: 'QA Pen',
                requested: '7.000',
                available: '5.000',
                unit_code: 'NOS',
              },
            ],
          },
        },
      });
    });
    expect(await screen.findByText('Not enough stock to issue this bill')).toBeInTheDocument();
    expect(screen.getByText('QA Pen: 7 NOS on the bill, 5 NOS in stock')).toBeInTheDocument();
  });
});

it('B38 explains the sale date and later opening stock date on the refusal', async () => {
  // Today's on-hand stock must not hide why a historical sale is refused.
  signIn(['sales.invoice.write', 'sales.invoice.read']);
  renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
  await screen.findByTestId('invoice-issue');
  act(() => {
    store.dispatch({
      type: 'invoiceEditor/issueInvoice/rejected',
      payload: {
        code: 'insufficient_stock',
        status: 409,
        message: 'Not enough stock.',
        details: {
          lines: [
            {
              index: 0,
              item_name: 'QA Rice',
              requested: '2.500',
              available: '0.000',
              unit_code: 'KGS',
              as_of: '2026-03-15',
              opening_date: '2026-04-01',
            },
          ],
        },
      },
    });
  });
  expect(
    await screen.findByText('QA Rice: no stock on 15/03/2026. Opening stock starts 01/04/2026.')
  ).toBeInTheDocument();
});

it('asks only for customers when choosing who a sales bill is for', async () => {
  signIn(['sales.invoice.read', 'sales.invoice.write', 'parties.party.read']);
  renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Saved customer' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Saved customer' }));
  const parties = jest.requireMock('../../parties/api/partyService') as { listParties: jest.Mock };
  await waitFor(() =>
    expect(parties.listParties).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'customer' }),
      expect.anything()
    )
  );
});

describe('draft creation recovery', () => {
  let editor: UseInvoiceEditorResult;
  function Probe() {
    editor = useInvoiceEditor(null);
    return null;
  }
  const envelope = (version = 1, recovered = false) =>
    jest.requireActual('../api/salesService').toEnvelope({
      data: wireDocument({ status: 'draft', number: null, version }),
      meta: { draft_recovered: recovered },
    });
  const open = async () => {
    signIn(['sales.invoice.read', 'sales.invoice.write']);
    const view = renderWithProviders(<Probe />);
    await waitFor(() => expect(editor.editor.context).not.toBeNull());
    return view;
  };

  it('persists the same creation key before POST and reuses it after response loss/remount', async () => {
    const view = await open();
    sales.createInvoice.mockRejectedValueOnce(new Error('lost response'));
    await act(async () => {
      await editor.save(false);
    });
    const key = localDraftKey('t1', 'invoice', 'new', 'u1');
    const stored = readLocalDraft<InvoiceFormValues>(key);
    if (!stored) throw new Error('Expected the draft to be persisted before POST');
    const sentKey = sales.createInvoice.mock.calls[0][0].client_draft_key;
    expect(stored.form.clientDraftKey).toBe(sentKey);
    expect(sentKey).toBeTruthy();
    view.unmount();
    await open();
    act(() =>
      editor.form.reset({ ...stored.form, notes: 'new local text' }, { keepDefaultValues: true })
    );
    sales.createInvoice.mockResolvedValueOnce(envelope(1, true));
    sales.updateInvoice.mockResolvedValueOnce(envelope(2));
    await act(async () => {
      await editor.save(false);
    });
    expect(sales.createInvoice.mock.calls[1][0].client_draft_key).toBe(sentKey);
    expect(editor.editor.documentId).toBe('d1');
    expect(sales.updateInvoice).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ version: 1, notes: 'new local text' }),
      expect.anything()
    );
  });

  it('queues an overlapping save using the acknowledged id/version and newest typing', async () => {
    await open();
    let complete!: (value: unknown) => void;
    sales.createInvoice.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    sales.updateInvoice.mockResolvedValueOnce(envelope(2));
    let first!: Promise<unknown>;
    act(() => {
      first = editor.save(true);
    });
    await waitFor(() => expect(sales.createInvoice).toHaveBeenCalledTimes(1));
    act(() => editor.form.setValue('notes', 'typed during save', { shouldDirty: true }));
    let second!: Promise<unknown>;
    act(() => {
      second = editor.save(false);
    });
    expect(sales.updateInvoice).not.toHaveBeenCalled();
    await act(async () => {
      complete(envelope());
      await first;
      await second;
    });
    expect(sales.createInvoice).toHaveBeenCalledTimes(1);
    expect(sales.updateInvoice).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        version: 1,
        notes: 'typed during save',
      }),
      expect.anything()
    );
  });

  it('requires conflict review when a recovered first create already has newer edits', async () => {
    await open();
    sales.createInvoice.mockResolvedValueOnce(envelope(3, true));
    let result: unknown;
    await act(async () => {
      result = await editor.save(false);
    });
    expect(result).toBeNull();
    expect(editor.editor.saveState).toBe('conflict');
    await act(async () => {
      await editor.save(true);
    });
    expect(sales.updateInvoice).not.toHaveBeenCalled();
    expect(readLocalDraft(localDraftKey('t1', 'invoice', 'd1', 'u1'))?.version).toBe(1);
  });

  it('ignores a late save response after feature/account teardown', async () => {
    const view = await open();
    let complete!: (value: unknown) => void;
    sales.createInvoice.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    act(() => {
      void editor.save(false);
    });
    await waitFor(() => expect(sales.createInvoice).toHaveBeenCalledTimes(1));
    view.unmount();
    act(() => {
      store.dispatch(resetAllFeatureState());
    });
    await act(async () => {
      complete(envelope());
    });
    expect(store.getState().invoiceEditor?.documentId).toBeNull();
  });
});

/** Regression: Home selected an item but the new bill lost its default price. */
it('preserves a manual line against a late Home item reply', async () => {
  mockSearch = 'item=i-led';
  const service = jest.requireMock('../../inventory/api/itemService') as { getItem: jest.Mock };
  let answer!: (item: unknown) => void;
  service.getItem.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      })
  );
  let editor!: UseInvoiceEditorResult;
  function Probe() {
    editor = useInvoiceEditor(null);
    return null;
  }
  signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
  renderWithProviders(<Probe />);
  await waitFor(() => expect(service.getItem).toHaveBeenCalled());
  act(() =>
    editor.form.setValue('lines.0.description', 'My electrical item', { shouldDirty: true })
  );
  await act(async () =>
    answer({
      id: 'i-led',
      status: 'active',
      name: 'LED driver',
      sellingPrice: '900.00',
      unit: { code: 'PCS', allowDecimal: false },
      taxCode: 'GST5',
      hsnSac: '9405',
    })
  );
  expect(editor.form.getValues('lines.0.description')).toBe('My electrical item');
  expect(sales.createInvoice).not.toHaveBeenCalled();
});

it('seeds a new Home bill with default selling price without issuing it or changing the item', async () => {
  mockSearch = 'item=i-led';
  const service = jest.requireMock('../../inventory/api/itemService') as { getItem: jest.Mock };
  const item = {
    id: 'i-led',
    status: 'active',
    name: 'LED driver',
    sellingPrice: '900.00',
    unit: { code: 'PCS', allowDecimal: false },
    taxCode: 'GST5',
    hsnSac: '9405',
  };
  service.getItem.mockResolvedValueOnce(item);
  let editor!: UseInvoiceEditorResult;
  function Probe() {
    editor = useInvoiceEditor(null);
    return null;
  }
  signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
  renderWithProviders(<Probe />);
  await waitFor(() => expect(editor.form.getValues('lines.0.itemId')).toBe('i-led'));
  expect(editor.form.getValues('lines.0.unitPrice')).toBe('900.00');
  act(() => editor.form.setValue('lines.0.unitPrice', '850.00', { shouldDirty: true }));
  expect(item.sellingPrice).toBe('900.00');
  expect(sales.createInvoice).not.toHaveBeenCalled();
  expect(sales.issueInvoice).not.toHaveBeenCalled();
});

/* 07-screens/09 §3 — the bill editor at a busy counter. Each of these failed
   before the piece that made it pass: the search was a cell inside a line, so
   every item cost a tap on "Add item" first; a picked customer stayed a search
   field that said nothing about what they already owe in the Shop; and Issue
   stayed live with the network gone, failing only after the tap. */
// The focused control's id is its form path, `lines.<row>.<field>`.
const lineCellOf = (element: Element | null): { row?: string; col?: string } => {
  const [, row, col] = /^lines\.(\d+)\.(\w+)$/.exec(element?.id ?? '') ?? [];
  return { row, col };
};

const quickAdd = async (text: string): Promise<void> => {
  const search = await screen.findByRole('combobox', { name: 'Search items to add' });
  await userEvent.click(search);
  await userEvent.type(search, text);
};

/* An option drawn while the list still answers an earlier term is
   `aria-disabled` and a click on it is ignored on purpose (it may be the wrong
   item); wait for the list to answer the term typed. */
const answeredOption = (): Promise<HTMLElement> =>
  screen.findByRole('option', { name: /Syska LED bulb 9W/, selected: true }, { timeout: 8000 });

describe('the always-visible item search (07-screens/09 §3)', () => {
  const RIGHTS: PermissionCode[] = [
    'sales.invoice.read',
    'sales.invoice.write',
    'inventory.item.read',
  ];

  it('fills the empty first line from a pick and puts the caret on Qty, without "Add item" first', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(
      () => expect(lineCellOf(document.activeElement)).toEqual({ row: '0', col: 'qty' }),
      {
        timeout: 8000,
      }
    );
    expect(screen.getAllByText('Syska LED bulb 9W').length).toBeGreaterThan(0);
    // The search is empty again and ready for the next item.
    expect(screen.getByRole('combobox', { name: 'Search items to add' })).toHaveValue('');
  });

  it('appends a second line instead of overwriting the first', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() => expect(lineCellOf(document.activeElement).row).toBe('0'));
    await quickAdd('tube');
    // Enter picks once the list answers this term; before that it is a scan.
    await screen.findByRole(
      'option',
      { name: /Philips tube light/, selected: true },
      { timeout: 8000 }
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () => expect(lineCellOf(document.activeElement)).toEqual({ row: '1', col: 'qty' }),
      {
        timeout: 8000,
      }
    );
  });

  it('adds a scanned barcode on Enter even before any search answers, and stays ready for the next scan', async () => {
    /* A HID scanner types into whatever has focus: had the caret moved to Qty
       after a scan, the next code would have been typed into the quantity. */
    const items = jest.requireMock('../../inventory/api/itemService') as {
      lookupItemByBarcode: jest.Mock;
    };
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('8901234567890{Enter}');
    await waitFor(() => expect(items.lookupItemByBarcode).toHaveBeenCalledWith('8901234567890'));
    await waitFor(() => expect(screen.getAllByText('Syska LED bulb 9W').length).toBeGreaterThan(0));
    const search = screen.getByRole('combobox', { name: 'Search items to add' });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
  });

  it('says a scanned code matched nothing, and adds no line', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('0000000000000{Enter}');
    await waitFor(() => expect(store.getState().snackbar.id).toBe('items.scan.notFound'));
    expect(store.getState().snackbar.params).toEqual({ code: '0000000000000' });
    expect(document.getElementById('lines.1.qty')).toBeNull();
  });

  it('tells a member who cannot add items to ask the owner when nothing matches', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('ragi');
    expect(await screen.findByText(/Ask the owner to add it/)).toBeInTheDocument();
  });

  it('is not drawn for a member who cannot read items', async () => {
    signIn(['sales.invoice.read', 'sales.invoice.write']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await screen.findByTestId('invoice-issue');
    expect(screen.queryByRole('combobox', { name: 'Search items to add' })).not.toBeInTheDocument();
  });
});

describe('the picked customer (07-screens/09 §3)', () => {
  it('collapses to one line with what they owe in the Shop, and Change brings the search back', async () => {
    const parties = jest.requireMock('../../parties/api/partyService') as { getParty: jest.Mock };
    parties.getParty.mockResolvedValue({
      party: {
        id: 'p-ka',
        name: 'Bengaluru Traders',
        stateCode: '29',
        billingAddress: {},
        shop: { customerBalance: '3100.00' },
      },
      // The main (Udhaar) book's balance: never what a Shop bill shows (A3).
      summary: { balance: '-500.00' },
      credit: null,
    });
    signIn(['sales.invoice.read', 'sales.invoice.write', 'parties.party.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Saved customer' }));
    await userEvent.type(screen.getByLabelText('Saved customer'), 'Beng');
    // Pending choices intentionally refuse clicks; wait for this query's answer.
    await userEvent.click(
      await screen.findByRole('option', { name: /Bengaluru Traders/, selected: true })
    );
    const line = await screen.findByTestId('invoice-customer-line');
    expect(within(line).getByText('Bengaluru Traders')).toBeInTheDocument();
    await waitFor(() => expect(line).toHaveTextContent('₹3,100.00 to collect'));
    expect(line).not.toHaveTextContent('500.00');
    // DEC-019: the Shop's book, never the Udhaar book's balance.
    expect(parties.getParty).toHaveBeenCalledWith('p-ka', expect.anything(), 'shop');
    await userEvent.click(within(line).getByRole('button', { name: 'Change' }));
    expect(screen.queryByTestId('invoice-customer-line')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Saved customer')).toBeInTheDocument();
  });
});

describe('Issue with the network gone (07-screens/09 §3 offline)', () => {
  afterEach(() => {
    store.dispatch(responseObserved());
  });

  it('is disabled with the reason under it, and keeps what was typed', async () => {
    signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() => expect(screen.getByTestId('invoice-issue')).toBeEnabled());
    act(() => {
      store.dispatch(browserWentOffline());
    });
    expect(screen.getByTestId('invoice-issue')).toBeDisabled();
    expect(
      screen.getAllByText("No internet. Your bill is kept; issue it when you're back online.")
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Syska LED bulb 9W').length).toBeGreaterThan(0);
  });

  it("names the total in each finishing button's accessible name", async () => {
    signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() =>
      expect(screen.getByTestId('invoice-paid-cash')).toHaveAccessibleName(
        /^Paid cash, ₹4\d\d\.\d\d$/
      )
    );
    expect(screen.getByTestId('invoice-issue')).toHaveAccessibleName(
      /^UPI or other, ₹4\d\d\.\d\d$/
    );
  });
});

/* The counter's two commonest moments, each one tap shorter (07-screens/09 §3,
   rescore of 20 Oct): the same item scanned twice became two lines to read,
   and a cash Quick Sale opened a sheet only to confirm what it already said. */
describe('a busy counter (07-screens/09 §3)', () => {
  const RIGHTS: PermissionCode[] = [
    'sales.invoice.read',
    'sales.invoice.write',
    'inventory.item.read',
  ];

  it('sets the bill discount under More details and shows it read-only in the totals card', async () => {
    /* R-DEC-55: the design's totals card only reads the discount back.
       Prevents: the discount control vanishing with the old card, so a bill
       discount could no longer be given at all. */
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('8901234567890{Enter}');
    const totals = await screen.findByTestId('invoice-totals');
    expect(within(totals).queryByRole('textbox')).not.toBeInTheDocument();
    // Folded on a phone and a laptop; laid open where the details are not folded.
    const more = screen.queryByRole('button', { name: /More details/ });
    if (more && more.getAttribute('aria-expanded') !== 'true') await userEvent.click(more);
    const discount = await screen.findByRole('textbox', { name: 'Discount' });
    await userEvent.type(discount, '10');
    await waitFor(() => expect(within(totals).getByText('Discount')).toBeInTheDocument());
    expect(within(totals).getByText(/— ₹10\.00/)).toBeInTheDocument();
  });

  it('names the wrong field and puts the caret in it, instead of a general red banner', async () => {
    /* Design §A4, the owner's screenshot: "Please check the highlighted
       fields" with nothing highlighted. Prevents the message going back to
       saying "some fields" and leaving the cashier to hunt. */
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('8901234567890{Enter}');
    const qty = await waitFor(() => {
      const input = document.getElementById('lines.0.qty');
      if (!input) throw new Error('no line yet');
      return input as HTMLInputElement;
    });
    await userEvent.clear(qty);
    await userEvent.click(screen.getByTestId('invoice-paid-cash'));
    expect(await screen.findByText('Check line 1: Qty')).toBeInTheDocument();
    expect(qty).toHaveFocus();
    expect(screen.queryByText(/Some fields need fixing/)).not.toBeInTheDocument();
  });

  it('raises Qty when the same item is scanned again, instead of adding a line', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    const search = await screen.findByRole('combobox', { name: 'Search items to add' });
    await quickAdd('8901234567890{Enter}');
    await waitFor(() => expect(screen.getAllByText('Syska LED bulb 9W').length).toBeGreaterThan(0));
    // The scanner fires again straight into the search, which kept the focus.
    await userEvent.type(search, '8901234567890{Enter}');
    await waitFor(() => expect(document.getElementById('lines.0.qty')).toHaveValue('2'));
    expect(document.getElementById('lines.1.qty')).toBeNull();
    expect(search).toHaveFocus();
  });

  it('raises Qty of an item picked again from the list, with the caret on that Qty', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() =>
      expect(lineCellOf(document.activeElement)).toEqual({ row: '0', col: 'qty' })
    );
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() => expect(document.getElementById('lines.0.qty')).toHaveValue('2'));
    expect(document.getElementById('lines.1.qty')).toBeNull();
    await waitFor(() =>
      expect(lineCellOf(document.activeElement)).toEqual({ row: '0', col: 'qty' })
    );
  });

  it('keeps the list open for a name typed straight after a pick', async () => {
    /* The box's close-on-blur timer outlived a return to it: a quick second
       name was answered and then hidden 150 ms after the caret left. */
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    await waitFor(() =>
      expect(lineCellOf(document.activeElement)).toEqual({ row: '0', col: 'qty' })
    );
    const search = screen.getByRole('combobox', { name: 'Search items to add' });
    fireEvent.focus(search);
    fireEvent.blur(search);
    fireEvent.focus(search);
    await userEvent.type(search, 'tube');
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
    expect(search).toHaveAttribute('aria-expanded', 'true');
  });

  it('issues a cash Quick Sale in one tap, with the whole amount in cash and no sheet', async () => {
    const draft = jest.requireActual('../api/salesService').toEnvelope({
      data: wireDocument({ status: 'draft', number: null, version: 1 }),
      meta: {},
    });
    sales.createInvoice.mockResolvedValue(draft);
    sales.updateInvoice.mockResolvedValue(draft);
    sales.issueInvoice.mockResolvedValue(
      jest.requireActual('../api/salesService').toEnvelope({
        data: wireDocument({ status: 'issued', number: 'INV/26-27/1', version: 2 }),
        meta: {},
      })
    );
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    const cash = await screen.findByTestId('invoice-paid-cash');
    await waitFor(() => expect(cash).toBeEnabled());
    await userEvent.click(cash);
    await waitFor(() => expect(sales.issueInvoice).toHaveBeenCalled());
    const payload = JSON.stringify(sales.issueInvoice.mock.calls[0]);
    expect(payload).toContain('"cash"');
    expect(screen.queryByTestId('invoice-payment-confirm')).not.toBeInTheDocument();
  });

  it('says under the docked total how many items it counts and the GST in it', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: /max-width/.test(query),
    })) as typeof window.matchMedia;
    try {
      signIn(RIGHTS);
      renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
      await quickAdd('8901234567890{Enter}');
      const caption = await screen.findByTestId('total-dock-caption');
      // ₹450 at 5% GST, excluded from the rate: ₹22.50 of GST in ₹472.50.
      await waitFor(() => expect(caption).toHaveTextContent('1 item · includes GST ₹22.50'));
      // The same item again is one line of two: the count is of lines.
      await quickAdd('8901234567890{Enter}');
      await waitFor(() => expect(caption).toHaveTextContent('1 item · includes GST ₹45.00'));
      await quickAdd('tube');
      await userEvent.click(
        await screen.findByRole(
          'option',
          { name: /Philips tube light/, selected: true },
          { timeout: 8000 }
        )
      );
      await waitFor(() => expect(caption).toHaveTextContent('2 items · includes GST ₹67.50'));
    } finally {
      window.matchMedia = original;
    }
  });

  it('still opens the payment sheet from "UPI or other"', async () => {
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    const other = screen.getByTestId('invoice-issue');
    await waitFor(() => expect(other).toBeEnabled());
    await userEvent.click(other);
    expect(await screen.findByTestId('invoice-payment-confirm')).toBeInTheDocument();
  });

  it('offers no Paid cash on a saved customer, whose bill may go on credit', async () => {
    signIn([...RIGHTS, 'parties.party.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Saved customer' }));
    expect(screen.queryByTestId('invoice-paid-cash')).not.toBeInTheDocument();
    expect(screen.getByTestId('invoice-issue')).toHaveTextContent('Issue');
  });
});

/* Counter Mode step 9 — nothing matches: the archived look-alike is offered
   first, so "ragi" does not become a second Ragi flour, then Create, and the
   item made or restored lands on the bill without starting over. */
describe('an item that is not in the list', () => {
  const OWNER: PermissionCode[] = [
    'sales.invoice.read',
    'sales.invoice.write',
    'inventory.item.read',
    'inventory.item.write',
  ];

  it('offers to restore an archived look-alike, and bills it once restored', async () => {
    const items = jest.requireMock('../../inventory/api/itemService') as { restoreItem: jest.Mock };
    signIn(OWNER);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('ragi');
    const restore = await screen.findByRole(
      'option',
      { name: /Restore Ragi flour 1 kg/ },
      { timeout: 8000 }
    );
    expect(screen.getByRole('option', { name: 'Create “ragi” as a new item' })).toBeInTheDocument();
    await userEvent.click(restore);
    await waitFor(() => expect(items.restoreItem).toHaveBeenCalledWith('i-ragi'));
    await waitFor(() => expect(screen.getAllByText('Ragi flour 1 kg').length).toBeGreaterThan(0));
  });

  it('opens a new item with the typed name, and bills it once saved', async () => {
    signIn(OWNER);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('ragi');
    await userEvent.click(
      await screen.findByRole('option', { name: 'Create “ragi” as a new item' }, { timeout: 8000 })
    );
    await waitFor(() => expect(store.getState().itemForm?.openFor).toBe('new'));
    expect(store.getState().itemForm?.prefillName).toBe('ragi');
    act(() => {
      store.dispatch({
        type: 'itemForm/saveItem/fulfilled',
        payload: { item: { id: 'i-new', sku: 'NEW-1', name: 'ragi' }, warnings: [] },
      });
    });
    await waitFor(() =>
      expect(lineCellOf(document.activeElement)).toEqual({ row: '0', col: 'qty' })
    );
  });

  it('does not offer Create or Restore to a member who cannot add items', async () => {
    signIn(OWNER.filter((code) => code !== 'inventory.item.write'));
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('ragi');
    expect(await screen.findByText(/Ask the owner to add it/)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Restore/ })).not.toBeInTheDocument();
  });
});

describe('a rate changed on the bill (Counter Mode step 9)', () => {
  it('says the change is for this bill only, and that the usual price stays', async () => {
    /* Item defaults and bill prices are separate; a cashier who typed ₹400
       had no way to know whether the item's price had changed with it. */
    signIn(['sales.invoice.read', 'sales.invoice.write', 'inventory.item.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    // Rate is edited in the line's details, opened under the row (design §A4 dLine).
    await userEvent.click(await screen.findByRole('button', { name: /^Edit / }));
    const rate = await waitFor(() => {
      const input = document.getElementById('lines.0.unitPrice') as HTMLInputElement | null;
      if (!input) throw new Error('no rate cell yet');
      return input;
    });
    expect(screen.queryByTestId('line-rate-changed')).not.toBeInTheDocument();
    await userEvent.clear(rate);
    await userEvent.type(rate, '400');
    expect(await screen.findByTestId('line-rate-changed')).toHaveTextContent(
      'For this bill only. The usual price stays ₹450.00.'
    );
    await userEvent.clear(rate);
    await userEvent.type(rate, '450');
    await waitFor(() => expect(screen.queryByTestId('line-rate-changed')).not.toBeInTheDocument());
  });
});

/* Counter Mode / myBillBook "Hold & create another": a second customer comes
   while the first is still choosing. The first bill is kept as a draft (it
   already autosaves) and a blank one opens; held bills sit above the editor,
   one tap from being picked up again. */
describe('holding a bill (Counter Mode, hold and resume)', () => {
  const RIGHTS: PermissionCode[] = [
    'sales.invoice.read',
    'sales.invoice.write',
    'inventory.item.read',
  ];
  const heldRow = {
    id: 'held-1',
    kind: 'invoice',
    number: null,
    status: 'draft',
    party: { id: 'p-ka', name: 'Bengaluru Traders' },
    walkInName: null,
    walkInMobileMasked: null,
    documentDate: '2026-10-20',
    dueOn: null,
    validUntil: null,
    grandTotal: '1062.00',
    amountPaid: '0.00',
    amountDue: '1062.00',
    isOverdue: false,
    voidReason: null,
    createdBy: null,
    updatedAt: '2026-10-20T06:12:00Z',
  };
  const page = (rows: unknown[]) => ({
    rows,
    page: 1,
    pageSize: 25,
    total: rows.length,
    totals: { count: rows.length, grandTotal: '0.00', amountDue: '0.00' },
    tabs: null,
  });

  it('shows the bills on hold above the editor, each one tap from being picked up', async () => {
    (sales as unknown as { listInvoices: jest.Mock }).listInvoices.mockResolvedValue(
      page([heldRow])
    );
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    const held = await screen.findByTestId('invoice-held');
    expect(held).toHaveTextContent('On hold · 1');
    const resume = within(held).getByRole('link', { name: /Bengaluru Traders.*₹1,062\.00/ });
    expect(resume).toHaveAttribute('href', '/sales/invoices/held-1/edit');
    // Three held Quick Sales of one amount must still be told apart: each says
    // when it was last touched, on this device's clock like every other time.
    expect(resume).toHaveTextContent(formatClock('2026-10-20T06:12:00Z'));
    // One quiet row that scrolls sideways, never three rows of a phone screen.
    expect(within(held).getByTestId('invoice-held-chips').className).toContain('overflow-x-auto');
    expect((sales as unknown as { listInvoices: jest.Mock }).listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'draft' }),
      expect.anything()
    );
  });

  it('keeps this bill on hold and opens a blank one', async () => {
    const list = (sales as unknown as { listInvoices: jest.Mock }).listInvoices;
    list.mockResolvedValue(page([]));
    const draft = jest.requireActual('../api/salesService').toEnvelope({
      data: wireDocument({ status: 'draft', number: null, version: 1 }),
      meta: {},
    });
    sales.createInvoice.mockResolvedValue(draft);
    sales.updateInvoice.mockResolvedValue(draft);
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await quickAdd('led');
    await userEvent.click(await answeredOption());
    const hold = screen.getByTestId('invoice-hold');
    await waitFor(() => expect(hold).toBeEnabled());
    list.mockResolvedValue(page([heldRow]));
    await userEvent.click(hold);
    await waitFor(() =>
      expect(
        sales.createInvoice.mock.calls.length + sales.updateInvoice.mock.calls.length
      ).toBeGreaterThan(0)
    );
    // A blank bill: no line carries the item any more.
    await waitFor(() => expect(screen.queryAllByText('Syska LED bulb 9W')).toHaveLength(0));
    expect(await screen.findByTestId('invoice-held')).toHaveTextContent('On hold · 1');
    expect(store.getState().snackbar.id).toBe('sales.hold.done');
  });

  it('cannot hold an empty bill', async () => {
    (sales as unknown as { listInvoices: jest.Mock }).listInvoices.mockResolvedValue(page([]));
    signIn(RIGHTS);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    expect(await screen.findByTestId('invoice-hold')).toBeDisabled();
  });
});

/* Counter Mode find-or-start: a customer who is not in the book yet is added
   from the search itself, with the name already typed, and lands on the bill. */
describe('a customer who is not saved yet', () => {
  const parties = () =>
    jest.requireMock('../../parties/api/partyService') as { listParties: jest.Mock };
  // The book has nobody by the name typed.
  const noneFor = () => () =>
    Promise.resolve({
      rows: [],
      meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      totals: null,
    });

  it('offers "Add" with the typed name and puts the saved customer on the bill', async () => {
    parties().listParties.mockImplementation(noneFor());
    signIn([
      'sales.invoice.read',
      'sales.invoice.write',
      'parties.party.read',
      'parties.party.write',
    ]);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Saved customer' }));
    await userEvent.type(screen.getByLabelText('Saved customer'), 'Ramesh Electricals');
    const add = await screen.findByRole(
      'button',
      { name: 'Add “Ramesh Electricals” as a new customer' },
      { timeout: 8000 }
    );
    await userEvent.click(add);
    await waitFor(() => expect(store.getState().partyForm.openFor).toBe('new'));
    expect(store.getState().partyForm.prefillName).toBe('Ramesh Electricals');
    act(() => {
      store.dispatch({
        type: 'partyForm/save/fulfilled',
        payload: {
          party: { id: 'p-new', name: 'Ramesh Electricals', stateCode: '27', billingAddress: {} },
          warnings: [],
        },
      });
    });
    const line = await screen.findByTestId('invoice-customer-line');
    expect(line).toHaveTextContent('Ramesh Electricals');
  });

  it('does not offer Add to a member who cannot add contacts', async () => {
    parties().listParties.mockImplementation(noneFor());
    signIn(['sales.invoice.read', 'sales.invoice.write', 'parties.party.read']);
    renderWithProviders(<InvoiceEditorPageContent documentId={null} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Saved customer' }));
    await userEvent.type(screen.getByLabelText('Saved customer'), 'Ramesh');
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 600)));
    expect(screen.queryByRole('button', { name: /as a new customer/ })).not.toBeInTheDocument();
  });
});
