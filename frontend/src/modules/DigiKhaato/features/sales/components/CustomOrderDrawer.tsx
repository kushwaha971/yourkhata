'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbBox,
  UbButton,
  UbDateInput,
  UbField,
  UbForm,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbSwitch,
  UbTextInput,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';

import { PURITIES } from '../../inventory/api/metalRateService';
import { PURITY_SHORT } from '../../inventory/api/tagService';
import { PartyPickerField } from '../../parties/components/PartyPickerField';
import {
  createCustomOrder,
  ORDER_FIELD,
  type CustomOrder,
  type CustomOrderFormValues,
} from '../api/customOrderService';

const inDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MODES = ['cash', 'upi', 'bank', 'cheque', 'card'] as const;

/**
 * G3a — design G3 pJOrder: who, what to make, approximate weight and purity,
 * the delivery date, an advance that may fix today's rate. "Save and give
 * receipt" opens the advance's receipt. "Paid by" is not in the mock: without
 * it the cashbook could not know where the advance went.
 */
export function CustomOrderDrawer({
  onClose,
  onSaved,
}: Readonly<{ onClose: () => void; onSaved: (order: CustomOrder) => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const formId = useId();
  const clientKey = useRef(crypto.randomUUID());
  const receipt = useRef(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const form = useForm<CustomOrderFormValues>({
    defaultValues: {
      partyId: '',
      partyName: '',
      what: '',
      approxWeightG: '',
      purity: 'gold_22k',
      deliverOn: '',
      advance: '',
      advanceMode: 'cash',
      fixRate: false,
    },
  });
  const { setValue, control } = form;
  const partyName = useWatch({ control, name: 'partyName' });
  const advance = useWatch({ control, name: 'advance' });
  const hasAdvance = Number(advance) > 0;
  const submit = useCallback(
    async (values: CustomOrderFormValues) => {
      try {
        const order = await createCustomOrder(values, clientKey.current);
        onSaved(order);
        if (receipt.current && order.advancePaymentId) {
          router.push(`${ROUTES.PAYMENTS}/${order.advancePaymentId}`);
        }
      } catch (thrown) {
        const error = thrown as ApiErrorShape;
        const details = Object.fromEntries(
          Object.entries((error.details ?? {}) as Record<string, unknown>).map(([key, value]) => [
            ORDER_FIELD[key] ?? key,
            value,
          ])
        );
        setErrors(
          applyServerErrors({ ...error, details }, form.setError, Object.values(ORDER_FIELD), t)
        );
      }
    },
    [onSaved, router, form.setError, t]
  );
  const busy = form.formState.isSubmitting;
  return (
    <UbDrawer
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t('sales.customOrder.new')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!form.formState.isDirty}
      footer={
        <>
          <UbButton
            type="submit"
            form={formId}
            variant="secondary"
            busy={busy}
            onClick={() => {
              receipt.current = false;
            }}
          >
            {t('sales.customOrder.save')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            busy={busy}
            disabled={!hasAdvance}
            onClick={() => {
              receipt.current = true;
            }}
            data-testid="custom-order-receipt"
          >
            {t('sales.customOrder.saveReceipt')}
          </UbButton>
        </>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={errors}>
        <UbField name="partyId" label={t('sales.customOrder.customer')}>
          {(field) => (
            <PartyPickerField
              field={field}
              pickedName={partyName}
              onPick={(id, name) => {
                setValue('partyId', id, { shouldDirty: true });
                setValue('partyName', name);
              }}
              labels={{
                clear: (name) => t('sales.customOrder.clear', { name }),
                noAccess: t('sales.customOrder.noAccess'),
                results: t('sales.customOrder.results'),
                noMatch: t('sales.customOrder.noMatch'),
              }}
              t={t}
              type="customer"
              book="shop"
            />
          )}
        </UbField>
        <UbField name="what" label={t('sales.customOrder.what')}>
          {(field) => <UbTextInput {...field} value={field.value as string} maxLength={200} />}
        </UbField>
        <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <UbField name="approxWeightG" label={t('sales.customOrder.weight')}>
            {(field) => (
              <UbQuantityInput
                {...field}
                value={field.value as string}
                onChange={(next) => setValue('approxWeightG', next, { shouldDirty: true })}
                decimals={3}
                unit="g"
              />
            )}
          </UbField>
          <UbField name="purity" label={t('sales.customOrder.purity')}>
            {(field) => (
              <UbSelect
                id={field.id}
                aria-label={t('sales.customOrder.purity')}
                value={field.value as string}
                options={PURITIES.map((p) => ({ value: p, label: PURITY_SHORT[p] ?? p }))}
                onChange={(next) => setValue('purity', next, { shouldDirty: true })}
              />
            )}
          </UbField>
          <UbField name="deliverOn" label={t('sales.customOrder.deliverOn')}>
            {(field) => (
              <UbDateInput
                {...field}
                value={field.value as string}
                quickChoicesLabel={t('sales.customOrder.deliverOn')}
                quickChoices={[
                  { label: t('sales.customOrder.inDays', { n: 7 }), date: inDays(7) },
                  { label: t('sales.customOrder.inDays', { n: 15 }), date: inDays(15) },
                ]}
              />
            )}
          </UbField>
          <UbField name="advance" label={t('sales.customOrder.advance')}>
            {(field) => (
              <UbMoneyInput
                {...field}
                value={field.value as string}
                onChange={(next) => setValue('advance', next, { shouldDirty: true })}
              />
            )}
          </UbField>
        </UbBox>
        {hasAdvance && (
          <UbField name="advanceMode" label={t('sales.customOrder.paidBy')}>
            {(field) => (
              <UbSelect
                id={field.id}
                aria-label={t('sales.customOrder.paidBy')}
                value={field.value as string}
                options={MODES.map((m) => ({ value: m, label: t(`sales.customOrder.mode.${m}`) }))}
                onChange={(next) => setValue('advanceMode', next, { shouldDirty: true })}
              />
            )}
          </UbField>
        )}
        <UbField name="fixRate" label={t('sales.customOrder.fixRate')} controlOwnsLabel>
          {(field) => (
            <UbSwitch
              id={field.id}
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              label={t('sales.customOrder.fixRate')}
              description={t('sales.customOrder.fixRateHint')}
            />
          )}
        </UbField>
      </UbForm>
    </UbDrawer>
  );
}
