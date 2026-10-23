import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';

import { resetAllFeatureState } from 'src/redux/actions';
import { store } from 'src/redux/store';

import { flowFiltersChanged } from '../redux/salesDocListSlice';
import { fetchFlowDocuments, type FlowListArg } from '../redux/salesFlowThunk';

import { useSalesFlowList } from './useSalesFlowList';

import type { InvoiceListRow } from '../types/sales.types';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));
jest.mock('src/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, hasModule: () => true }),
}));
jest.mock('../api/estimateService', () => ({
  listFlowDocuments: () => new Promise(() => undefined),
}));
it('does not paint the previous document kind before the fetch effect resets it', () => {
  /** Source defect: a shared slice briefly returned quote rows as orders on the first render. */
  store.dispatch(resetAllFeatureState());
  const query: FlowListArg = {
    kind: 'estimate',
    tab: 'all',
    dateFrom: '2026-04-01',
    dateTo: '2027-03-31',
    partyId: null,
    q: '',
    page: 1,
  };
  store.dispatch(flowFiltersChanged(query));
  store.dispatch(fetchFlowDocuments.pending('old', query));
  store.dispatch(
    fetchFlowDocuments.fulfilled(
      {
        rows: [{ id: 'old-quote' } as InvoiceListRow],
        page: 1,
        pageSize: 25,
        total: 1,
        hasAny: true,
        totals: { count: 1, grandTotal: '500.00', amountDue: '0.00' },
        tabs: { all: 1 },
      },
      'old',
      query
    )
  );
  let first: readonly InvoiceListRow[] | undefined;
  const view = renderHook(
    () => {
      const result = useSalesFlowList('sales_order');
      if (first === undefined) first = result.rows;
      return result;
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    }
  );
  expect(first).toEqual([]);
  view.unmount();
  store.dispatch(resetAllFeatureState());
});
