'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import { type UseFormReturn } from 'react-hook-form';

import {
  UbDateInput,
  UbDisclosure,
  UbField,
  UbGrid,
  UbPhoneInput,
  UbSegmentedControl,
  UbBox,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
  useIsMobileLayer,
} from 'src/design-system';
import { useDocksEditorTotals } from 'src/hooks/useDocksEditorTotals';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import type { Locale } from 'src/types/domain.types';
import { cn } from 'src/utils/cn';
import { formatBusinessDate } from 'src/utils/dates';

import { ExpensePartyField } from '../../expenses/components/ExpensePartyField';
import { useAppWords } from '../../navigation/useAppWords';
import { GST_STATES } from '../../onboarding/constants/gstStates';
import { getParty } from '../../parties/api/partyService';
import {
  defaultPlaceOfSupply,
  type BillingMode,
  type InvoiceFormValues,
} from '../view-model/invoiceForm';

import { InvoiceCustomerBox } from './InvoiceCustomerBox';

/* The contact form belongs to the chunk that OPENS it (Counter Mode "Add"). */
const PartyQuickCreate = dynamic(
  () => import('../../parties/components/PartyQuickCreate').then((m) => m.PartyQuickCreate),
  { ssr: false }
);

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
  const { w } = useAppWords();
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
  const [shopDue, setShopDue] = useState<{
    partyId: string;
    /** The SHOP balance (due − credit); null when the server has no Shop figures. */
    balance: string | null;
    mobile: string | null;
  } | null>(null);
  /** The name being added as a new customer from the search, while its form is open. */
  const [adding, setAdding] = useState<string | null>(null);
  // A ref, not state: focusing is a side effect of the switch, not a render.
  const focusPicker = useRef(false);
  useEffect(() => {
    if (!focusPicker.current || mode !== 'party') return;
    focusPicker.current = false;
    document.querySelector<HTMLInputElement>('[data-testid=invoice-party-picker] input')?.focus();
  }, [mode]);
  const { can } = usePermissions();
  const mayAdd = can('parties.party.write');
  const stopAdding = useCallback(() => setAdding(null), []);
  const createLabel = useCallback((name: string) => t('sales.party.addNew', { name }), [t]);
  // Picker and person-page shortcuts share one defaulting path. A manual
  // invoice-specific state is never overwritten by a late contact response.
  useEffect(() => {
    if (mode !== 'party' || !partyId) return;
    const controller = new AbortController();
    void getParty(partyId, controller.signal, 'shop')
      .then(({ party }) => {
        if (controller.signal.aborted || form.getValues('partyId') !== partyId) return;
        if (!disabled && !form.getValues('placeOfSupplyState'))
          setValue('placeOfSupplyState', defaultPlaceOfSupply(party, tenantState));
        // A3: `party.shop`, never `summary.balance` — that is the main
        // (Udhaar) book, and a Shop bill printed another book's money.
        setShopDue({
          partyId,
          balance: party.shop?.customerBalance ?? null,
          mobile: party.mobile,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mode, partyId, disabled, form, setValue, tenantState]);
  const loaded = shopDue && shopDue.partyId === partyId ? shopDue : null;
  const interState = !!pos && pos !== tenantState;

  const modeOptions = useMemo(
    () => [
      { value: 'walkIn' as BillingMode, label: t('sales.walkIn.label') },
      // Through the word layer: a business that calls its customers
      // "Retailers" says "Saved retailer" here once BP-22 sends its words.
      { value: 'party' as BillingMode, label: w('sales.editor.party') },
    ],
    [t, w]
  );
  const stateOptions = useMemo(
    () => GST_STATES.map((s) => ({ value: s.code, label: `${s[locale]} (${s.code})` })),
    [locale]
  );

  const box = mode === 'party' && partyId && partyName;

  return (
    <UbStack
      gap={3}
      className={cn(
        'p-4',
        // Design §A3 desktop: switch 300 px · the customer · More details 360 px, one row.
        box && 'lg:grid lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:items-center lg:gap-4'
      )}
    >
      {/* Shop item 4 — goods on a challan always go to a named party (SAL-09 §10). */}
      {kind !== 'delivery_challan' && (
        <UbSegmentedControl<BillingMode>
          ariaLabel={t('sales.editor.billTo')}
          value={mode}
          options={modeOptions}
          disabled={disabled}
          onChange={(next) => {
            setValue('mode', next, { shouldDirty: true });
            // Saved customer: the picker takes focus, so a merchant who taps
            // and types does not lose the letters (found by hand, A3 manual).
            if (next === 'party') focusPicker.current = true;
            if (next === 'walkIn') {
              setValue('partyId', null, { shouldDirty: true });
              setValue('partyName', '');
              setValue('placeOfSupplyState', tenantState, { shouldDirty: true });
            }
          }}
        />
      )}
      {box ? (
        <InvoiceCustomerBox
          name={partyName}
          mobile={loaded?.mobile}
          balance={loaded ? loaded.balance : undefined}
          disabled={disabled}
          t={t}
          onChange={() => {
            setValue('partyId', null, { shouldDirty: true });
            setValue('partyName', '');
            setValue('placeOfSupplyState', '', { shouldDirty: true });
          }}
        />
      ) : mode === 'party' ? (
        <UbBox data-testid="invoice-party-picker">
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
                onCreate={mayAdd ? setAdding : undefined}
                createLabel={createLabel}
              />
            )}
          </UbField>
        </UbBox>
      ) : null}
      {adding !== null && (
        <PartyQuickCreate
          name={adding}
          kind="customer"
          onCreated={(id, name) => {
            setValue('partyId', id, { shouldDirty: true });
            setValue('partyName', name);
            setValue('placeOfSupplyState', '', { shouldDirty: true });
          }}
          onClosed={stopAdding}
        />
      )}
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
