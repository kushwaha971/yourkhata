import { api, ubConfig } from 'src/api/AxiosInstances';

import type { ExpenseFormValues } from '../../expenses/types/expense.types';
export interface CounterPerson {
  id: string;
  name: string;
  amount: string;
  due_on: string | null;
  days_late: number;
  mobile: string | null;
  mobile_masked: string | null;
}
export interface CounterLane {
  total: string;
  count: number;
  bands: readonly { key: string; amount: string }[];
  people: readonly CounterPerson[];
}
export interface RepeatSource {
  kind: 'sale' | 'purchase' | 'expense';
  id: string;
  name: string;
  date: string;
  amount: string;
  uses: number;
  expense?: Omit<ExpenseFormValues, 'expenseDate'>;
}
export interface CounterDocumentFact {
  readonly kind: string;
  readonly status: string;
  readonly amount_due: string;
  readonly item_count: number;
}
export interface CounterData {
  documents?: Readonly<Record<string, CounterDocumentFact>>;
  repeat?: readonly RepeatSource[];
  as_of: string;
  customers?: CounterLane;
  suppliers?: CounterLane;
}
export async function getCounter(signal: AbortSignal, documents: readonly string[] = []): Promise<CounterData> {
  const query = new URLSearchParams();
  if (documents.length) query.set('documents', documents.join(','));
  const suffix = query.size ? `?${query}` : '';
  return (await api.get<{ data: CounterData }>(`/reports/dashboard/counter${suffix}`, ubConfig({ signal }))).data.data;
}
