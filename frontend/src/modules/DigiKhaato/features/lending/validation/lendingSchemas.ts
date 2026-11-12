import { useMemo } from 'react';

import * as Yup from 'yup';

import { useValidationSchemas } from 'src/hooks/useValidationSchemas';

import type { BorrowerValues, CollectValues, Frequency, NewLoanValues, PayMode } from '../types/lending.types';

const MODES: PayMode[] = ['cash', 'upi'];
const FREQS: Frequency[] = ['daily', 'weekly', 'monthly'];

/** Loans & Collections' forms, from the central validators. The server re-checks every rule. */
export const useLendingSchemas = () => {
  const v = useValidationSchemas();
  return useMemo(() => {
    const newLoanSchema = Yup.object({
      borrowerId: v.requiredText(64, 'validation.required'),
      lent: v.amountValidation({ max: '9999999999.99' }),
      frequency: Yup.mixed<Frequency>().oneOf(FREQS).defined(),
      count: v.quantityValidation(false),
      each: v.amountValidation({ max: '9999999999.99' }),
      startsOn: v.businessDateValidation({ allowFuture: true }),
      routeId: Yup.string().defined().default(''),
      charges: v.optionalAmountValidation({ max: '9999999999.99' }).defined().default(''),
    }) as Yup.ObjectSchema<NewLoanValues>;
    const collectSchema = Yup.object({
      amount: v.amountValidation({ max: '9999999999.99' }),
      mode: Yup.mixed<PayMode>().oneOf(MODES).defined(),
      collectedOn: v.businessDateValidation(),
    }) as Yup.ObjectSchema<CollectValues>;
    const borrowerSchema = Yup.object({
      name: v.nameValidation(1, 120),
      mobile: v.mobileValidation(false).defined().default(''),
      work: v.boundedText(120),
      routeId: Yup.string().defined().default(''),
    }) as Yup.ObjectSchema<BorrowerValues>;
    return { newLoanSchema, collectSchema, borrowerSchema };
  }, [v]);
};
