import { api, ubConfig } from 'src/api/AxiosInstances';

import type { Purity } from './metalRateService';

/** G2a — a jeweller's tag: one piece, priced by its weight (design D3/D5). */
export interface TagFormValues {
  tagNo: string;
  purity: Purity;
  grossG: string;
  stoneG: string;
  netG: string;
  makingType: 'pct' | 'per_g';
  makingValue: string;
  wastagePct: string;
  huid: string;
}

export const EMPTY_TAG: TagFormValues = {
  tagNo: '',
  purity: 'gold_22k',
  grossG: '',
  stoneG: '',
  netG: '',
  makingType: 'pct',
  makingValue: '',
  wastagePct: '',
  huid: '',
};

export interface Tag {
  readonly id: string;
  readonly tagNo: string;
  readonly status: 'in_stock' | 'sold' | 'returned';
  readonly soldOn: string | null;
  readonly purity: Purity | null;
  readonly netG: string | null;
  readonly huid: string;
}

interface TagWire {
  id: string;
  tag_no: string;
  status: Tag['status'];
  sold_on: string | null;
  purity: Purity | null;
  net_g: string | null;
  huid: string;
}

const toTag = (row: TagWire): Tag => ({
  id: row.id,
  tagNo: row.tag_no,
  status: row.status,
  soldOn: row.sold_on,
  purity: row.purity,
  netG: row.net_g,
  huid: row.huid,
});

/** The wire shape, blanks as empty (the server works net out from gross − stone). */
export const toTagBody = (v: TagFormValues): Record<string, string> => ({
  tag_no: v.tagNo.trim(),
  purity: v.purity,
  gross_g: v.grossG.trim(),
  stone_g: v.stoneG.trim(),
  net_g: v.netG.trim(),
  making_type: v.makingType,
  making_value: v.makingValue.trim(),
  wastage_pct: v.wastagePct.trim(),
  huid: v.huid.trim(),
});

/** Server `tag_no` / `tag.tag_no` → the form's `tag.tagNo`. */
export const TAG_FIELD: Readonly<Record<string, keyof TagFormValues>> = {
  tag_no: 'tagNo',
  purity: 'purity',
  gross_g: 'grossG',
  stone_g: 'stoneG',
  net_g: 'netG',
  making_type: 'makingType',
  making_value: 'makingValue',
  wastage_pct: 'wastagePct',
  huid: 'huid',
};

export const listItemTags = async (
  itemId: string,
  signal?: AbortSignal
): Promise<readonly Tag[]> => {
  const res = await api.get<{ data: TagWire[] }>(
    `/items/${itemId}/tags`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return res.data.data.map(toTag);
};

export const addTag = async (itemId: string, values: TagFormValues): Promise<Tag> => {
  const res = await api.post<{ data: TagWire }>(`/items/${itemId}/tags`, toTagBody(values));
  return toTag(res.data.data);
};

export const getTagsInStock = async (signal?: AbortSignal): Promise<number> => {
  const res = await api.get<{ data: { in_stock: number } }>(
    '/jewel-tags/summary',
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return res.data.data.in_stock;
};
