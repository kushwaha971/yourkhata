import { movementView } from './movementDisplay';

import type { StockMovement } from '../types/item.types';

const move = (over: Partial<StockMovement>): StockMovement => ({
  id: 'm1',
  sequenceNo: 1,
  movementDate: '2026-10-20',
  movementType: 'sale_out',
  qty: '-2.000',
  unitCost: null,
  value: null,
  onHandAfter: '10.000',
  avgCostAfter: null,
  reason: null,
  source: { type: 'item', id: null, number: null },
  reversesId: null,
  isBackdated: false,
  createdBy: null,
  createdAt: '2026-10-20T10:00:00Z',
  ...over,
});

/**
 * 09 §8.2 — a movement row in words, linked to what moved it. The defect it
 * prevents: a purchase void's reversal carries `reason: "void"`, which is not
 * an adjustment reason, and the row printed the raw id
 * "stock.adjust.reason.void" in the middle of an item's history.
 */
describe('movementView', () => {
  it('names a sale by its invoice and opens the invoice', () => {
    const view = movementView(
      move({ source: { type: 'sales_document', id: 'd1', number: 'INV/0418', kind: 'invoice' } })
    );
    expect(view).toMatchObject({
      titleId: 'items.movements.title.sold',
      number: 'INV/0418',
      href: '/sales/invoices/d1',
      module: 'sales',
    });
  });

  it('opens a credit note, a challan and a debit note on their own pages', () => {
    const href = (kind: string, type: string, movementType: StockMovement['movementType']) =>
      movementView(move({ movementType, source: { type, id: 'x', number: 'N1', kind } })).href;
    expect(href('credit_note', 'sales_document', 'sale_return_in')).toBe('/sales/credit-notes/x');
    expect(href('delivery_challan', 'sales_document', 'sale_out')).toBe('/sales/challans/x');
    expect(href('debit_note', 'purchase_document', 'purchase_return_out')).toBe(
      '/purchases/debit-notes/x'
    );
  });

  it('a void reversal reads "… cancelled" and never shows its raw reason', () => {
    const view = movementView(
      move({
        movementType: 'reversal',
        reason: 'void',
        source: { type: 'purchase_document', id: 'b1', number: 'PB/12', kind: 'purchase_bill' },
      })
    );
    expect(view.titleId).toBe('items.movements.title.cancelled');
    expect(view.reasonId).toBeNull();
    expect(view.href).toBe('/purchases/bills/b1');
  });

  it('an adjustment reads its reason and opens its dialog, not a page', () => {
    const view = movementView(
      move({
        movementType: 'adjust_out',
        reason: 'damage',
        source: { type: 'stock_adjustment', id: 'a1', number: 'ADJ/3' },
      })
    );
    expect(view).toMatchObject({
      titleId: 'items.movements.title.adjusted',
      reasonId: 'stock.adjust.reason.damage',
      adjustmentId: 'a1',
      href: null,
    });
  });

  it('an unknown reason falls back to the type label; an unresolved document links nowhere', () => {
    expect(
      movementView(
        move({
          movementType: 'adjust_in',
          reason: 'void',
          source: { type: 'stock_adjustment', id: 'a1', number: null },
        })
      )
    ).toMatchObject({ titleId: 'inventory.movement.type.adjust_in', reasonId: null });
    expect(
      movementView(move({ source: { type: 'sales_document', id: 'd9', number: null } }))
    ).toMatchObject({ titleId: 'inventory.movement.type.sale_out', href: null });
  });
});
