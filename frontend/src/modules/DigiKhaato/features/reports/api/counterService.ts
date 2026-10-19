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
export interface CounterData {
  repeat?: readonly RepeatSource[];
  as_of: string;
  customers?: CounterLane;
  suppliers?: CounterLane;
}
export async function getCounter(signal: AbortSignal): Promise<CounterData> {
  return (await api.get<{ data: CounterData }>('/reports/dashboard/counter', ubConfig({ signal })))
    .data.data;
}
