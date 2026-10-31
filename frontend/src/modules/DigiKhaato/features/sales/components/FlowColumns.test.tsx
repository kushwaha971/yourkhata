import { render, screen } from '@testing-library/react';

import type { TranslateFn } from 'src/hooks/useTranslation';

import { createFlowColumns } from './FlowColumns';

import type { InvoiceListRow } from '../types/sales.types';
const t = ((key: string) => key) as TranslateFn;
it('does not call an unbilled delivery an open credit', () => {
  /** Business display defect: the challan fell into the credit-note column branch. Goods out is not a customer credit. */
  expect(
    createFlowColumns({ t, kind: 'delivery_challan', isCards: false }).map((c) => c.id)
  ).not.toContain('open');
  expect(createFlowColumns({ t, kind: 'credit_note', isCards: false }).map((c) => c.id)).toContain(
    'open'
  );
});

it('retains the document date with its identity on compact desktop tables', () => {
  /** At1024 the separate date column clipped dates; joining identity must retain the fact. */
  const columns = createFlowColumns({ t, kind: 'estimate', isCards: false, isCompact: true });
  expect(columns.map((column) => column.id)).not.toContain('date');
  const identity = columns.find((column) => column.id === 'party');
  if (!identity) throw new Error('Missing identity');
  render(
    <>
      {identity.cell({
        party: { id: 'p1', name: 'Radhe Krishna Enterprises' },
        number: 'EST-42',
        documentDate: '2026-10-21',
      } as InvoiceListRow)}
    </>
  );
  expect(screen.getByText(/21\/10\/2026/)).toBeInTheDocument();
});
