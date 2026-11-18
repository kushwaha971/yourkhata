import { api, ubConfig } from 'src/api/AxiosInstances';

/** G5 — a mobile shop's repair jobs (design G5 `pRepair`, `dRepairs`). */
export type RepairStage = 'open' | 'waiting' | 'ready' | 'delivered' | 'cancelled';
export type RepairListStage = 'open' | 'waiting' | 'ready' | 'delivered';
export const CAME_WITH = ['phone', 'back_cover', 'charger', 'sim', 'memory_card'] as const;
export type CameWith = (typeof CAME_WITH)[number];

export interface RepairJob {
  readonly id: string;
  readonly number: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile: string | null } | null;
  readonly walkInName: string | null;
  readonly walkInMobile: string | null;
  readonly phoneModel: string;
  readonly imei: string | null;
  readonly fault: string;
  readonly cameWith: readonly CameWith[];
  readonly estimate: string;
  readonly readyBy: string;
  readonly daysLate: number;
  readonly advance: string;
  readonly lockNote: string | null;
  readonly status: RepairStage;
  readonly invoiceId: string | null;
}

interface Wire {
  id: string;
  number: string;
  party: RepairJob['party'];
  walk_in_name: string | null;
  walk_in_mobile: string | null;
  phone_model: string;
  imei: string | null;
  fault: string;
  came_with: CameWith[];
  estimate: string;
  ready_by: string;
  days_late: number;
  advance: string;
  lock_note: string | null;
  status: RepairStage;
  invoice_id: string | null;
}

const toJob = (w: Wire): RepairJob => ({
  id: w.id,
  number: w.number,
  party: w.party,
  walkInName: w.walk_in_name,
  walkInMobile: w.walk_in_mobile,
  phoneModel: w.phone_model,
  imei: w.imei,
  fault: w.fault,
  cameWith: w.came_with ?? [],
  estimate: w.estimate,
  readyBy: w.ready_by,
  daysLate: w.days_late ?? 0,
  advance: w.advance,
  lockNote: w.lock_note,
  status: w.status,
  invoiceId: w.invoice_id,
});

export interface RepairList {
  readonly rows: readonly RepairJob[];
  readonly counts: { readonly open: number; readonly waiting: number; readonly ready: number };
}

export const listRepairs = async (
  filters: { readonly q: string; readonly stage: RepairListStage },
  signal?: AbortSignal
): Promise<RepairList> => {
  const res = await api.get<{ data: Wire[]; meta: { counts: RepairList['counts'] } }>(
    '/sales/repairs',
    ubConfig({ params: { q: filters.q || undefined, stage: filters.stage }, signal, suppressErrorSnackbar: true })
  );
  return { rows: res.data.data.map(toJob), counts: res.data.meta.counts };
};

export const getRepair = async (id: string, signal?: AbortSignal): Promise<RepairJob> => {
  const res = await api.get<{ data: Wire }>(
    `/sales/repairs/${id}`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return toJob(res.data.data);
};

export interface RepairFormValues {
  partyId: string;
  partyName: string;
  walkInMobile: string;
  phoneModel: string;
  imei: string;
  fault: string;
  cameWith: CameWith[];
  estimate: string;
  readyBy: string;
  advance: string;
  advanceMode: string;
  lockNote: string;
}

/** `clientKey` is made once per open form, so a double tap is one job. */
export const createRepair = async (v: RepairFormValues, clientKey: string): Promise<RepairJob> => {
  const res = await api.post<{ data: Wire }>('/sales/repairs', {
    client_key: clientKey,
    party_id: v.partyId || null,
    walk_in_mobile: v.partyId ? '' : v.walkInMobile,
    phone_model: v.phoneModel,
    imei: v.imei,
    fault: v.fault,
    came_with: v.cameWith,
    estimate: v.estimate || '0',
    ready_by: v.readyBy,
    advance: v.advance || '0',
    advance_mode: v.advanceMode,
    lock_note: v.lockNote,
  });
  return toJob(res.data.data);
};

export const moveRepair = async (id: string, status: RepairStage): Promise<RepairJob> => {
  const res = await api.post<{ data: Wire }>(`/sales/repairs/${id}/stage`, { status });
  return toJob(res.data.data);
};

/** Server field → form field, for errors under their boxes. */
export const REPAIR_FIELD: Readonly<Record<string, keyof RepairFormValues>> = {
  party_id: 'partyId',
  walk_in_mobile: 'walkInMobile',
  phone_model: 'phoneModel',
  imei: 'imei',
  fault: 'fault',
  estimate: 'estimate',
  ready_by: 'readyBy',
  advance: 'advance',
  advance_mode: 'advanceMode',
  lock_note: 'lockNote',
};
