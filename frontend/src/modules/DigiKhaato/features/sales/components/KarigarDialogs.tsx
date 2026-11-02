'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { FormProvider, useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbDialog,
  UbField,
  UbForm,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbTextInput,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';

import { searchItems } from '../../inventory/api/itemService';
import { PURITIES, type Purity } from '../../inventory/api/metalRateService';
import { EMPTY_TAG, PURITY_SHORT, TAG_FIELD, toTagBody } from '../../inventory/api/tagService';
import { ItemTagFields, type TagFormHost } from '../../inventory/components/ItemTagFields';
import {
  addKarigar,
  issueGold,
  makeLotTag,
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

/**
 * G3c — design D6: a piece made from gold the karigar brought back. The same
 * "Tag details" as Add item, the item it belongs to, and the labour paid per
 * gram, which goes into what the piece cost.
 */
export function MakeTagDialog({
  lot,
  onClose,
  onDone,
}: Readonly<{ lot: KarigarLot; onClose: () => void; onDone: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const [items, setItems] = useState<readonly { value: string; label: string }[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void searchItems('', 1, controller.signal)
      .then(({ rows }) =>
        setItems(
          rows
            .filter((row) => row.tracking === 'serial')
            .map((row) => ({ value: row.id, label: row.name }))
        )
      )
      .catch(() => setItems([]));
    return () => controller.abort();
  }, []);
  const form = useForm<TagFormHost & { item_id: string; labour_per_g: string }>({
    defaultValues: {
      tag: { ...EMPTY_TAG, purity: lot.purity as Purity },
      tracking: 'serial',
      item_id: '',
      labour_per_g: '',
    },
  });
  const itemId = useWatch({ control: form.control, name: 'item_id' });
  return (
    <FormProvider {...form}>
      <Shell
        title={t('sales.karigar.makeTagTitle', { name: lot.karigar.name })}
        saveLabel={t('sales.karigar.makeTag')}
        form={form}
        fields={['tag', 'item_id', 'labour_per_g']}
        onClose={onClose}
        save={async (v) => {
          try {
            await makeLotTag(lot.id, {
              item_id: v.item_id,
              labour_per_g: v.labour_per_g,
              tag: toTagBody(v.tag),
            });
          } catch (thrown) {
            const error = thrown as ApiErrorShape;
            throw {
              ...error,
              details: Object.fromEntries(
                Object.entries((error.details ?? {}) as Record<string, unknown>).map(
                  ([key, value]) => [key in TAG_FIELD ? `tag.${TAG_FIELD[key]}` : key, value]
                )
              ),
            };
          }
          onDone();
        }}
      >
        <UbField name="item_id" label={t('sales.karigar.item')}>
          {(field) => (
            <UbSelect
              id={field.id}
              aria-label={t('sales.karigar.item')}
              value={itemId}
              placeholder={t(
                items?.length === 0 ? 'sales.karigar.noItems' : 'sales.karigar.chooseItem'
              )}
              options={items ?? []}
              onChange={(next) => form.setValue('item_id', next, { shouldDirty: true })}
            />
          )}
        </UbField>
        <ItemTagFields />
        <UbField name="labour_per_g" label={t('sales.karigar.labour')}>
          {(field) => (
            <UbMoneyInput
              {...field}
              value={field.value as string}
              onChange={(next) => form.setValue('labour_per_g', next, { shouldDirty: true })}
              unit="/ g"
            />
          )}
        </UbField>
      </Shell>
    </FormProvider>
  );
}
