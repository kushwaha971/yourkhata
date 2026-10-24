import { useMemo } from 'react';

import * as Yup from 'yup';

import { useValidationSchemas } from 'src/hooks/useValidationSchemas';

export interface CashCountFormValues {
  countedAmount: string;
  note: string;
}

/** BP-17 — a count may be ₹0 (an empty drawer is an answer); the note is optional. */
export const useCashCountSchema = (): Yup.ObjectSchema<CashCountFormValues> => {
  const { amountValidation, noteValidation } = useValidationSchemas();
  return useMemo(
    () =>
      Yup.object({
        countedAmount: amountValidation({ allowZero: true }),
        note: noteValidation(200).default(''),
      }) as Yup.ObjectSchema<CashCountFormValues>,
    [amountValidation, noteValidation]
  );
};
