'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import { CompactDrawer } from 'src/components/records/CompactOverlays';
import {
  UbButton,
  UbDateInput,
  UbField,
  UbForm,
  UbMoneyInput,
  UbStack,
  UbStatusBanner,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDegradedNetwork } from 'src/hooks/useDegradedNetwork';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { addDaysIso } from 'src/utils/dates';

import { changePromise, createPromise } from '../api/shopPromiseService';
import { useShopPromiseSchema, type ShopPromiseFormValues } from '../validation/shopPromiseSchema';

import type { ShopPromise, ShopPromiseRole } from '../types/shopPromise.types';

// Loaded with dynamic(), so its words come with its own chunk.
import 'src/i18n/catalogues/shopPromiseForm';
import 'src/i18n/catalogues/validation';

const FIELDS = ['promisedOn', 'amount', 'note'] as const;
const WIRE_TO_FORM: Record<string, string> = { promised_on: 'promisedOn' };

/**
 * BP-16 (R-DEC-26) — add or change a Shop promise: the day, and optionally how
 * much. It records what was said and nothing else: no bill, due date, balance
 * or reminder moves, and the drawer says so under the form.
 *
 * Saving needs a connection (`online-only`). A queued promise could collide
 * with one taken on another phone while this one was offline, and the rule is
 * one open promise per contact and role.
 */
export function ShopPromiseDrawer({
  partyId,
  role,
  today,
  editing,
  onClose,
  onSaved,
  onConflict,
}: Readonly<{
  partyId: string;
  role: ShopPromiseRole;
  /** The business's today, ISO. */
  today: string;
  /** The open promise being changed; absent to add one. */
  editing?: ShopPromise | null;
  onClose: () => void;
  onSaved: (promise: ShopPromise) => void;
  /** The server's promise moved on under this screen: close and reload. */
  onConflict: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const { canWrite: canWriteIn } = useDegradedNetwork();
  const canWrite = canWriteIn('online-only');
  const { key, rotate } = useIdempotencyKey();
  const schema = useShopPromiseSchema(today);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<readonly string[]>([]);
  const inFlight = useRef(false);

  const form = useForm<ShopPromiseFormValues>({
    resolver: yupResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      promisedOn: editing?.promisedOn ?? '',
      amount: editing?.amount ?? '',
      note: editing?.note ?? '',
    },
  });
  const { setError, formState } = form;

  const submit = useCallback(
    async (values: ShopPromiseFormValues) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFormErrors([]);
      try {
        const promise = editing
          ? await changePromise(editing, values, key)
          : await createPromise(partyId, role, values, key);
        rotate();
        dispatch(
          showSnackbar({
            severity: 'success',
            id: editing ? 'parties.shopPromise.form.changed' : 'parties.shopPromise.form.saved',
          })
        );
        onSaved(promise);
        onClose();
      } catch (thrown) {
        const apiError = thrown as ApiErrorShape;
        if (apiError.code === 'validation_error') {
          rotate();
          setFormErrors(
            applyServerErrors(
              {
                ...apiError,
                details: Object.fromEntries(
                  Object.entries(apiError.details ?? {}).map(([path, messages]) => [
                    WIRE_TO_FORM[path] ?? path,
                    messages,
                  ])
                ),
              },
              setError,
              [...FIELDS]
            )
          );
        } else if (
          apiError.code === 'stale_version' ||
          apiError.code === 'promise_closed' ||
          apiError.code === 'promise_already_open'
        ) {
          /* Another screen got there first; the interceptor said so. Close, and
             let the page reload what is true now. */
          rotate();
          onConflict();
        }
        /* Anything else has been toasted by the interceptor; what was typed
           stays and Save resends it with the SAME key. */
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [editing, key, partyId, role, rotate, dispatch, onSaved, onClose, onConflict, setError]
  );

  return (
    <CompactDrawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t(editing ? 'parties.shopPromise.form.drawer.change' : 'parties.shopPromise.form.drawer.add')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!formState.isDirty}
      footer={
        <UbButton
          type="submit"
          form={formId}
          busy={saving}
          busyLabel={t('parties.shopPromise.form.saving')}
          disabled={!canWrite}
          data-testid="shop-promise-save"
        >
          {t('parties.shopPromise.form.save')}
        </UbButton>
      }
    >
      <UbStack gap={4} data-testid="shop-promise-drawer">
        {!canWrite && <UbStatusBanner tone="info" title={t('parties.shopPromise.form.offline')} />}
        <UbForm id={formId} form={form} onSubmit={submit} formErrors={formErrors}>
          <UbField name="promisedOn" label={t(`parties.shopPromise.form.when.${role}`)} required>
            {(field) => (
              <UbDateInput
                {...field}
                min={today}
                quickChoicesLabel={t('parties.shopPromise.form.quick')}
                quickChoices={[
                  { label: t('parties.shopPromise.form.today'), date: today },
                  { label: t('parties.shopPromise.form.tomorrow'), date: addDaysIso(today, 1) },
                  { label: t('parties.shopPromise.form.nextWeek'), date: addDaysIso(today, 7) },
                ]}
              />
            )}
          </UbField>
          <UbField name="amount" label={t('parties.shopPromise.form.amount')}>
            {(field) => <UbMoneyInput {...field} value={field.value ?? ''} inputMode="decimal" />}
          </UbField>
          <UbField
            name="note"
            label={t('parties.shopPromise.form.note')}
            hint={t('parties.shopPromise.form.noteHint')}
          >
            {(field) => <UbTextInput {...field} maxLength={200} />}
          </UbField>
        </UbForm>
        <UbText variant="caption" tone="secondary">
          {t(`parties.shopPromise.form.explain.${role}`)}
        </UbText>
      </UbStack>
    </CompactDrawer>
  );
}
