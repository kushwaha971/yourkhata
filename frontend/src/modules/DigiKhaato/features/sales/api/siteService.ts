import { api, ubConfig } from 'src/api/AxiosInstances';

/** G7 — a contractor's sites (design `pSite`, `dSite`). */
export interface ContractorSite {
  readonly id: string;
  readonly name: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile: string | null };
  readonly bills: number;
  readonly last_bill: string | null;
  readonly due: string;
  readonly days_late: number;
  readonly credit_limit: string | null;
}

export interface SiteList {
  readonly sites: readonly ContractorSite[];
  readonly to_collect: string;
  readonly open: number;
}

export interface SiteBill {
  readonly id: string;
  readonly number: string;
  readonly date: string;
  readonly total: string;
  readonly due: string;
  readonly status: string;
}

export interface SiteDetail extends ContractorSite {
  readonly bill_rows: readonly SiteBill[];
}

export const listSites = async (
  params: { readonly q?: string; readonly party?: string },
  signal?: AbortSignal
): Promise<SiteList> =>
  (await api.get<{ data: SiteList }>('/sales/sites', ubConfig({ signal, params }))).data.data;

export const getSite = async (id: string, signal?: AbortSignal): Promise<SiteDetail> =>
  (await api.get<{ data: SiteDetail }>(`/sales/sites/${id}`, ubConfig({ signal }))).data.data;

export const createSite = async (
  body: { readonly party_id: string; readonly name: string },
  clientKey: string
): Promise<ContractorSite> =>
  (await api.post<{ data: ContractorSite }>('/sales/sites', { ...body, client_key: clientKey })).data.data;

/** `key` is made once per set of amounts, so a double tap is one payment. */
export const paySites = async (
  body: { readonly mode: string; readonly splits: readonly { site_id: string; amount: string }[] },
  key: string
): Promise<void> => {
  await api.post('/sales/sites/payment', body, ubConfig({ headers: { 'Idempotency-Key': key } }));
};
