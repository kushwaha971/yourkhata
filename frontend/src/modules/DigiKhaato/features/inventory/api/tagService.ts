import { api, ubConfig } from 'src/api/AxiosInstances';

import type { Purity } from './metalRateService';

/** G2a — a jeweller's tag: one piece, priced by its weight (design D3/D5). */
export interface TagFormValues {
  tagNo: string;
  purity: Purity | 'silver_925';
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

/**
 * G2b — a jeweller's piece on a bill line: the tag's weights, the rate per
 * gram written on the line (kept once issued), and the parts of its price.
 * The wire's snake_case keys are kept: the snapshot goes back as it came.
 */
export interface JewelLine {
  readonly tag_no: string;
  readonly purity: string;
  readonly gross_g: string;
  readonly stone_g: string;
  readonly net_g: string;
  readonly rate: string | null;
  readonly making_type: 'pct' | 'per_g';
  readonly making_value: string;
  readonly wastage_pct: string;
  readonly stone_charge: string;
  readonly huid: string;
  readonly metal?: string;
  readonly making?: string;
  readonly wastage?: string;
  readonly stone?: string;
  readonly total?: string;
}

/** G2b — "Scan tag or search" on a bill: a tag in stock and its line at today's rate. */
export interface ScannedTag {
  readonly itemId: string;
  readonly itemName: string;
  readonly unitCode: string;
  readonly taxCode: string;
  readonly hsnSac: string | null;
  readonly jewel: JewelLine;
}

/** Null when no tag in stock has this number (unknown, or already sold). */
export const lookupTag = async (code: string): Promise<ScannedTag | null> => {
  const res = await api
    .get<{
      data: {
        item_id: string;
        item_name: string;
        unit_code: string;
        tax_code: string;
        hsn_sac: string | null;
        jewel: JewelLine;
      };
    }>('/jewel-tags/lookup', ubConfig({ params: { tag: code }, suppressErrorSnackbar: true }))
    .catch(() => null);
  if (!res) return null;
  const d = res.data.data;
  return {
    itemId: d.item_id,
    itemName: d.item_name,
    unitCode: d.unit_code,
    taxCode: d.tax_code,
    hsnSac: d.hsn_sac,
    jewel: d.jewel,
  };
};

export { PURITY_SHORT } from '../constants/purity';

/**
 * G2c — old gold taken in against a bill (design G2 pOldGold): what the
 * server priced. `value` comes off what the customer pays.
 */
export interface OldGoldWire {
  readonly weight_g: string;
  readonly purity: string;
  readonly rate: string;
  readonly less_pct: string;
  readonly gross: string;
  readonly less: string;
  readonly value: string;
}
