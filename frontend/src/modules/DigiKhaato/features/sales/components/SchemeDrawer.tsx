'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbDrawer,
  UbField,
  UbForm,
  UbSearchInput,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { addDaysIso } from 'src/utils/calendarDays';
import { todayInTenantTz } from 'src/utils/dates';

import { searchItems } from '../../inventory/api/itemService';
import { createScheme, type SchemeRow } from '../api/schemeService';

import type { ItemListRow } from '../../inventory/types/item.types';
import type { SchemeRule } from '../view-model/schemes';

// Opened from other routes' chunks, so its words travel with it.
import 'src/i18n/catalogues/sales';

interface SchemeFormValues {
  code: string;
  company: string;
  rule: SchemeRule['rule'];
  item_id: string;
  buy_qty: string;
  free_qty: string;
  amount: string;
  min_bill: string;
  valid_till: string;
}

const FIELDS: readonly (keyof SchemeFormValues)[] = [
  'code', 'company', 'rule', 'item_id', 'buy_qty', 'free_qty', 'amount', 'min_bill', 'valid_till',
];
const NUMBER = /^\d+(\.\d{1,2})?$/;

/** G9 — New scheme: the company's offer as the shop reads it off the circular. */
export function SchemeDrawer({
  onClose,
  onSaved,
}: Readonly<{ onClose: () => void; onSaved: (scheme: SchemeRow) => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const key = useRef(crypto.randomUUID());
  const timezone = useAppSelector(selectTenantTimezone);
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState<ItemListRow | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [found, setFound] = useState<readonly ItemListRow[]>([]);
  const form = useForm<SchemeFormValues>({
    mode: 'onTouched',
    defaultValues: {
      code: '', company: '', rule: 'free', item_id: '', buy_qty: '', free_qty: '1', amount: '', min_bill: '',
      valid_till: addDaysIso(today, 30),
    },
  });
  const { control, setError, setValue, clearErrors } = form;
  const rule = useWatch({ control, name: 'rule' });
  const itemError = form.formState.errors.item_id?.message;

  useEffect(() => {
    if (!q || item) return undefined;
    const controller = new AbortController();
    searchItems(q, 1, controller.signal)
      .then((result) => setFound(result.rows.slice(0, 6)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [q, item]);

  const submit = useCallback(
    async (values: SchemeFormValues) => {
      const wrong: [keyof SchemeFormValues, string][] = [];
      if (!values.code.trim()) wrong.push(['code', t('sales.scheme.needCode')]);
      if (!values.company.trim()) wrong.push(['company', t('sales.scheme.needCompany')]);
      if (values.rule !== 'percent' && !values.item_id) wrong.push(['item_id', t('sales.scheme.needItem')]);
      const needs: (keyof SchemeFormValues)[] =
        values.rule === 'free' ? ['buy_qty', 'free_qty'] : values.rule === 'per_unit' ? ['amount'] : ['amount', 'min_bill'];
      for (const name of needs)
        if (!NUMBER.test(values[name].trim()) || (name !== 'min_bill' && Number(values[name]) <= 0))
          wrong.push([name, t('sales.scheme.needNumber')]);
      if (values.rule === 'percent' && Number(values.amount) > 100) wrong.push(['amount', t('sales.scheme.upTo100')]);
      if (!values.valid_till) wrong.push(['valid_till', t('sales.scheme.needTill')]);
      for (const [name, message] of wrong) setError(name, { message });
      if (wrong.length) return;
      setBusy(true);
      try {
        onSaved(
          await createScheme({
            client_key: key.current,
            code: values.code.trim(),
            company: values.company.trim(),
            rule: values.rule,
            item_id: values.item_id || null,
            ...Object.fromEntries(needs.map((name) => [name, values[name].trim()])),
            valid_from: today,
            valid_till: values.valid_till,
          })
        );
      } catch (thrown) {
        // Another try is another scheme: a refused one must not replay this key.
        key.current = crypto.randomUUID();
        const details = (thrown as ApiErrorShape).details as Record<string, string[]> | undefined;
        for (const name of FIELDS) if (details?.[name]?.[0]) setError(name, { message: details[name][0] });
        setBusy(false);
      }
    },
    [onSaved, setError, t, today]
  );

  const number = (name: keyof SchemeFormValues, label: string, hint?: string) => (
    <UbField name={name} label={label} hint={hint}>
      {(field) => (
        <UbTextInput {...field} value={field.value as string} inputMode="decimal" maxLength={10} data-testid={`scheme-${name}`} />
      )}
    </UbField>
  );

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('sales.scheme.new')}
      closeLabel={t('common.action.close')}
      footer={
        <UbButton type="submit" form={formId} busy={busy} data-testid="scheme-save">
          {t('sales.scheme.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit}>
        <UbField name="code" label={t('sales.scheme.code')} hint={t('sales.scheme.codeHint')}>
          {(field) => <UbTextInput {...field} value={field.value as string} maxLength={24} uppercase data-testid="scheme-code" />}
        </UbField>
        <UbField name="company" label={t('sales.scheme.company')}>
          {(field) => <UbTextInput {...field} value={field.value as string} maxLength={120} data-testid="scheme-company" />}
        </UbField>
        <UbField name="rule" label={t('sales.scheme.gives')}>
          {(field) => (
            <UbChoiceChips<SchemeRule['rule']>
              value={field.value as SchemeRule['rule']}
              onChange={(next) => field.onChange(next)}
              ariaLabel={t('sales.scheme.gives')}
              options={[
                { value: 'free', label: t('sales.scheme.kindFree') },
                { value: 'per_unit', label: t('sales.scheme.kindPerUnit') },
                { value: 'percent', label: t('sales.scheme.kindPercent') },
              ]}
            />
          )}
        </UbField>
        <UbStack gap={1}>
          <UbText variant="body-sm" className="font-medium">
            {rule === 'percent' ? t('sales.scheme.itemOptional') : t('sales.scheme.item')}
          </UbText>
          {item ? (
            <UbStack direction="row" gap={2} className="items-center justify-between" data-testid="scheme-item-picked">
              <UbText variant="body-sm" className="font-semibold">{item.name}</UbText>
              <UbButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItem(null);
                  setValue('item_id', '');
                }}
              >
                {t('sales.scheme.change')}
              </UbButton>
            </UbStack>
          ) : (
            <UbStack gap={1}>
              <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.scheme.findItem')} aria-label={t('sales.scheme.findItem')} />
              {q &&
                found.map((row) => (
                  <UbButton
                    key={row.id}
                    variant="ghost"
                    className="h-auto min-h-11 justify-start text-left"
                    onClick={() => {
                      setItem(row);
                      setValue('item_id', row.id, { shouldDirty: true });
                      clearErrors('item_id');
                    }}
                    data-testid="scheme-item-option"
                  >
                    {row.name}
                  </UbButton>
                ))}
            </UbStack>
          )}
          {itemError && (
            <UbText variant="caption" tone="error" role="alert">
              {itemError}
            </UbText>
          )}
        </UbStack>
        {rule === 'free' && (
          <UbStack direction="row" gap={3} className="[&>*]:flex-1">
            {number('buy_qty', t('sales.scheme.buy'), item ? item.unit.code : undefined)}
            {number('free_qty', t('sales.scheme.getFree'), item ? item.unit.code : undefined)}
          </UbStack>
        )}
        {rule === 'per_unit' && number('amount', t('sales.scheme.offEach'))}
        {rule === 'percent' && (
          <UbStack direction="row" gap={3} className="[&>*]:flex-1">
            {number('amount', t('sales.scheme.percent'))}
            {number('min_bill', t('sales.scheme.minBill'))}
          </UbStack>
        )}
        <UbField name="valid_till" label={t('sales.scheme.validTill')}>
          {(field) => (
            <UbDateInput
              name={field.name}
              value={(field.value as string) || null}
              min={today}
              onChange={(next) => field.onChange(next ?? '')}
              aria-label={t('sales.scheme.validTill')}
            />
          )}
        </UbField>
        <UbText variant="caption" tone="secondary">{t('sales.scheme.drawerNote')}</UbText>
      </UbForm>
    </UbDrawer>
  );
}
