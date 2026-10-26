import type { InvoiceFormValues } from './invoiceForm';
import type { FieldErrors } from 'react-hook-form';


/**
 * Design §A4: "If a field is wrong, the message names it and scrolls to it."
 * The first wrong field in the order a merchant fills the bill: who it is for,
 * the details, the lines top to bottom, then the bill's discount. `path` is
 * also the control's id (UbField uses the RHF path), so the page can scroll to
 * it; `label` is the message key for its name, with `n` for a line's number.
 */
export interface WrongField {
  readonly path: string;
  readonly label: string;
  readonly n?: number;
}

const HEAD: readonly [keyof InvoiceFormValues, string][] = [
  ['partyId', 'sales.editor.party'],
  ['walkInName', 'sales.walkIn.name'],
  ['walkInMobile', 'sales.walkIn.mobile'],
  ['documentDate', 'sales.editor.date'],
  ['dueOn', 'sales.editor.dueOn'],
  ['placeOfSupplyState', 'sales.editor.pos'],
];

const LINE: readonly [string, string][] = [
  ['qty', 'sales.line.qty'],
  ['unitPrice', 'sales.line.rate'],
  ['discountValue', 'sales.line.discountPct'],
];

export const firstWrongField = (
  errors: FieldErrors<InvoiceFormValues>,
  lineCount: number
): WrongField | null => {
  for (const [name, label] of HEAD) if (errors[name]) return { path: name, label };
  const lines = errors.lines as Record<number, Record<string, unknown> | undefined> | undefined;
  for (let i = 0; i < lineCount; i += 1) {
    const line = lines?.[i];
    if (!line) continue;
    for (const [name, label] of LINE)
      if (line[name]) return { path: `lines.${i}.${name}`, label, n: i + 1 };
  }
  if (errors.discountValue) return { path: 'discountValue', label: 'sales.totals.discount' };
  return null;
};
