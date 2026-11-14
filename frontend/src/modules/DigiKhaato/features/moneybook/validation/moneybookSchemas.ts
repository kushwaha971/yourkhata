import { useMemo } from 'react';

import * as Yup from 'yup';

import { useValidationSchemas } from 'src/hooks/useValidationSchemas';

import type { EntryKind } from '../types/moneybook.types';

export interface PersonFormValues {
  name: string;
  mobile: string;
}

export interface EntryFormValues {
  kind: EntryKind;
  amount: string;
  note: string;
  /** yyyy-mm-dd; the sheet starts on today. */
  entryDate: string;
}

export interface ReasonFormValues {
  reason: string;
}

/** The Money Book's forms, from the central validators. The server re-checks every rule. */
export const useMoneyBookSchemas = () => {
  const v = useValidationSchemas();
  return useMemo(() => {
    const personSchema = Yup.object({
      name: v.nameValidation(1, 120),
      mobile: v.mobileValidation(false).defined().default(''),
    }) as Yup.ObjectSchema<PersonFormValues>;
    const entrySchema = Yup.object({
      kind: Yup.mixed<EntryKind>().oneOf(['gave', 'got']).defined(),
      amount: v.amountValidation({ max: '9999999999.99' }),
      note: v.boundedText(200),
      // A past day is allowed, a future one is not (the server refuses it too).
      entryDate: v.businessDateValidation(),
    }) as Yup.ObjectSchema<EntryFormValues>;
    const reasonSchema = Yup.object({
      reason: v.boundedText(200),
    }) as Yup.ObjectSchema<ReasonFormValues>;
    return { personSchema, entrySchema, reasonSchema };
  }, [v]);
};
