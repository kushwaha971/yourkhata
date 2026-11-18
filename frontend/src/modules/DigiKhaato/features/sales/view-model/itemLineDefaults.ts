import type { InvoiceLineForm } from './invoiceForm';
import type { ItemListRow } from '../../inventory/types/item.types';

/** One default-pricing mapping for a line pick and the Home new-bill handoff. */
export function itemLineDefaults(
  row: Pick<
    ItemListRow,
    'id' | 'name' | 'unit' | 'sellingPrice' | 'taxCode' | 'hsnSac' | 'taxInclusiveSelling'
  >
): Pick<
  InvoiceLineForm,
  | 'itemId'
  | 'description'
  | 'unitCode'
  | 'allowDecimal'
  | 'unitPrice'
  | 'taxCode'
  | 'hsnSac'
  | 'taxInclusive'
> {
  return {
    itemId: row.id,
    description: row.name,
    unitCode: row.unit.code,
    allowDecimal: row.unit.allowDecimal,
    unitPrice: row.sellingPrice,
    taxCode: row.taxCode,
    hsnSac: row.hsnSac ?? '',
    taxInclusive: row.taxInclusiveSelling ?? false,
  };
}
