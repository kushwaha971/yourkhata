import { firstWrongField } from './firstWrongField';

import type { InvoiceFormValues } from './invoiceForm';
import type { FieldErrors } from 'react-hook-form';

const wrong = { type: 'test', message: 'x' };

describe('firstWrongField (design §A4: the message names the wrong field)', () => {
  it('names the field a merchant reaches first, not the last one checked', () => {
    /* Prevents: "Please check the highlighted fields" with nothing to say
       which, the A4 bug the owner screenshotted. */
    const errors = {
      walkInMobile: wrong,
      lines: [undefined, { qty: wrong }],
    } as unknown as FieldErrors<InvoiceFormValues>;
    expect(firstWrongField(errors, 2)).toEqual({
      path: 'walkInMobile',
      label: 'sales.walkIn.mobile',
    });
  });

  it('names a line by its number, so a long bill says where to look', () => {
    const errors = {
      lines: [undefined, undefined, { unitPrice: wrong }],
    } as unknown as FieldErrors<InvoiceFormValues>;
    expect(firstWrongField(errors, 3)).toEqual({
      path: 'lines.2.unitPrice',
      label: 'sales.line.rate',
      n: 3,
    });
  });

  it('says nothing when nothing is wrong', () => {
    expect(firstWrongField({} as FieldErrors<InvoiceFormValues>, 4)).toBeNull();
  });
});
