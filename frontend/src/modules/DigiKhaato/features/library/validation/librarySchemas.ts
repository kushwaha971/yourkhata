import { useMemo } from 'react';

import * as Yup from 'yup';

import { useTranslation } from 'src/hooks/useTranslation';
import { useValidationSchemas } from 'src/hooks/useValidationSchemas';

import type { CollectValues, EnrolValues, ExpenseHead, PayMode } from '../types/library.types';

export interface ReasonValues {
  reason: string;
}

export interface ExpenseValues {
  head: ExpenseHead;
  amount: string;
  spentOn: string;
  note: string;
}

export interface BookValues {
  title: string;
  author: string;
  copies: string;
  code: string;
}

export interface SettingsValues {
  signAs: string;
  upiId: string;
  dueSoonDays: string;
}

const MODES: PayMode[] = ['cash', 'upi'];
const HEADS: ExpenseHead[] = ['rent', 'electricity', 'internet', 'salary', 'cleaning', 'other'];

/** The Library's forms, from the central validators. The server re-checks every rule. */
export const useLibrarySchemas = () => {
  const v = useValidationSchemas();
  const { t } = useTranslation();
  return useMemo(() => {
    const enrolSchema = Yup.object({
      name: v.nameValidation(1, 120),
      mobile: v.mobileValidation(false).defined().default(''),
      shiftId: v.requiredText(64, 'validation.required'),
      seat: Yup.string().defined().default(''),
      monthlyFee: v.amountValidation({ max: '9999999999.99' }),
      joinedOn: v.businessDateValidation(),
      firstPayment: v.optionalAmountValidation({ max: '9999999999.99' }).defined().default(''),
      mode: Yup.mixed<PayMode>().oneOf(MODES).defined(),
    }) as Yup.ObjectSchema<EnrolValues>;
    const collectSchema = Yup.object({
      amount: v.amountValidation({ max: '9999999999.99' }),
      mode: Yup.mixed<PayMode>().oneOf(MODES).defined(),
      paidOn: v.businessDateValidation(),
    }) as Yup.ObjectSchema<CollectValues>;
    const reasonSchema = Yup.object({
      reason: v.requiredBoundedText(200),
    }) as Yup.ObjectSchema<ReasonValues>;
    const expenseSchema = Yup.object({
      head: Yup.mixed<ExpenseHead>().oneOf(HEADS).defined(),
      amount: v.amountValidation({ max: '9999999999.99' }),
      spentOn: v.businessDateValidation(),
      note: v.boundedText(200),
    }) as Yup.ObjectSchema<ExpenseValues>;
    const bookSchema = Yup.object({
      title: v.nameValidation(1, 120),
      author: v.boundedText(120),
      copies: v.quantityValidation(false),
      code: v.boundedText(40),
    }) as Yup.ObjectSchema<BookValues>;
    const settingsSchema = Yup.object({
      signAs: v.boundedText(120),
      upiId: Yup.string()
        .defined()
        .default('')
        .test('upi', t('settings.validation.upiVpa'), (value) => !value || /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(value)),
      dueSoonDays: v.quantityValidation(false),
    }) as Yup.ObjectSchema<SettingsValues>;
    return { enrolSchema, collectSchema, reasonSchema, expenseSchema, bookSchema, settingsSchema };
  }, [v, t]);
};
