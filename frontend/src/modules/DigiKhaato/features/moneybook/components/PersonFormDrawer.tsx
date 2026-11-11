'use client';

import { useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import {
  UbButton,
  UbDrawer,
  UbField,
  UbForm,
  UbStatusBanner,
  UbPhoneInput,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
// Loaded with this sheet, not with the screen that opens it (the form's words).
import 'src/i18n/catalogues/validation';

import { editPerson, savePerson } from '../redux/moneybookThunks';
import { useMoneyBookSchemas, type PersonFormValues } from '../validation/moneybookSchemas';

import type { Person } from '../types/moneybook.types';

/**
 * Add person / Edit person: a name and, if the owner wants reminders and calls,
 * a mobile. Nothing else — this is a personal book, not a customer record.
 * Adding the same name twice points at the person already there (409
 * `person_exists`) instead of splitting one person's money in two.
 */
export function PersonFormDrawer({
  open,
  person,
  initialName = '',
  initialMobile = '',
  onClose,
  onSaved,
}: Readonly<{
  open: boolean;
  /** Present when editing. */
  person?: Person | null;
  initialName?: string;
  /** From a picked phone contact: digits, any format. */
  initialMobile?: string;
  onClose: () => void;
  onSaved: (person: Person) => void;
}>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const { personSchema } = useMoneyBookSchemas();
  const { key, rotate } = useIdempotencyKey();
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const form = useForm<PersonFormValues>({
    resolver: yupResolver(personSchema),
    mode: 'onTouched',
    values: {
      name: person?.name ?? initialName,
      mobile: person?.mobile
        ? `+91${person.mobile}`
        : initialMobile
          ? `+91${initialMobile.replace(/\D/g, '').slice(-10)}`
          : '',
    },
  });

  const save = async (values: PersonFormValues): Promise<void> => {
    setSaving(true);
    setExisting(null);
    const mobile = values.mobile.replace(/\D/g, '').slice(-10);
    const action = person
      ? await dispatch(editPerson({ id: person.id, name: values.name, mobile }))
      : await dispatch(savePerson({ name: values.name, mobile, key }));
    setSaving(false);
    if (savePerson.fulfilled.match(action) || editPerson.fulfilled.match(action)) {
      rotate();
      onSaved(action.payload);
      return;
    }
    const error = action.payload;
    if (error?.code === 'person_exists') {
      const details = (error.details ?? {}) as { id?: string };
      if (details.id) setExisting({ id: details.id, name: values.name });
      return;
    }
    if (error?.code === 'validation_error') rotate();
    dispatch(
      showSnackbar({
        severity: 'error',
        message: error?.message ?? t('moneybook.person.saveError'),
      })
    );
  };

  return (
    <UbDrawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t(person ? 'moneybook.person.editTitle' : 'moneybook.person.addTitle')}
      closeLabel={t('moneybook.common.close')}
      keyboardAware
      footer={
        <UbButton
          type="submit"
          form={formId}
          busy={saving}
          size="lg"
          data-testid="moneybook-person-save"
        >
          {t('moneybook.person.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save}>
        <UbField name="name" label={t('moneybook.person.name')} required>
          {(field) => (
            <UbTextInput {...field} value={field.value as string} autoComplete="off" autoFocus />
          )}
        </UbField>
        <UbField
          name="mobile"
          label={t('moneybook.person.mobile')}
          hint={t('moneybook.person.mobileHint')}
        >
          {/* The design system's phone box: the +91 the central validator
              expects (a plain box refused a valid 8123456789, 11 Nov). */}
          {(field) => <UbPhoneInput {...field} autoComplete="tel" />}
        </UbField>
        {existing && (
          <UbStatusBanner
            tone="info"
            title={t('moneybook.person.exists', { name: existing.name })}
            action={
              <UbButton
                variant="outlineNeutral"
                size="sm"
                onClick={() => onSaved({ id: existing.id } as Person)}
              >
                {t('moneybook.person.openExisting', { name: existing.name })}
              </UbButton>
            }
          />
        )}
      </UbForm>
    </UbDrawer>
  );
}
