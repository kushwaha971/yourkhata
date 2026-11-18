import { api, ubConfig } from 'src/api/AxiosInstances';

import type { SchemeRule } from '../view-model/schemes';

/** G9 — company schemes (design `dSchemes`). */
export interface SchemeRow extends SchemeRule {
  readonly id: string;
  readonly company: string;
  readonly item: { readonly id: string; readonly name: string; readonly unit: string } | null;
  readonly valid_from: string;
  readonly valid_till: string;
  readonly active: boolean;
  readonly status: 'running' | 'waiting' | 'ended' | 'stopped';
  readonly free_given: string;
  readonly off_given: string;
  readonly claim: string;
}

export interface SchemeList {
  readonly schemes: readonly SchemeRow[];
  readonly claims: readonly { readonly company: string; readonly claim: string }[];
}

export interface NewScheme {
  readonly client_key: string;
  readonly code: string;
  readonly company: string;
  readonly rule: SchemeRule['rule'];
  readonly item_id: string | null;
  readonly buy_qty?: string;
  readonly free_qty?: string;
  readonly amount?: string;
  readonly min_bill?: string;
  readonly valid_from: string;
  readonly valid_till: string;
}

export const listSchemes = async (q: string, signal?: AbortSignal): Promise<SchemeList> =>
  (await api.get<{ data: SchemeList }>('/sales/schemes', ubConfig({ signal, params: { q } }))).data.data;

export const runningSchemes = async (on: string, signal?: AbortSignal): Promise<readonly SchemeRow[]> =>
  (
    await api.get<{ data: SchemeRow[] }>(
      '/sales/schemes/running',
      ubConfig({ signal, params: { on }, suppressErrorSnackbar: true })
    )
  ).data.data;

export const createScheme = async (body: NewScheme): Promise<SchemeRow> =>
  (await api.post<{ data: SchemeRow }>('/sales/schemes', body, ubConfig({ suppressErrorSnackbar: true }))).data.data;

export const setSchemeActive = async (id: string, active: boolean): Promise<SchemeRow> =>
  (await api.patch<{ data: SchemeRow }>(`/sales/schemes/${id}`, { active })).data.data;
