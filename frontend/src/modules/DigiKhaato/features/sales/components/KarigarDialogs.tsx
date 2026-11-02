'use client';

import { useId, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbDialog,
  UbField,
  UbForm,
  UbQuantityInput,
  UbSelect,
  UbTextInput,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';

import { PURITIES } from '../../inventory/api/metalRateService';
import { PURITY_SHORT } from '../../inventory/api/tagService';
import {
  addKarigar,
  issueGold,
  receiveGold,
  type Karigar,
  type KarigarLot,
} from '../api/karigarService';

import type { CustomOrder } from '../api/customOrderService';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/** Shared: a form in a dialog, its save button, and server errors under the boxes. */
function Shell<T extends FieldValues>({
  title,
  saveLabel,
  form,
  fields,
  onClose,
  save,
  children,
}: Readonly<{
  title: string;
  saveLabel: string;
  form: UseFormReturn<T>;
  fields: string[];
  onClose: () => void;
  save: (values: T) => Promise<void>;
  children: React.ReactNode;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const [errors, setErrors] = useState<readonly string[]>([]);
  return (
    <UbDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={title}
      closeLabel={t('common.action.close')}
    >
      <UbForm
        id={formId}
        form={form}
        formErrors={errors}
        onSubmit={async (values: T) => {
          try {
            await save(values);
          } catch (thrown) {
            setErrors(
              applyServerErrors(thrown as ApiErrorShape, form.setError as never, fields as never, t)
            );
          }
        }}
      >
        {children}
        <UbButton
          type="submit"
          form={formId}
          busy={form.formState.isSubmitting}
          data-testid="karigar-save"
        >
          {saveLabel}
        </UbButton>
      </UbForm>
    </UbDialog>
  );
}

const grams = (form: UseFormReturn<never>, name: string, label: string) => (
  <UbField name={name} label={label}>
    {(field) => (
      <UbQuantityInput
        {...field}
        value={field.value as string}
        onChange={(next) => form.setValue(name as never, next as never, { shouldDirty: true })}
        decimals={3}
        unit="g"
      />
    )}
  </UbField>
);

export function AddKarigarDialog({
  onClose,
  onDone,
}: Readonly<{ onClose: () => void; onDone: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { name: '', wastage_limit_pct: '' } });
  return (
    <Shell
      title={t('sales.karigar.add')}
      saveLabel={t('sales.karigar.add')}
      form={form}
      fields={['name', 'wastage_limit_pct']}
      onClose={onClose}
      save={async (v) => {
        await addKarigar(v.name, v.wastage_limit_pct);
        onDone();
      }}
    >
      <UbField name="name" label={t('sales.karigar.name')}>
        {(field) => <UbTextInput {...field} value={field.value as string} maxLength={120} />}
      </UbField>
      <UbField name="wastage_limit_pct" label={t('sales.karigar.limit')}>
        {(field) => (
          <UbQuantityInput
            {...field}
            value={field.value as string}
            onChange={(next) => form.setValue('wastage_limit_pct', next, { shouldDirty: true })}
            decimals={2}
            unit="%"
          />
        )}
      </UbField>
    </Shell>
  );
}

export function IssueGoldDialog({
  karigars,
  orders,
  onClose,
  onDone,
}: Readonly<{
  karigars: readonly Karigar[];
  orders: readonly CustomOrder[];
  onClose: () => void;
  onDone: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const clientKey = useRef(crypto.randomUUID());
  const form = useForm({
    defaultValues: {
      karigar: karigars[0]?.id ?? '',
      weight_g: '',
      purity: 'gold_22k',
      order_id: '',
    },
  });
  const orderId = useWatch({ control: form.control, name: 'order_id' });
  return (
    <Shell
      title={t('sales.karigar.issue')}
      saveLabel={t('sales.karigar.issueSave')}
      form={form}
      fields={['weight_g', 'purity', 'order_id']}
      onClose={onClose}
      save={async (v) => {
        await issueGold(v.karigar, {
          weight_g: v.weight_g,
          purity: v.purity,
          order_id: v.order_id || null,
          client_key: clientKey.current,
        });
        onDone();
      }}
    >
      <UbField name="karigar" label={t('sales.karigar.who')}>
        {(field) => (
          <UbSelect
            id={field.id}
            aria-label={t('sales.karigar.who')}
            value={field.value as string}
            options={karigars.map((k) => ({ value: k.id, label: k.name }))}
            onChange={(next) => form.setValue('karigar', next)}
          />
        )}
      </UbField>
      {grams(form as never, 'weight_g', t('sales.karigar.weight'))}
      <UbField name="purity" label={t('sales.customOrder.purity')}>
        {(field) => (
          <UbSelect
            id={field.id}
            aria-label={t('sales.customOrder.purity')}
            value={field.value as string}
            options={PURITIES.map((p) => ({ value: p, label: PURITY_SHORT[p] ?? p }))}
            onChange={(next) => form.setValue('purity', next)}
          />
        )}
      </UbField>
      <UbField name="order_id" label={t('sales.karigar.forOrder')}>
        {(field) => (
          <UbSelect
            id={field.id}
            aria-label={t('sales.karigar.forOrder')}
            value={orderId || 'none'}
            options={[
              { value: 'none', label: t('sales.karigar.noOrder') },
              ...orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.party.name}` })),
            ]}
            onChange={(next) => form.setValue('order_id', next === 'none' ? '' : next)}
          />
        )}
      </UbField>
    </Shell>
  );
}

export function ReceiveGoldDialog({
  lot,
  onClose,
  onDone,
}: Readonly<{ lot: KarigarLot; onClose: () => void; onDone: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { received_g: '' } });
  return (
    <Shell
      title={t('sales.karigar.receiveTitle', { name: lot.karigar.name, weight: lot.issued_g })}
      saveLabel={t('sales.karigar.receive')}
      form={form}
      fields={['received_g']}
      onClose={onClose}
      save={async (v) => {
        await receiveGold(lot.id, v.received_g);
        onDone();
      }}
    >
      {grams(form as never, 'received_g', t('sales.karigar.received'))}
    </Shell>
  );
}
