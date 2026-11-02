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
}

export interface KarigarList {
  readonly rows: readonly Karigar[];
  readonly open_lots: readonly KarigarLot[];
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
