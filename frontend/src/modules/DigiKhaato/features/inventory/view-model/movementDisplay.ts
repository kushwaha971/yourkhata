import { ROUTES } from 'src/routes';

import { ADJUSTMENT_REASONS } from '../constants/inventoryConstants';

import { movementLabelId } from './itemDisplay';

import type { StockMovement } from '../types/item.types';

/**
 * 09 §8.2 — a movement row says what moved the stock in a shopkeeper's words,
 * "Sold on INV/26-27/0418", "Bought on PB/26-27/0012", "Adjusted: Damage",
 * "PB/26-27/0012 cancelled", and opens that document.
 *
 * Before, the row read "Purchase" with no number, and a void's reversal printed
 * the raw message id of its reason ("stock.adjust.reason.void") — `reason` is a
 * free server column, and only the five ADJUSTMENT reasons have a label. A
 * reason outside that list is never rendered.
 */
export interface MovementView {
  readonly titleId: string;
  /** The document number, for "Sold on {number}". */
  readonly number: string | null;
  /** The adjustment reason's message id, for "Adjusted: {reason}". */
  readonly reasonId: string | null;
  /** The document's page, or null when there is no document to open. */
  readonly href: string | null;
  /** Which module's read permission that page needs. */
  readonly module: 'sales' | 'purchases' | null;
  /** An adjustment opens in its own dialog rather than a page. */
  readonly adjustmentId: string | null;
}

const ROUTE_BY_KIND: Readonly<Record<string, string>> = {
  invoice: ROUTES.SALES_INVOICES,
  bill_of_supply: ROUTES.SALES_INVOICES,
  credit_note: ROUTES.SALES_CREDIT_NOTES,
  delivery_challan: ROUTES.SALES_CHALLANS,
  sales_order: ROUTES.SALES_ORDERS,
  estimate: ROUTES.SALES_ESTIMATES,
  purchase_bill: ROUTES.PURCHASE_BILLS,
  debit_note: ROUTES.DEBIT_NOTES,
  purchase_order: ROUTES.PURCHASE_ORDERS,
};

const DOCUMENT_TITLE_ID: Readonly<Partial<Record<string, string>>> = {
  sale_out: 'items.movements.title.sold',
  sale_return_in: 'items.movements.title.returned',
  purchase_in: 'items.movements.title.bought',
  purchase_return_out: 'items.movements.title.sentBack',
  reversal: 'items.movements.title.cancelled',
};

const isAdjustmentReason = (reason: string | null): reason is (typeof ADJUSTMENT_REASONS)[number] =>
  reason !== null && (ADJUSTMENT_REASONS as readonly string[]).includes(reason);

export const movementView = (movement: StockMovement): MovementView => {
  const { source, movementType } = movement;
  const plain: MovementView = {
    titleId: movementLabelId(movementType),
    number: null,
    reasonId: null,
    href: null,
    module: null,
    adjustmentId: null,
  };

  if (source.type === 'stock_adjustment') {
    const adjustmentId = source.id;
    if (movementType === 'reversal') {
      return { ...plain, titleId: 'items.movements.title.adjustUndone', adjustmentId };
    }
    return isAdjustmentReason(movement.reason)
      ? {
          ...plain,
          titleId: 'items.movements.title.adjusted',
          reasonId: `stock.adjust.reason.${movement.reason}`,
          adjustmentId,
        }
      : { ...plain, adjustmentId };
  }

  const document = source.type === 'sales_document' || source.type === 'purchase_document';
  if (!document || !source.number) return plain;
  const titleId =
    movementType === 'sale_out' && source.kind === 'delivery_challan'
      ? 'items.movements.title.delivered'
      : (DOCUMENT_TITLE_ID[movementType] ?? 'items.movements.title.withNumber');
  const base = source.kind ? ROUTE_BY_KIND[source.kind] : undefined;
  return {
    ...plain,
    titleId,
    number: source.number,
    href: base && source.id ? `${base}/${encodeURIComponent(source.id)}` : null,
    module: source.type === 'sales_document' ? 'sales' : 'purchases',
  };
};
