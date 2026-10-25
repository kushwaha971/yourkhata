import { useMemo } from 'react';

import * as Yup from 'yup';

import { useTranslation } from 'src/hooks/useTranslation';
import { useValidationSchemas } from 'src/hooks/useValidationSchemas';

export interface ShopPromiseFormValues {
  promisedOn: string;
  amount: string;
  note: string;
}

/**
 * BP-16 — a promise is FOR today or later (one already past is broken the
 * moment it is saved; the server refuses it too). The amount is optional, and
 * more than zero when given; the note is the shop's own and at most 200.
 */
export const useShopPromiseSchema = (
  today: string
): Yup.ObjectSchema<ShopPromiseFormValues> => {
  const { t } = useTranslation();
  const { businessDateValidation, optionalAmountValidation, noteValidation } =
    useValidationSchemas();
  return useMemo(
    () =>
      Yup.object({
        // ISO dates compare as strings in calendar order.
        promisedOn: businessDateValidation({ allowFuture: true }).test(
          'notPast',
          t('parties.shopPromise.datePast'),
          (value) => !value || value >= today
        ),
        amount: optionalAmountValidation()
          .test('aboveZero', t('validation.amount.positive'), (value) =>
            value == null || value === '' ? true : Number(value) > 0
          )
          .default(''),
        note: noteValidation(200).default(''),
      }) as Yup.ObjectSchema<ShopPromiseFormValues>,
    [t, today, businessDateValidation, optionalAmountValidation, noteValidation]
  );
};
