'use client';

import { useId, useState } from 'react';

import { FormProvider, useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbConfirmDialog,
  UbDialog,
  UbField,
  UbForm,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbSwitch,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';

import { PURITIES, type Purity } from '../../inventory/api/metalRateService';
import { EMPTY_TAG, PURITY_SHORT, TAG_FIELD, toTagBody } from '../../inventory/api/tagService';
import { ItemQuickAdd } from '../../inventory/components/ItemQuickAdd';
import { ItemTagFields, type TagFormHost } from '../../inventory/components/ItemTagFields';
import {
  addKarigar,
  correctLot,
  issueGold,
  makeLotTag,
  receiveGold,
  removeLot,
  updateKarigar,
  type Karigar,
  type KarigarLot,
} from '../api/karigarService';
import { useFormDeviceCopy } from '../hooks/useFormDeviceCopy';

import type { CustomOrder } from '../api/customOrderService';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

// The item search's own words arrive with this dialog's chunk.
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';

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
  const form = useForm({
    defaultValues: {
      karigar: karigars[0]?.id ?? '',
      weight_g: '',
      purity: 'gold_22k',
      order_id: '',
    },
  });
  const orderId = useWatch({ control: form.control, name: 'order_id' });
  const copy = useFormDeviceCopy('karigar-issue', form);
  return (
    <Shell
      title={t('sales.karigar.issue')}
      saveLabel={t('sales.karigar.issueSave')}
      form={form}
      fields={['weight_g', 'purity', 'order_id']}
      onClose={() => {
        copy.clear();
        onClose();
      }}
      save={async (v) => {
        await issueGold(v.karigar, {
          weight_g: v.weight_g,
          purity: v.purity,
          order_id: v.order_id || null,
          client_key: copy.clientKey,
        });
        copy.clear();
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
  const form = useForm({ defaultValues: { received_g: '', more: false } });
  return (
    <Shell
      title={t('sales.karigar.receiveTitle', { name: lot.karigar.name, weight: lot.issued_g })}
      saveLabel={t('sales.karigar.receive')}
      form={form}
      fields={['received_g']}
      onClose={onClose}
      save={async (v) => {
        await receiveGold(lot.id, v.received_g, v.more);
        onDone();
      }}
    >
      {grams(form as never, 'received_g', t('sales.karigar.received'))}
      <UbField name="more" label={t('sales.karigar.moreToCome')} controlOwnsLabel>
        {(field) => (
          <UbSwitch
            id={field.id}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            label={t('sales.karigar.moreToCome')}
            description={t('sales.karigar.moreToComeHint')}
          />
        )}
      </UbField>
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
  const [itemName, setItemName] = useState('');
  const form = useForm<TagFormHost & { item_id: string; labour_per_g: string }>({
    defaultValues: {
      tag: { ...EMPTY_TAG, purity: lot.purity as Purity },
      tracking: 'serial',
      item_id: '',
      labour_per_g: '',
    },
  });
  const copy = useFormDeviceCopy(`karigar-tag:${lot.id}`, form);
  return (
    <FormProvider {...form}>
      <Shell
        title={t('sales.karigar.makeTagTitle', { name: lot.karigar.name })}
        saveLabel={t('sales.karigar.makeTag')}
        form={form}
        fields={['tag', 'item_id', 'labour_per_g']}
        onClose={() => {
          copy.clear();
          onClose();
        }}
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
          copy.clear();
          onDone();
        }}
      >
        <UbField name="item_id" label={t('sales.karigar.item')} controlOwnsLabel>
          {() => (
            <UbStack gap={1}>
              <ItemQuickAdd
                labels={{
                  label: t('sales.karigar.item'),
                  placeholder: t('sales.karigar.chooseItem'),
                  empty: (query: string) => t('stock.count.pickEmpty', { query }),
                  none: t('stock.count.pickNone'),
                  askOwner: t('stock.count.pickAskOwner'),
                }}
                onPick={(row) => {
                  form.setValue('item_id', row.id, { shouldDirty: true });
                  setItemName(row.name);
                }}
              />
              {itemName && (
                <UbText variant="caption" tone="accent" data-testid="make-tag-item">
                  {itemName}
                </UbText>
              )}
            </UbStack>
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

/** Correct a mistyped lot, or remove one entered by mistake (not once it made tags). */
export function CorrectLotDialog({
  lot,
  onClose,
  onDone,
}: Readonly<{ lot: KarigarLot; onClose: () => void; onDone: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);
  const canRemove = usePermissions().can('sales.invoice.void');
  const form = useForm({
    defaultValues: {
      issued_g: lot.issued_g,
      received_g: lot.received_g ?? '',
      purity: lot.purity,
    },
  });
  return (
    <>
      <Shell
        title={t('sales.karigar.correctTitle', { name: lot.karigar.name })}
        saveLabel={t('sales.karigar.correctSave')}
        form={form}
        fields={['issued_g', 'received_g', 'purity']}
        onClose={onClose}
        save={async (v) => {
          await correctLot(lot.id, {
            issued_g: v.issued_g,
            purity: v.purity,
            ...(lot.received_g === null ? {} : { received_g: v.received_g }),
          });
          onDone();
        }}
      >
        {grams(form as never, 'issued_g', t('sales.karigar.given'))}
        {lot.received_g !== null && grams(form as never, 'received_g', t('sales.karigar.received'))}
        <UbField name="purity" label={t('sales.customOrder.purity')}>
          {(field) => (
            <UbSelect
              id={field.id}
              aria-label={t('sales.customOrder.purity')}
              value={field.value as string}
              options={PURITIES.map((p) => ({ value: p, label: PURITY_SHORT[p] ?? p }))}
              onChange={(next) => form.setValue('purity', next, { shouldDirty: true })}
            />
          )}
        </UbField>
        {lot.tag_count === 0 && canRemove && (
          <UbButton
            variant="ghost"
            className="self-start text-error"
            onClick={() => setConfirming(true)}
            data-testid="karigar-lot-remove"
          >
            {t('sales.karigar.remove')}
          </UbButton>
        )}
      </Shell>
      <UbConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('sales.karigar.removeTitle')}
        description={t('sales.karigar.removeBody', { weight: lot.issued_g })}
        confirmLabel={t('sales.karigar.remove')}
        cancelLabel={t('sales.karigar.removeKeep')}
        closeLabel={t('common.action.close')}
        destructive
        onConfirm={() =>
          void removeLot(lot.id)
            .then(onDone)
            .catch(() => {
              setConfirming(false);
              dispatch(showSnackbar({ severity: 'error', id: 'sales.karigar.removeFailed' }));
            })
        }
      />
    </>
  );
}

export function EditKarigarDialog({
  karigar,
  onClose,
  onDone,
}: Readonly<{ karigar: Karigar; onClose: () => void; onDone: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { name: karigar.name, wastage_limit_pct: karigar.wastage_limit_pct },
  });
  return (
    <Shell
      title={t('sales.karigar.edit')}
      saveLabel={t('sales.karigar.correctSave')}
      form={form}
      fields={['name', 'wastage_limit_pct']}
      onClose={onClose}
      save={async (v) => {
        await updateKarigar(karigar.id, v);
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
