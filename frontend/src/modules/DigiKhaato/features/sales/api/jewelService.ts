import { api, ubConfig } from 'src/api/AxiosInstances';

/** Finishing jewellery: Home's strip and the old-gold stock page. */
export interface JewelHome {
  readonly gold_22k: string | null;
  readonly silver: string | null;
  readonly orders_due: number;
  readonly orders_with_karigar: number;
  readonly old_gold_month_g: string;
}

export const getJewelHome = async (signal?: AbortSignal): Promise<JewelHome> => {
  const res = await api.get<{ data: JewelHome }>(
    '/sales/jewel-home',
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return res.data.data;
};

export interface OldGoldRow {
  readonly id: string;
  readonly taken_on: string;
  readonly customer: string | null;
  readonly bill_id: string;
  readonly bill_number: string | null;
  readonly purity: string;
  readonly weight_g: string;
  readonly less_pct: string;
  readonly cash_back?: boolean;
  readonly value: string;
}

export interface OldGoldPage {
  readonly stock: readonly { purity: string; weight_g: string; value: string }[];
  readonly rows: readonly OldGoldRow[];
}

export const getOldGold = async (signal?: AbortSignal): Promise<OldGoldPage> => {
  const res = await api.get<{ data: OldGoldPage }>(
    '/sales/old-gold',
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return res.data.data;
};
