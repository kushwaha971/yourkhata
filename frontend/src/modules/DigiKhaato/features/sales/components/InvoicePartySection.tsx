'use client';

import { useEffect, useMemo, useState } from 'react';

import { type UseFormReturn } from 'react-hook-form';

import {
  UbAmount,
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbDisclosure,
  UbField,
  UbGrid,
  UbPhoneInput,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
  useIsMobileLayer,
} from 'src/design-system';
import { useDocksEditorTotals } from 'src/hooks/useDocksEditorTotals';
import { useTranslation } from 'src/hooks/useTranslation';
import type { Locale } from 'src/types/domain.types';
import { formatBusinessDate } from 'src/utils/dates';

import { ExpensePartyField } from '../../expenses/components/ExpensePartyField';
import { GST_STATES } from '../../onboarding/constants/gstStates';
import { getParty } from '../../parties/api/partyService';
import { balanceView } from '../../parties/view-model/partyDisplay';
import {
  defaultPlaceOfSupply,
  type BillingMode,
  type InvoiceFormValues,
} from '../view-model/invoiceForm';

/**
 * SAL-02 §7 / SAL-07 §7 — who the bill is for, when, and where it is supplied.
 *
 * Walk-in | Party is a segmented control (SAL-07 FR-1); walk-in name and mobile
 * are optional and never demanded before the items (speed first, §8). Picking
 * a party resolves the place of supply from the party's own record, in the
 * server's order (FR-5, `defaultPlaceOfSupply`), so the preview's CGST+SGST or
 * IGST is the split the issued bill will carry (QA S-D1); a walk-in bills at
 * the shop's own state (BR-5).
 * Rendered inside the editor's `UbForm`, whose context every `UbField` reads.
 */
