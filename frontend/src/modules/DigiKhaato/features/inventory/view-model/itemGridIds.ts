/**
 * The items screens' selection labels for `inventoryGridLabels`. A module of
 * its own, because a key named in `gridLabels.ts` would make every screen that
 * uses the helper load the items catalogue, price lists included.
 */
export const ITEM_SELECT_IDS = {
  selectAll: 'items.list.selectAll',
  selectRow: 'items.list.selectRow',
} as const;
