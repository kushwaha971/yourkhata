import { screen } from '@testing-library/react';

import { useTranslation } from 'src/hooks/useTranslation';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { RecentActivityList } from './DashboardLists';

import type { CounterData } from '../api/counterService';
import type { ActivityItem } from '../types/reports.types';

const items: ActivityItem[] = [{ id: 'sale:doc1', type: 'sale', at: '2026-10-20T05:00:00Z', number: 'INV/1', amount: '100.00', direction: null, party: { id: 'p1', name: 'Radhe Krishna Enterprises' }, source: { kind: 'sales_document', id: 'doc1', partyId: 'p1' } }];
function Host({ documents, events = items }: Readonly<{ documents?: CounterData['documents']; events?: readonly ActivityItem[] }>) {
  const { t } = useTranslation();
  return <RecentActivityList counter items={events} documentFacts={documents} t={t} />;
}

it('shows the current source status and bill-line count in the register', () => {
  // Defect: the reference's status/items were absent despite actual source documents.
  renderWithProviders(<Host documents={{ 'sales_document:doc1': { kind: 'invoice', status: 'paid', amount_due: '0.00', item_count: 2 } }} />);
  expect(screen.getByText('Paid')).toBeInTheDocument();
  expect(screen.getByText(/2 items/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /INV\/1/ })).toBeInTheDocument();
});

it('does not fabricate Paid or zero items while metadata is unavailable', () => {
  // A failed/pending read is unknown, not a paid bill or an empty bill.
  renderWithProviders(<Host />);
  expect(screen.queryByText('Paid')).not.toBeInTheDocument();
  expect(screen.queryByText(/0 items/)).not.toBeInTheDocument();
});

it('never calls an issued credit note unpaid', () => {
  // Credit-note availability and customer debt must not share a financial label.
  renderWithProviders(<Host documents={{ 'sales_document:doc1': { kind: 'credit_note', status: 'issued', amount_due: '100.00', item_count: 1 } }} />);
  expect(screen.getByText('Issued')).toBeInTheDocument();
  expect(screen.queryByText('Not paid')).not.toBeInTheDocument();
  expect(screen.getByText(/1 item/)).toBeInTheDocument();
});

it('hides an unknown status instead of showing a raw translation key', () => {
  // Forward-compatible metadata must not print an internal state or inherited object key.
  renderWithProviders(<Host documents={{ 'sales_document:doc1': { kind: 'invoice', status: '__proto__', amount_due: '100.00', item_count: 1 } }} />);
  expect(screen.queryByText(/counterRegister\.status/)).not.toBeInTheDocument();
});

it('does not repeat Cancelled beside a cancellation event already named as such', () => {
  // The event title already identifies cancellation; its badge would repeat that word.
  renderWithProviders(<Host events={[{ ...(items[0] as ActivityItem), type: 'sale_void' }]} documents={{ 'sales_document:doc1': { kind: 'invoice', status: 'void', amount_due: '0.00', item_count: 1 } }} />);
  expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
});
