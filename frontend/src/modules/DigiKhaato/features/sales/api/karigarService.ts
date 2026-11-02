import { api, ubConfig } from 'src/api/AxiosInstances';

/** G3b — karigars: gold weighed out and weighed back (design G3). */
export interface Karigar {
  readonly id: string;
  readonly name: string;
  readonly wastage_limit_pct: string;
  readonly issued_g: string;
  readonly received_g: string;
  readonly with_g: string;
  readonly wastage_pct: string | null;
  readonly over_limit: boolean;
}

export interface KarigarLot {
  readonly id: string;
  readonly karigar: { readonly id: string; readonly name: string };
  readonly order_number: string | null;
  readonly purity: string;
  readonly issued_g: string;
  readonly issued_on: string;
  readonly received_g: string | null;
  /** G3c — what has been tagged from this lot so far. */
  readonly tagged_g: string;
  readonly tag_count: number;
  readonly last_item_id: string | null;
}

export interface KarigarList {
  readonly rows: readonly Karigar[];
  readonly open_lots: readonly KarigarLot[];
  readonly to_tag: readonly KarigarLot[];
  readonly gold_with_karigars: string;
}

export const listKarigars = async (signal?: AbortSignal): Promise<KarigarList> => {
  const res = await api.get<{ data: KarigarList }>(
    '/sales/karigars',
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return res.data.data;
};

export const addKarigar = async (name: string, wastageLimitPct: string): Promise<Karigar> => {
  const res = await api.post<{ data: Karigar }>('/sales/karigars', {
    name,
    wastage_limit_pct: wastageLimitPct,
  });
  return res.data.data;
};

export const issueGold = async (
  karigarId: string,
  body: { weight_g: string; purity: string; order_id: string | null; client_key: string }
): Promise<KarigarLot> => {
  const res = await api.post<{ data: KarigarLot }>(`/sales/karigars/${karigarId}/issue`, body);
  return res.data.data;
};

export const receiveGold = async (lotId: string, receivedG: string): Promise<KarigarLot> => {
  const res = await api.post<{ data: KarigarLot }>(`/sales/karigar-lots/${lotId}/receive`, {
    received_g: receivedG,
  });
  return res.data.data;
};

/** G3c — one piece from gold received back; `tag` is `toTagBody`'s shape. */
export const makeLotTag = async (
  lotId: string,
  body: { item_id: string; labour_per_g: string; tag: Record<string, string> }
): Promise<void> => {
  await api.post(`/sales/karigar-lots/${lotId}/tags`, body);
};

export const finishLotTags = async (lotId: string): Promise<void> => {
  await api.post(`/sales/karigar-lots/${lotId}/tags-done`, {});
};

/** A mistyped weight or purity; the server keeps the old figures in the audit log. */
export const correctLot = async (
  lotId: string,
  body: { issued_g: string; purity: string; received_g?: string }
): Promise<void> => {
  await api.patch(`/sales/karigar-lots/${lotId}`, body);
};

export const removeLot = async (lotId: string): Promise<void> => {
  await api.delete(`/sales/karigar-lots/${lotId}`);
};

export const updateKarigar = async (
  id: string,
  body: { name: string; wastage_limit_pct: string }
): Promise<void> => {
  await api.patch(`/sales/karigars/${id}`, body);
};
