import type { UbStatusBadgeTone } from 'src/design-system';
import { formatQuantity } from 'src/utils/quantity';

import { MOVEMENT_TYPE_LABEL_ID } from '../constants/inventoryConstants';

import type { ItemListRow, MovementType, StockStatus } from '../types/item.types';

/**
 * §17.6.0 "Stock badge tones" — out (danger), low (warning), in stock
 * (success); untracked goods and services carry no badge at all. The label is
 * always a WORD (INV-02 UX: "badges carry text labels"); a negative on-hand is
 * said with its signed quantity, "Out of stock · −3 NOS".
 */
export interface StockBadgeView {
  readonly tone: UbStatusBadgeTone;
  readonly labelId: string;
  readonly params: Record<string, string>;
}

export const stockBadge = (
  status: StockStatus | null,
  onHand: string | null,
  unitCode: string
): StockBadgeView | null => {
  if (status === null || onHand === null) return null;
  if (status === 'out') {
    const negative = onHand.trim().startsWith('-');
    return negative
      ? {
          tone: 'error',
          labelId: 'items.stock.outNegative',
          params: { qty: formatSignedQuantity(onHand, unitCode) },
        }
      : { tone: 'error', labelId: 'items.stock.out', params: {} };
  }
  if (status === 'low') return { tone: 'warning', labelId: 'items.stock.low', params: {} };
  return { tone: 'success', labelId: 'items.stock.in', params: {} };
};

/**
 * 09 §8.1 — a phone card says the stock in words: "318 NOS in stock", "Low: 3 NOS
 * left", "Out of stock" (with how far below zero), "Service" for an untracked
 * service. A low or out item is in warning/error tone AND in words, never colour
 * alone. `null` for goods whose stock is not tracked.
 */
export const stockWords = (
  row: Pick<ItemListRow, 'stockStatus' | 'onHand' | 'unit' | 'itemType'>
): {
  labelId: string;
  params: Record<string, string>;
  tone: 'secondary' | 'warning' | 'error';
} | null => {
  if (row.stockStatus === null || row.onHand === null) {
    return row.itemType === 'service'
      ? { labelId: 'items.list.card.service', params: {}, tone: 'secondary' }
      : null;
  }
  const qty = formatQuantity(row.onHand, row.unit.code);
  if (row.stockStatus === 'out') {
    return row.onHand.trim().startsWith('-')
      ? {
          labelId: 'items.stock.outNegative',
          params: { qty: formatSignedQuantity(row.onHand, row.unit.code) },
          tone: 'error',
        }
      : { labelId: 'items.stock.out', params: {}, tone: 'error' };
  }
  if (row.stockStatus === 'low') {
    return { labelId: 'items.list.card.low', params: { qty }, tone: 'warning' };
  }
  return { labelId: 'items.list.card.inStock', params: { qty }, tone: 'secondary' };
};

/** "−3 NOS" / "+12 NOS" — a true minus sign, never a hyphen. */
export const formatSignedQuantity = (qty: string, unitCode?: string): string => {
  const negative = qty.trim().startsWith('-');
  const magnitude = formatQuantity(negative ? qty.trim().slice(1) : qty, unitCode);
  return negative ? `−${magnitude}` : `+${magnitude}`;
};

export const movementLabelId = (type: MovementType): string =>
  MOVEMENT_TYPE_LABEL_ID[type] ?? 'inventory.movement.type.unknown';

export const isInbound = (qty: string): boolean => !qty.trim().startsWith('-');

/** The row's on-hand cell: a quantity for tracked goods, "—" for the rest. */
export const onHandText = (row: Pick<ItemListRow, 'onHand' | 'unit'>): string =>
  row.onHand === null ? '—' : formatQuantity(row.onHand, row.unit.code);

/**
 * INV-01 FR-2 / BR-2 steps (a)–(c): the SKU prefix the server will use, so the
 * placeholder previews it. The number after it is the server's to allocate.
 */
export const skuPrefix = (name: string): string => {
  const ascii = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const cut = ascii.slice(0, 12).replace(/-+$/g, '');
  return cut || 'ITEM';
};

/** INV-01 EC-3 — digits only and barcode-length: probably scanned into the wrong field. */
export const looksLikeBarcode = (text: string): boolean => /^\d{8,14}$/.test(text.trim());

/**
 * UAT D7 — a purchase price nobody entered is "—", not "₹0.00". INV-01 §7
 * keeps it optional (default 0) and makes the OPENING cost default FROM it,
 * not the other way round, so the list must not imply a cost of nothing.
 */
export const hasPurchasePrice = (value: string | null): value is string =>
  value !== null && Number(value) !== 0;
