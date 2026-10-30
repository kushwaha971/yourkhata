import type { ItemListRow } from '../../inventory/types/item.types';

/**
 * D P1a — the units one bill line can be sold in: the item's own, then each
 * "Also sold as" (1 Box = 20 PCS). A box line's price is the box's own price,
 * or the piece price × 20; stock still falls in pieces on the server.
 */
export interface LineUnitChoice {
  readonly code: string;
  readonly factor: number;
  readonly price: string;
  readonly allowDecimal: boolean;
}

const plain = (value: number): string => String(Number(value.toFixed(3)));

export function lineUnitChoices(
  row: Pick<ItemListRow, 'unit' | 'sellingPrice' | 'units'>
): readonly LineUnitChoice[] {
  const extras = row.units ?? [];
  if (extras.length === 0) return [];
  const base = Number(row.sellingPrice || 0);
  return [
    { code: row.unit.code, factor: 1, price: row.sellingPrice, allowDecimal: row.unit.allowDecimal },
    ...extras.map((unit) => ({
      code: unit.code,
      factor: Number(unit.factor),
      price: unit.sellingPrice ?? (base * Number(unit.factor)).toFixed(2),
      allowDecimal: unit.allowDecimal,
    })),
  ];
}

/** Design D1's line caption: "Sold in PCS · BOX of 20", or "1 BOX = 20 PCS". */
export function lineUnitCaption(
  choices: readonly LineUnitChoice[],
  current: string,
  words: { sold: (base: string, box: string, n: string) => string; one: (box: string, n: string, base: string) => string }
): string | null {
  const base = choices[0];
  if (!base || choices.length < 2) return null;
  const picked = choices.find((choice) => choice.code === current);
  if (picked && picked.factor !== 1) return words.one(picked.code, plain(picked.factor), base.code);
  const box = choices[1];
  if (!box) return null;
  return words.sold(base.code, box.code, plain(box.factor));
}
