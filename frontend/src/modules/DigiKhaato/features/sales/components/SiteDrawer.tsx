'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import { UbButton, UbDrawer, UbField, UbForm, UbTextInput } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import type { ApiErrorShape } from 'src/types/api.types';

import { PartyPickerField } from '../../parties/components/PartyPickerField';
import { createSite, type ContractorSite } from '../api/siteService';

// Opened from other routes' chunks, so its words travel with it.
import 'src/i18n/catalogues/sales';

interface SiteFormValues {
  partyId: string;
  partyName: string;
  name: string;
}

/** G7 — New site: whose it is and what it is called. Nothing else is needed. */
export function SiteDrawer({
  onClose,
  onSaved,
  party,
}: Readonly<{
  onClose: () => void;
  onSaved: (site: ContractorSite) => void;
  /** Opened from a contractor's page: already known. */
  party?: { readonly id: string; readonly name: string };
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const key = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const form = useForm<SiteFormValues>({
    mode: 'onTouched',
    defaultValues: { partyId: party?.id ?? '', partyName: party?.name ?? '', name: '' },
  });
  const { control, setError, setValue } = form;
  const partyName = useWatch({ control, name: 'partyName' });

  const submit = useCallback(
    async (values: SiteFormValues) => {
      if (!values.partyId) setError('partyId', { message: t('sales.site.needContractor') });
      if (!values.name.trim()) setError('name', { message: t('sales.site.needName') });
      if (!values.partyId || !values.name.trim()) return;
      setBusy(true);
      try {
        onSaved(await createSite({ party_id: values.partyId, name: values.name.trim() }, key.current));
      } catch (thrown) {
        const details = (thrown as ApiErrorShape).details as Record<string, string[]> | undefined;
        // Another try is another site: a refused name must not replay this key.
        key.current = crypto.randomUUID();
        if (details?.name?.[0]) setError('name', { message: details.name[0] });
        setBusy(false);
      }
    },
    [onSaved, setError, t]
  );

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('sales.site.new')}
      closeLabel={t('common.action.close')}
      footer={
        <UbButton type="submit" form={formId} busy={busy} data-testid="site-save">
          {t('sales.site.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit}>
        <UbField name="partyId" label={t('sales.site.contractor')}>
          {(field) => (
            <PartyPickerField
              field={field}
              pickedName={partyName}
              onPick={(id, name) => {
                setValue('partyId', id, { shouldDirty: true });
                setValue('partyName', name);
                form.clearErrors('partyId');
              }}
              labels={{
                clear: (name) => t('sales.repair.clear', { name }),
                noAccess: t('sales.repair.noAccess'),
                results: t('sales.repair.results'),
                noMatch: t('sales.repair.noMatch'),
              }}
              t={t}
              type="customer"
              book="shop"
            />
          )}
        </UbField>
        <UbField name="name" label={t('sales.site.name')}>
          {(field) => (
            <UbTextInput {...field} value={field.value as string} maxLength={120} placeholder={t('sales.site.namePlaceholder')} />
          )}
        </UbField>
      </UbForm>
    </UbDrawer>
  );
}
