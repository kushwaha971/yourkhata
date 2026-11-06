import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

/** G4 — `GET /stock/short-book` (design dShortBook). */
export type ShortBookReason = 'asked' | 'manual' | 'low';

export interface ShortBookRow {
  readonly item: {
    readonly id: string;
    readonly name: string;
    readonly unitCode: string;
    readonly salt: string | null;
  };
  readonly reason: ShortBookReason;
  readonly askedCount: number;
  readonly onHand: string | null;
  readonly qty: string | null;
  readonly supplier: { readonly id: string; readonly name: string } | null;
  readonly lastRate: string | null;
}

export interface ShortBook {
  readonly rows: readonly ShortBookRow[];
  readonly counts: { readonly items: number; readonly distributors: number; readonly askedToday: number };
}

interface RowWire {
  item: { id: string; name: string; unit_code: string; salt: string | null };
  reason: ShortBookReason;
  asked_count: number;
  on_hand: string | null;
  qty: string | null;
  supplier: { id: string; name: string } | null;
  last_rate: string | null;
}

export const getShortBook = async (signal?: AbortSignal): Promise<ShortBook> => {
  const response = await api.get<{
    data: readonly RowWire[];
    meta: { counts: { items: number; distributors: number; asked_today: number } };
  }>(API_PATHS.STOCK_SHORT_BOOK, ubConfig({ signal }));
  const { data, meta } = response.data;
  return {
    rows: data.map((row) => ({
      item: {
        id: row.item.id,
        name: row.item.name,
        unitCode: row.item.unit_code,
        salt: row.item.salt,
      },
      reason: row.reason,
      askedCount: row.asked_count,
      onHand: row.on_hand,
      qty: row.qty,
      supplier: row.supplier,
      lastRate: row.last_rate,
    })),
    counts: {
      items: meta.counts.items,
      distributors: meta.counts.distributors,
      askedToday: meta.counts.asked_today,
    },
  };
};

/** Write a medicine into the book: asked at the counter, or added by hand. */
export const addToShortBook = async (
  itemId: string,
  reason: 'asked' | 'manual' = 'asked'
): Promise<{ readonly askedCount: number }> => {
  const response = await api.post<{ data: { asked_count: number } }>(
    API_PATHS.STOCK_SHORT_BOOK,
    { item_id: itemId, reason },
    ubConfig({})
  );
  return { askedCount: response.data.data.asked_count };
};

/** Close the rows of medicines just put on purchase orders. */
export const markShortBookOrdered = async (itemIds: readonly string[]): Promise<number> => {
  const response = await api.post<{ data: { closed: number } }>(
    API_PATHS.STOCK_SHORT_BOOK_ORDERED,
    { item_ids: itemIds },
    ubConfig({})
  );
  return response.data.data.closed;
};

/** G4 pSubst — medicines with the same salt, in stock first, then cheapest. */
export interface Substitute {
  readonly item: { readonly id: string; readonly name: string; readonly unitCode: string };
  readonly onHand: string;
  readonly sellingPrice: string;
  readonly inStock: boolean;
}

export const getSubstitutes = async (
  itemId: string,
  signal?: AbortSignal
): Promise<readonly Substitute[]> => {
  const response = await api.get<{
    data: readonly {
      item: { id: string; name: string; unit_code: string };
      on_hand: string;
      selling_price: string;
      in_stock: boolean;
    }[];
  }>(API_PATHS.ITEM_SUBSTITUTES(itemId), ubConfig({ signal, suppressErrorSnackbar: true }));
  return response.data.data.map((row) => ({
    item: { id: row.item.id, name: row.item.name, unitCode: row.item.unit_code },
    onHand: row.on_hand,
    sellingPrice: row.selling_price,
    inStock: row.in_stock,
  }));
};
