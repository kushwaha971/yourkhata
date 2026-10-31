import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbDialog } from 'src/design-system';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { makeDocument } from '../testing/salesFixtures';

import { InvoiceDetailPageContent } from './InvoiceDetailPageContent';

import type { PaymentContext } from '../../payments/types/payment.types';

let mockPaymentContext: PaymentContext | undefined;
let mockDocument = makeDocument({
  id: 'invoice1',
  status: 'issued',
  amount_due: '100.00',
  amount_paid: '0.00',
  party: { id: 'p1', name: 'Radhe Krishna Enterprises' },
});

beforeEach(() => {
  mockDocument = makeDocument({
    id: 'invoice1',
    status: 'issued',
    amount_due: '100.00',
    amount_paid: '0.00',
    party: { id: 'p1', name: 'Radhe Krishna Enterprises' },
  });
});

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasModule: () => true,
    can: (code: string) => ['sales.invoice.read', 'payments.payment.write'].includes(code),
  }),
}));
jest.mock('../hooks/useInvoiceDetail', () => ({
  useInvoiceDetail: () => ({
    status: 'succeeded',
    document: mockDocument,
    reload: jest.fn(),
    print: jest.fn(),
    share: jest.fn(),
    sharing: false,
    shareLink: null,
  }),
}));
jest.mock('./DocumentActions', () => ({ DocumentActions: () => null }));
jest.mock('./DocumentLinksPanel', () => ({ DocumentLinksPanel: () => null }));
jest.mock('./print/InvoicePrintSheet', () => ({ InvoicePrintSheet: () => null }));
jest.mock('../../payments/components/PaymentFormDrawer', () => ({
  PaymentFormDrawer: ({ context }: Readonly<{ context: PaymentContext }>) => {
    mockPaymentContext = context;
    return (
      <UbDialog
        open
        onOpenChange={jest.fn()}
        title="Record payment form"
        closeLabel="Close payment"
      />
    );
  },
}));

it('B37 keeps the visible phone payment form owned by the page', async () => {
  // The detail now exposes Receive directly; its lazy drawer still belongs to the page.
  const user = userEvent.setup();
  renderWithProviders(<InvoiceDetailPageContent id="invoice1" />);
  await user.click(screen.getByRole('button', { name: 'Receive money' }));
  expect(await screen.findByRole('dialog', { name: 'Record payment form' })).toBeVisible();
  expect(mockPaymentContext).toMatchObject({
    bucket: 'shop',
    tradeRole: 'customer',
    documentId: 'invoice1',
    documentDue: '100.00',
  });
});

it('Counter detail makes summary and item lines readable without the paper canvas', () => {
  // Defect: the phone had only a sentence and an A4 sideways-scrolling sheet.
  renderWithProviders(<InvoiceDetailPageContent id="invoice1" />);
  expect(screen.getByRole('definition', { name: 'Balance due' })).toHaveTextContent('₹100.00');
  expect(screen.getByRole('table', { name: 'Items on this bill' })).toBeInTheDocument();
});

it('Counter detail keeps drafts from customer print and sharing actions', () => {
  // Defect: drafts exposed both customer print buttons next to Edit.
  mockDocument = { ...mockDocument, status: 'draft' };
  renderWithProviders(<InvoiceDetailPageContent id="invoice1" />);
  expect(screen.queryByTestId('print-a4-action')).not.toBeInTheDocument();
  expect(screen.queryByTestId('print-thermal-action')).not.toBeInTheDocument();
});

it('changing the bill closes the previous bill payment context', async () => {
  // Defect: a page-owned drawer survived a same-route bill-id change and could pay the old bill.
  const user = userEvent.setup();
  const view = renderWithProviders(<InvoiceDetailPageContent id="invoice1" />);
  await user.click(screen.getByRole('button', { name: 'Receive money' }));
  expect(await screen.findByRole('dialog', { name: 'Record payment form' })).toBeVisible();
  mockDocument = { ...mockDocument, id: 'invoice2' };
  view.rerender(<InvoiceDetailPageContent id="invoice2" />);
  expect(screen.queryByRole('dialog', { name: 'Record payment form' })).not.toBeInTheDocument();
});