export function InvoicePartySection({
  form,
  today,
  tenantState,
  locale,
  disabled,
  kind = 'invoice',
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  today: string;
  tenantState: string;
  locale: Locale;
  disabled: boolean;
  /** SAL-01 FR-4 — an estimate carries "Valid until" where a bill carries its due date. */
  kind?: 'invoice' | 'estimate' | 'sales_order' | 'delivery_challan';
}>): React.JSX.Element {
  const { t } = useTranslation();
  const isMobileLayer = useIsMobileLayer();
  const folds = useDocksEditorTotals();
  const { watch, setValue } = form;
  const mode = watch('mode');
  const partyName = watch('partyName');
  const documentDate = watch('documentDate');
  const pos = watch('placeOfSupplyState');
  const partyId = watch('partyId');
  /*
   * 07-screens/09 §3 — once a saved customer is picked, the field collapses to
   * one line: who, and what they already owe in the SHOP book (DEC-019 — never
   * the Udhaar book's figure), with Change. One read serves both this and the
   * place of supply.
   */
  const [shopDue, setShopDue] = useState<{ partyId: string; balance: string } | null>(null);
  // Picker and person-page shortcuts share one defaulting path. A manual
  // invoice-specific state is never overwritten by a late contact response.
  useEffect(() => {
    if (mode !== 'party' || !partyId) return;
    const controller = new AbortController();
    void getParty(partyId, controller.signal, 'shop')
      .then(({ party, summary }) => {
        if (controller.signal.aborted || form.getValues('partyId') !== partyId) return;
        if (!disabled && !form.getValues('placeOfSupplyState'))
          setValue('placeOfSupplyState', defaultPlaceOfSupply(party, tenantState));
        setShopDue({ partyId, balance: summary.balance });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mode, partyId, disabled, form, setValue, tenantState]);
  const due = shopDue && shopDue.partyId === partyId ? shopDue.balance : null;
  const dueView = due === null ? null : balanceView(due);
  const interState = !!pos && pos !== tenantState;

  const modeOptions = useMemo(
    () => [
      { value: 'walkIn' as BillingMode, label: t('sales.walkIn.label') },
      { value: 'party' as BillingMode, label: t('sales.editor.party') },
    ],
    [t]
  );
  const stateOptions = useMemo(
    () => GST_STATES.map((s) => ({ value: s.code, label: `${s[locale]} (${s.code})` })),
    [locale]
  );

  return (
    <UbStack gap={3} className="p-4">
      {/* Shop item 4 — goods on a challan always go to a named party (SAL-09 §10). */}
      {kind !== 'delivery_challan' && (
        <UbChoiceChips<BillingMode>
          ariaLabel={t('sales.editor.billTo')}
          value={mode}
          options={modeOptions}
          disabled={disabled}
          onChange={(next) => {
            setValue('mode', next, { shouldDirty: true });
            if (next === 'walkIn') {
              setValue('partyId', null, { shouldDirty: true });
              setValue('partyName', '');
              setValue('placeOfSupplyState', tenantState, { shouldDirty: true });
            }
          }}
        />
      )}
      {mode === 'party' && partyId && partyName ? (
        <UbStack
          direction="row"
          align="center"
          justify="between"
          gap={3}
          wrap
          data-testid="invoice-customer-line"
          className="rounded-control border border-border-hairline px-3 py-2"
        >
          {/* The name owns its line: below ~12rem the figure and Change wrap
              under it rather than squeezing it to "Bose &…" (320 px sweep). */}
          <UbStack gap={0} className="min-w-[12rem] flex-1">
            <UbText variant="caption" tone="tertiary">
              {t('sales.editor.party')}
            </UbText>
            <UbText variant="body-medium" className="line-clamp-2 break-words">
              {partyName}
            </UbText>
          </UbStack>
          {due !== null && dueView && (
            <UbAmount
              value={due}
              tone={dueView.tone}
              sign={dueView.sign}
              label={t(
                dueView.tone === 'receivable'
                  ? 'sales.editor.customerDue'
                  : dueView.tone === 'payable'
                    ? 'sales.editor.customerAdvance'
                    : 'sales.editor.customerSettled'
              )}
              size="sm"
            />
          )}
          <UbButton
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setValue('partyId', null, { shouldDirty: true });
              setValue('partyName', '');
              setValue('placeOfSupplyState', '', { shouldDirty: true });
            }}
          >
            {t('sales.editor.changeCustomer')}
          </UbButton>
        </UbStack>
      ) : mode === 'party' ? (
        <UbField
          name="partyId"
          label={t('sales.editor.party')}
          placeholder={t('sales.editor.partyPlaceholder')}
        >
          {(field) => (
            <ExpensePartyField
              type="customer"
              disabled={disabled}
              field={{ ...field, value: field.value ?? '' }}
              partyName={partyName}
              t={t}
              onPick={(id, name) => {
                field.onChange(id || null);
                setValue('partyName', name);
                setValue('placeOfSupplyState', '', { shouldDirty: true });
              }}
            />
          )}
        </UbField>
      ) : null}
      {/* docs/mobile-redesign (A14) — on a phone the details that rarely change
          (walk-in name and mobile, the dates, the place of supply) fold under
          one line that says what they are, so the items come first. A desktop
          renders them exactly as before. */}
      {(() => {
        const details = (
          <>
            {mode !== 'party' && (
              <UbGrid columns={{ base: 1, sm: 2 }} gap={3}>
                <UbField
                  name="walkInName"
                  label={t('sales.walkIn.name')}
                  placeholder={t('sales.walkIn.namePlaceholder')}
                >
                  {(field) => <UbTextInput {...field} maxLength={120} disabled={disabled} />}
                </UbField>
                <UbField
                  name="walkInMobile"
                  label={t('sales.walkIn.mobile')}
                  placeholder={t('sales.walkIn.mobilePlaceholder')}
                >
                  {(field) => <UbPhoneInput {...field} disabled={disabled} />}
                </UbField>
              </UbGrid>
            )}
            <UbGrid columns={{ base: 1, sm: 3 }} gap={3}>
              <UbField name="documentDate" label={t('sales.editor.date')}>
                {(field) => (
                  <UbDateInput
                    id={field.id}
                    value={field.value as string}
                    onChange={(next) => field.onChange(next ?? today)}
                    max={today}
                    disabled={disabled}
                  />
                )}
              </UbField>
              {kind === 'estimate' && (
                <UbField
                  name="validUntil"
                  label={t('sales.estimate.validUntil')}
                  placeholder={t('sales.estimate.validUntilPlaceholder')}
                >
                  {(field) => (
                    <UbDateInput
                      id={field.id}
                      value={(field.value as string) || null}
                      onChange={(next) => field.onChange(next ?? '')}
                      min={documentDate}
                      placeholder={field.placeholder}
                      disabled={disabled}
                    />
                  )}
                </UbField>
              )}
              {kind === 'invoice' && mode === 'party' && (
                <UbField
                  name="dueOn"
                  label={t('sales.editor.dueOn')}
                  placeholder={t('sales.editor.dueOnPlaceholder')}
                >
                  {(field) => (
                    <UbDateInput
                      id={field.id}
                      value={(field.value as string) || null}
                      onChange={(next) => field.onChange(next ?? '')}
                      min={documentDate}
                      placeholder={field.placeholder}
                      disabled={disabled}
                    />
                  )}
                </UbField>
              )}
              <UbField name="placeOfSupplyState" label={t('sales.editor.pos')}>
                {(field) => (
                  <UbSelect
                    id={field.id}
                    aria-label={t('sales.editor.pos')}
                    value={(field.value as string) || null}
                    placeholder={t('sales.editor.posFromParty')}
                    options={stateOptions}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                )}
              </UbField>
            </UbGrid>
            <UbText variant="caption" tone="tertiary">
              {interState ? t('sales.editor.interState') : t('sales.editor.intraState')}
            </UbText>
          </>
        );
        /* WP-05 extends the phone's fold to every width below 1536 px. A walk-in
           bill on a laptop opens it, because the name is still to type; an
           error inside forces it open, since a hidden error cannot be fixed. */
        if (!folds) return details;
        const posLabel = stateOptions.find((option) => option.value === pos)?.label;
        const dueOn = kind === 'invoice' && mode === 'party' ? form.getValues('dueOn') : '';
        const { errors } = form.formState;
        const mustOpen = !!(
          errors.documentDate ??
          errors.dueOn ??
          errors.validUntil ??
          errors.placeOfSupplyState ??
          errors.walkInName ??
          errors.walkInMobile
        );
        return (
          <UbDisclosure
            label={t('sales.editor.moreDetails')}
            hint={[
              formatBusinessDate(documentDate),
              dueOn && `${t('sales.editor.dueOn')} ${formatBusinessDate(dueOn)}`,
              posLabel,
            ]
              .filter(Boolean)
              .join(' · ')}
            defaultOpen={!isMobileLayer && mode !== 'party'}
            open={mustOpen ? true : undefined}
          >
            <UbStack gap={3}>{details}</UbStack>
          </UbDisclosure>
        );
      })()}
    </UbStack>
  );
}
