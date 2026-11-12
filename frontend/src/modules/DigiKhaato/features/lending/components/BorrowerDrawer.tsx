'use client';

import { useEffect, useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import { UbButton, UbDrawer, UbField, UbForm, UbNativeSelect, UbPhoneInput, UbStatusBanner, UbTextInput } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';

import { listRoutes, saveBorrower } from '../api/lendingService';
import { useLendingSchemas } from '../validation/lendingSchemas';

import type { Borrower, BorrowerValues, Route } from '../types/lending.types';

/**
 * Add / edit a borrower: name, mobile, what they do and their route. A mobile
 * already in the book is the server's 409 `borrower_exists`, shown in place.
 */
export function BorrowerDrawer({
  borrower,
  onClose,
  onSaved,
}: Readonly<{ borrower?: Borrower | null; onClose: () => void; onSaved: (b: { id: string; name: string }) => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const { borrowerSchema } = useLendingSchemas();
  const { key, rotate } = useIdempotencyKey();
  const [routes, setRoutes] = useState<readonly Route[]>([]);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState<string | null>(null);
  const form = useForm<BorrowerValues>({
    resolver: yupResolver(borrowerSchema),
    mode: 'onTouched',
    defaultValues: {
      name: borrower?.name ?? '',
      mobile: borrower?.mobile ? `+91${borrower.mobile}` : '',
      work: borrower?.work ?? '',
      routeId: borrower?.routeId ?? '',
    },
  });
  useEffect(() => {
    const c = new AbortController();
    listRoutes(c.signal).then((r) => setRoutes(r.filter((x) => x.active))).catch(() => undefined);
    return () => c.abort();
  }, []);

  const save = async (values: BorrowerValues) => {
    setSaving(true);
    setExists(null);
    try {
      // The mobile rule turns an empty box into null (H70): read it null-safe.
      const mobile = (values.mobile ?? '').replace(/\D/g, '').slice(-10);
      const saved = await saveBorrower({ ...values, mobile, work: values.work ?? '' }, borrower?.id ?? null, key);
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'lending.borrower.saved', params: { name: saved.name } }));
      onSaved(saved);
    } catch (e) {
      const err = toApiError(e, 'lending.borrower.saveError');
      if (err.code === 'borrower_exists') setExists(err.message ?? '');
      else dispatch(showSnackbar({ severity: 'error', message: err.message ?? t('lending.borrower.saveError') }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t(borrower ? 'lending.borrower.edit' : 'lending.borrower.add')}
      closeLabel={t('lending.common.close')}
      keyboardAware
      footer={
        <UbButton type="submit" form={formId} busy={saving} size="lg" data-testid="lending-borrower-save">
          {t('lending.common.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save}>
        <UbField name="name" label={t('lending.borrower.name')} required>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" autoFocus />}
        </UbField>
        <UbField name="mobile" label={t('lending.borrower.mobile')} hint={t('lending.borrower.mobileHint')}>
          {(field) => <UbPhoneInput {...field} autoComplete="tel" />}
        </UbField>
        <UbField name="work" label={t('lending.borrower.work')} optionalLabel={t('lending.common.optional')}>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" placeholder={t('lending.borrower.workHint')} />}
        </UbField>
        <UbField name="routeId" label={t('lending.newLoan.route')}>
          {(field) => (
            <UbNativeSelect
              {...field}
              value={field.value as string}
              options={[{ value: '', label: t('lending.newLoan.noRoute') }, ...routes.map((r) => ({ value: r.id, label: r.name }))]}
            />
          )}
        </UbField>
        {exists && <UbStatusBanner tone="warning" title={exists} />}
      </UbForm>
    </UbDrawer>
  );
}
