'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbBox,
  UbButton,
  UbConfirmDialog,
  UbDateInput,
  UbField,
  UbFilterChip,
  UbForm,
  UbMoneyInput,
  UbPhoneInput,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant, selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { addDaysIso } from 'src/utils/calendarDays';
import { todayInTenantTz } from 'src/utils/dates';

import { PartyPickerField } from '../../parties/components/PartyPickerField';
import {
  CAME_WITH,
  createRepair,
  REPAIR_FIELD,
  type CameWith,
  type RepairFormValues,
  type RepairJob,
} from '../api/repairService';
import { useFormDeviceCopy } from '../hooks/useFormDeviceCopy';

const MODES = ['cash', 'upi', 'bank', 'card'] as const;

/**
 * G5 (design `pRepair`) — New repair: the customer (or a walk-in's mobile),
 * the phone and its IMEI, the fault, what came with it, the estimate, when it
 * will be ready, the advance and the lock note. Save keeps the job; the
 * advance is a real receipt held for this job, so it needs a saved customer.
 */
export function RepairDrawer({
  onClose,
  onSaved,
}: Readonly<{
  onClose: () => void;
  /** `sendSlip`: "Save and send slip" — the page offers the slip on WhatsApp next. */
  onSaved: (job: RepairJob, sendSlip: boolean) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const timezone = useAppSelector(selectTenantTimezone);
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const [errors, setErrors] = useState<readonly string[]>([]);
  // Which of the two dock buttons submitted the form.
  const sendSlip = useRef(false);
  // The same choice for rendering: which button shows the spinner.
  const [slipMode, setSlipMode] = useState(false);
  const form = useForm<RepairFormValues>({
    defaultValues: {
      partyId: '',
      partyName: '',
      walkInMobile: '',
      phoneModel: '',
      imei: '',
      fault: '',
      cameWith: ['phone'],
      estimate: '',
      readyBy: addDaysIso(today, 2),
      advance: '',
      advanceMode: 'cash',
      lockNote: '',
    },
  });
  const tenantId = useAppSelector(selectActiveTenant)?.id ?? '';
  const copy = useFormDeviceCopy(`repair-new:${tenantId}`, form);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { setValue, control } = form;
  const partyId = useWatch({ control, name: 'partyId' });
  const partyName = useWatch({ control, name: 'partyName' });
  const cameWith = useWatch({ control, name: 'cameWith' });
  const advance = useWatch({ control, name: 'advance' });

  const submit = useCallback(
    async (values: RepairFormValues) => {
      try {
        const job = await createRepair(values, copy.clientKey);
        copy.clear();
        onSaved(job, sendSlip.current);
      } catch (thrown) {
        const error = thrown as ApiErrorShape;
        const details = Object.fromEntries(
          Object.entries((error.details ?? {}) as Record<string, unknown>).map(([key, value]) => [
            REPAIR_FIELD[key] ?? key,
            value,
          ])
        );
        setErrors(applyServerErrors({ ...error, details }, form.setError, Object.values(REPAIR_FIELD), t));
      }
    },
    [onSaved, form.setError, t, copy]
  );
  const busy = form.formState.isSubmitting;

  return (
    <UbDrawer
      open
      onOpenChange={(next) => {
        if (next) return;
        if (form.formState.isDirty) {
          setConfirmLeave(true);
          return;
        }
        copy.clear();
        onClose();
      }}
      title={t('sales.repair.new')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!form.formState.isDirty}
      footer={
        // Design pRepair's dock: Save (soft) beside "Save and send slip" (the CTA), both lg.
        <UbBox className="grid w-full grid-cols-2 gap-2">
          <UbButton
            type="submit"
            form={formId}
            variant="secondary"
            size="lg"
            busy={busy && !slipMode}
            disabled={busy}
            onClick={() => {
              sendSlip.current = false;
              setSlipMode(false);
            }}
            data-testid="repair-save"
          >
            {t('sales.repair.save')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            size="lg"
            busy={busy && slipMode}
            disabled={busy}
            onClick={() => {
              sendSlip.current = true;
              setSlipMode(true);
            }}
            data-testid="repair-save-send"
          >
            {t('sales.repair.saveAndSend')}
          </UbButton>
        </UbBox>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={errors}>
        {copy.restored && (
          <UbText variant="caption" tone="secondary" data-testid="form-restored">
            {t('sales.repair.restored')}
          </UbText>
        )}
        <UbField name="partyId" label={t('sales.repair.customer')} hint={t('sales.repair.customerHint')}>
          {(field) => (
            <PartyPickerField
              field={field}
              pickedName={partyName}
              onPick={(id, name) => {
                setValue('partyId', id, { shouldDirty: true });
                setValue('partyName', name);
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
        {!partyId && (
          <UbField name="walkInMobile" label={t('sales.repair.walkInMobile')}>
            {(field) => (
              <UbPhoneInput {...field} value={(field.value as string) ?? ''} onChange={field.onChange} />
            )}
          </UbField>
        )}
        <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <UbField name="phoneModel" label={t('sales.repair.phone')}>
            {(field) => (
              <UbTextInput {...field} value={field.value as string} maxLength={80} placeholder={t('sales.repair.phonePlaceholder')} />
            )}
          </UbField>
          <UbField name="imei" label={t('sales.repair.imei')}>
            {(field) => <UbTextInput {...field} value={field.value as string} maxLength={20} inputMode="numeric" />}
          </UbField>
        </UbBox>
        <UbField name="fault" label={t('sales.repair.fault')}>
          {(field) => (
            <UbTextInput {...field} value={field.value as string} maxLength={200} placeholder={t('sales.repair.faultPlaceholder')} />
          )}
        </UbField>
        <UbField name="cameWith" label={t('sales.repair.cameWith')} controlOwnsLabel>
          {() => (
            /* Design pRepair "Came with": several may be ticked, so each is a toggle. */
            <UbStack direction="row" gap={2} className="flex-wrap" role="group" aria-label={t('sales.repair.cameWith')}>
              {CAME_WITH.map((value) => (
                <UbFilterChip
                  key={value}
                  label={t(`sales.repair.came.${value}`)}
                  pressed={cameWith.includes(value)}
                  onToggle={(on) =>
                    setValue(
                      'cameWith',
                      on ? [...cameWith, value] : cameWith.filter((one: CameWith) => one !== value),
                      { shouldDirty: true }
                    )
                  }
                />
              ))}
            </UbStack>
          )}
        </UbField>
        <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <UbField name="estimate" label={t('sales.repair.estimate')}>
            {(field) => <UbMoneyInput {...field} value={(field.value as string) ?? ''} />}
          </UbField>
          <UbField name="readyBy" label={t('sales.repair.readyBy')}>
            {(field) => (
              <UbDateInput
                name={field.name}
                value={(field.value as string) || null}
                min={today}
                onChange={(next) => field.onChange(next ?? '')}
                aria-label={t('sales.repair.readyBy')}
              />
            )}
          </UbField>
        </UbBox>
        <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <UbField name="advance" label={t('sales.repair.advance')} hint={partyId ? undefined : t('sales.repair.advanceHint')}>
            {(field) => <UbMoneyInput {...field} value={(field.value as string) ?? ''} disabled={!partyId} />}
          </UbField>
          <UbField name="lockNote" label={t('sales.repair.lock')} optionalLabel={t('common.field.optional')}>
            {(field) => <UbTextInput {...field} value={field.value as string} maxLength={60} placeholder={t('sales.repair.lockPlaceholder')} />}
          </UbField>
        </UbBox>
        {Number(advance) > 0 && (
          <UbField name="advanceMode" label={t('sales.repair.advanceMode')}>
            {(field) => (
              <UbSelect
                id={field.id}
                aria-label={t('sales.repair.advanceMode')}
                value={field.value as string}
                options={MODES.map((value) => ({ value, label: t(`sales.repair.mode.${value}`) }))}
                onChange={field.onChange}
              />
            )}
          </UbField>
        )}
      </UbForm>
      <UbConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t('sales.repair.leaveTitle')}
        description={t('sales.repair.leaveBody')}
        confirmLabel={t('sales.repair.leave')}
        cancelLabel={t('sales.repair.stay')}
        closeLabel={t('common.action.close')}
        onConfirm={() => {
          copy.clear();
          onClose();
        }}
      />
    </UbDrawer>
  );
}
