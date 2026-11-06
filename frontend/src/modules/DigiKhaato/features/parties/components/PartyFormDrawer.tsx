'use client';

import { useCallback, useEffect, useId, useMemo, useState, type RefObject } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useFormState, useWatch } from 'react-hook-form';

import { PhoneContactButton } from 'src/components/contacts/PhoneContactButton';
import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbAvatar,
  UbBox,
  UbButton,
  UbDateInput,
  UbDisclosure,
  UbField,
  UbForm,
  UbLink,
  UbMoneyInput,
  UbPhoneInput,
  UbRadioGroup,
  UbSelect,
  UbStack,
  UbStatusBanner,
  UbSwitch,
  UbText,
  UbTextInput,
  isoFinancialYearStart,
  isoToday,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useTranslation } from 'src/hooks/useTranslation';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { partyPath } from 'src/routes';
import { blurIfTyped } from 'src/utils/autofocusBlur';
import { cn } from 'src/utils/cn';
import { compareMoney, formatAmount, parseAmountInput } from 'src/utils/money';

import { getParty } from '../api/partyService';
import { MAX_TAGS_PER_PARTY } from '../constants/partyTags';
import { useCanSearchParties } from '../hooks/usePartySearch';
import { usePartyTags } from '../hooks/usePartyTags';
import { usePartySchemas } from '../validation/partySchemas';

import { PartyPickerField } from './PartyPickerField';
import { PartyTagField } from './PartyTagField';

import type { PartyKind } from '../constants/partyFilters';
import type { UsePartyFormResult } from '../hooks/usePartyForm';
import type { PartyDetail, PartyFormValues } from '../types/party.types';

function PartyNameInput({
  t,
  hintKey = 'parties.form.name.hint',
}: Readonly<{ t: TranslateFn; hintKey?: string }>): React.JSX.Element {
  const { isSubmitted } = useFormState();
  return (
    <UbField
      name="name"
      label={t('parties.form.name.label')}
      placeholder={t('parties.form.name.placeholder')}
      required
    >
      {(field) => (
        <UbTextInput
          {...field}
          onBlur={blurIfTyped(field, isSubmitted)}
          autoFocus
          autoComplete="off"
          placeholder={t(hintKey)}
        />
      )}
    </UbField>
  );
}

function OpeningAmountInput({
  t,
  required = false,
}: Readonly<{ t: TranslateFn; required?: boolean }>): React.JSX.Element {
  return (
    <UbField
      name="openingAmount"
      label={t('parties.form.opening.amount')}
      placeholder={t('parties.form.opening.amount.placeholder')}
      required={required}
    >
      {(field) => <UbMoneyInput {...field} />}
    </UbField>
  );
}

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/parties';
import 'src/i18n/catalogues/validation';

/**
 * PTY-01 — add or edit a party.
 *
 * ── Three fields, then everything else ──────────────────────────────────────
 * A merchant standing at a counter with a customer waiting must be able to add
 * a name and a number and get back to work. So the form opens on exactly that:
 * name, mobile, and whether this is someone they sell to, buy from, or both.
 * Twenty other fields exist and every one of them is behind a disclosure that
 * starts closed.
 *
 * The temptation is to show the GST section because it looks important. It is
 * important to the accountant who fills it in once a quarter, and it is in the
 * way of the person adding their fourth customer of the morning.
 *
 * ── A drawer, not a dialog ──────────────────────────────────────────────────
 * At twenty-odd fields a 420 px centred card is a letterbox, and it hides the
 * list the merchant was working from — which matters, because adding a party is
 * almost always something done in the middle of another job. `UbDrawer` is a
 * bottom sheet on a phone and a right-hand panel on a desktop, so the list
 * stays visible beside it.
 */
export function PartyFormDrawer({
  form: partyForm,
  returnFocusRef,
  kind,
  shop = false,
  quickKhata = false,
}: Readonly<{
  form: UsePartyFormResult;
  shop?: boolean;
  /** Personal Udhaar: name/mobile only, then open the person's history. */
  quickKhata?: boolean;
  /** Opened from Suppliers: a new party is a supplier unless the merchant says otherwise. */
  kind?: PartyKind;
  /** Focus target on close when the opener is gone (QA D1) — the khata's ⋯. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { partySchema } = usePartySchemas();
  const formId = useId();
  /* Unconditional: the thunk's own `condition` decides whether a request goes
     out, so three screens asking at once still costs one (§19.3.5). */
  const { byUsage: tagOptions } = usePartyTags();
  // Who cannot search contacts is not offered a search that says so.
  const canSearchContacts = useCanSearchParties();

  const {
    open,
    isEdit,
    editing,
    prefillName,
    isSaving,
    canWrite: canCreate,
    canEdit,
    formErrors,
    duplicateOf,
    duplicateArchived,
    close,
    submit,
  } = partyForm;
  /* Editing an existing party is the owner's or an admin's (12 Oct 2026); adding
     one stays with the write right. The page hides Edit already — this keeps
     the drawer read-only if it is ever opened on a party some other way. */
  const canWrite = isEdit ? canEdit : canCreate;
  /* Opened from Customers or Suppliers, the drawer says the word the button
     said ("Add customer" answered by "Add customer"); from the Udhaar book or
     the all-parties list it stays "party" (WP-07). */
  /* The Shop's lists fix the role: Add on Customers makes a customer. The
     Udhaar book and the plain /parties list still ask. */
  const fixedRole: PartyKind | undefined = shop ? kind : undefined;
  const byKind = kind === 'customer' ? '.customer' : kind === 'supplier' ? '.supplier' : '';

  const valuesFor = useCallback(
    (party: PartyDetail | null): PartyFormValues => {
      const editing = party;
      return {
        /* `prefillName` is the search term the merchant had typed when the list
         came back empty and they pressed "Add 'ramesh'". It is only ever set
         for a create, so the edit branch cannot be shadowed by it. */
        name: editing?.name ?? prefillName,
        mobile: editing?.mobile ?? '',
        isCustomer: editing?.isCustomer ?? kind !== 'supplier',
        isSupplier: editing?.isSupplier ?? kind === 'supplier',
        displayCode: editing?.displayCode ?? '',
        altPhone: editing?.altPhone ?? '',
        email: editing?.email ?? '',
        gstin: editing?.gstin ?? '',
        stateCode: editing?.stateCode ?? '',
        billingLine1: editing?.billingAddress?.line1 ?? '',
        billingCity: editing?.billingAddress?.city ?? '',
        billingPincode: editing?.billingAddress?.pincode ?? '',
        notes: editing?.notes ?? '',
        creditLimit: editing?.creditLimit ?? '',
        creditDays: editing?.creditDays != null ? String(editing.creditDays) : '',
        collectionDate: editing?.collectionDate ?? '',
        smsOptIn: editing?.smsOptIn ?? true,
        consentSource: editing?.consentSource ?? '',
        /* The names, not the ids: the picker creates inline and the server
         resolves a name to a tag inside the party's own transaction. */
        tags: editing?.tags.map((tag) => tag.name) ?? [],
        openingAmount: '',
        /* A6 — the Shop's old balance is still-to-collect on a customer and
           still-to-pay on a supplier, in the Shop's own book (DEC-019). */
        openingDirection: fixedRole === 'supplier' ? 'credit' : 'debit',
        ...(fixedRole ? { openingBook: 'shop' as const } : {}),
        /* UAT D6 (CR-LOG): today, not the year start — a default the merchant
         did not choose must not claim an age (aging counts an opening from its
         date). The hint asks for the real date; "Year start" is a chip. */
        openingAsOf: isoToday(),
      };
    },
    [prefillName, kind, fixedRole]
  );
  const defaults = useMemo(() => valuesFor(editing), [valuesFor, editing]);

  const form = useForm<PartyFormValues>({
    resolver: yupResolver(partySchema),
    mode: 'onTouched',
    defaultValues: defaults,
  });

  const { reset, setError, formState } = form;

  /**
   * Reset when the drawer OPENS, not when it closes: clearing on close races
   * the closing animation and blanks the fields while they are still on screen,
   * and throws away what was typed if a stray tap dismissed it.
   */
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  /* A6, R-DEC-61 — the rare person who is already in the other list (a
     supplier who also buys) is PICKED, like a phone contact, rather than
     asked about with a switch on every add. Picking fills the form from their
     saved record, so the save is a PATCH that adds the role and keeps every
     saved field (a blank form would have wiped their tags and notes). */
  const [linked, setLinked] = useState<{ id: string; name: string; already: boolean } | null>(null);
  /* A typed search is typing too: a stray tap outside must not take it (the
     A5 rule), and the picker keeps its query out of the form's dirty state. */
  const [searchTyped, setSearchTyped] = useState(false);
  // A pick belongs to one opening of the drawer: cleared when it opens again
  // (React's adjust-state-on-prop-change pattern, not an effect).
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setLinked(null);
      setSearchTyped(false);
    }
  }
  const pickExisting = useCallback(
    async (id: string) => {
      if (!fixedRole) return;
      const { party } = await getParty(id, undefined, 'shop');
      const already = fixedRole === 'customer' ? party.isCustomer : party.isSupplier;
      setLinked({ id, name: party.name, already });
      if (already) return;
      reset({
        ...valuesFor(party),
        isCustomer: party.isCustomer || fixedRole === 'customer',
        isSupplier: party.isSupplier || fixedRole === 'supplier',
      });
    },
    [fixedRole, reset, valuesFor]
  );
  const clearLinked = useCallback(() => {
    setLinked(null);
    reset(defaults);
  }, [reset, defaults]);

  const handleSubmit = useCallback(
    async (values: PartyFormValues) => {
      const saved = await submit(
        values,
        setError,
        quickKhata,
        linked && !linked.already ? linked.id : undefined
      );
      if (quickKhata && !isEdit && saved) router.push(partyPath(saved.id));
    },
    [submit, setError, quickKhata, isEdit, router, linked]
  );

  /**
   * A section opens itself when something inside it is wrong. The server can
   * refuse a GSTIN the merchant typed into a group they have since folded away,
   * and an error nobody can see is an error nobody can fix.
   */
  const errors = formState.errors;
  const gstHasError = Boolean(
    errors.gstin ?? errors.stateCode ?? errors.billingLine1 ?? errors.billingPincode ?? errors.email
  );
  const creditHasError = Boolean(errors.creditLimit ?? errors.creditDays);
  const openingHasError = Boolean(errors.openingAmount);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close]
  );

  const directionOptions = useMemo(
    () => [
      {
        value: 'debit',
        label: t(quickKhata ? 'parties.khata.opening.youGave' : 'parties.form.opening.debit'),
      },
      {
        value: 'credit',
        label: t(quickKhata ? 'parties.khata.opening.youGot' : 'parties.form.opening.credit'),
      },
    ],
    [t, quickKhata]
  );

  /**
   * "They already owe ₹47,500 — this limit is already crossed."
   *
   * Watched rather than read once, so it appears while the merchant is typing
   * the figure rather than after they save it. `editing` only: a party being
   * created owes nothing yet, so there is nothing to cross.
   *
   * `useWatch`, not `form.watch()`. The latter returns a function the React
   * Compiler cannot memoize safely, so it skips memoizing THIS WHOLE COMPONENT
   * — a three-hundred-line form with twenty-odd controls — to display one hint.
   * The compiler says so as a warning rather than an error, which is exactly
   * the kind of cost that gets paid silently. Every other watcher in this
   * codebase uses `useWatch` for the same reason.
   */
  const typedLimit = useWatch({ control: form.control, name: 'creditLimit' });
  /* D6 — the as-of hint asks "when did THEY / YOU start owing this". */
  const openingDirection = useWatch({ control: form.control, name: 'openingDirection' });
  const creditHint = useMemo(() => {
    /* `parseAmountInput` FIRST, and this is not tidiness.
 
       `UbMoneyInput` groups as the merchant types, so the value reaching here
       is "10,000.00" rather than "10000.00" — and `toDecimal` stops at the
       comma. The hint therefore worked for any figure under a thousand and
       silently stopped working for every realistic credit limit, which is the
       worst possible place for it to stop: a merchant lowering a cap to ₹10,000
       on somebody who owes ₹47,500 is exactly who the notice is for.
 
       Caught by a test that typed "9" and passed, beside one that typed "10000"
       and did not. */
    const typed = parseAmountInput(typedLimit ?? '');
    if (!isEdit || !editing || !typed.trim()) return undefined;
    /* String comparison would say "9" is more than "47500". `compareMoney`
       parses both with decimal.js-light, which is the only arithmetic this
       component does and the only kind canon rule 3 allows on money. */
    if (compareMoney(editing.balance, typed) <= 0) return undefined;
    /* `formatAmount`, not `formatInr`: the message is "They already owe
       ₹{balance} — …" and the symbol belongs to the SENTENCE, because Hindi
       puts it elsewhere in the line. A formatter that carried its own produced
       "₹₹47,500.00", which is the second time this exact pair of mistakes has
       met in this feature — see `creditCaption`. */
    return t('parties.credit.alreadyCrossed', { balance: formatAmount(editing.balance) });
  }, [isEdit, editing, typedLimit, t]);

  const consentOptions = useMemo(
    () =>
      ['verbal', 'form', 'link'].map((value) => ({
        value,
        label: t(`parties.form.consent.${value}`),
      })),
    [t]
  );

  const contactPickButton =
    !isEdit && canWrite ? (
      <PhoneContactButton
        onPick={(contact) => {
          form.setValue('name', contact.name, { shouldDirty: true, shouldValidate: true });
          form.setValue('mobile', contact.mobile, { shouldDirty: true, shouldValidate: true });
        }}
        label={t('parties.form.phoneContact.choose')}
        errorMessage={t('parties.form.phoneContact.error')}
        disabled={isSaving}
      />
    ) : null;
  const mobileInput = (
    <UbField
      name="mobile"
      label={t('parties.form.mobile.label')}
      placeholder={t(
        fixedRole ? 'parties.form.shop.mobile.placeholder' : 'parties.form.mobile.placeholder'
      )}
      hint={t(
        quickKhata
          ? 'parties.khata.mobileHint'
          : fixedRole === 'supplier'
            ? 'parties.form.mobile.hintSupplier'
            : 'parties.form.mobile.hint'
      )}
    >
      {(field) => <UbPhoneInput {...field} autoComplete="off" />}
    </UbField>
  );
  const openingDirectionInput = (
    <UbField name="openingDirection" label={t('parties.form.opening.direction')}>
      {(field) => (
        <UbRadioGroup
          {...field}
          options={directionOptions}
          className={quickKhata && !isEdit ? 'grid grid-cols-2 gap-2' : undefined}
        />
      )}
    </UbField>
  );

  const gstinField = (
    <UbField
      name="gstin"
      label={t('parties.form.gstin.label')}
      placeholder={t('parties.form.gstin.placeholder')}
    >
      {(field) => <UbTextInput {...field} uppercase autoComplete="off" />}
    </UbField>
  );
  const gstRestFields = (
    <>
      <UbField
        name="stateCode"
        label={t('parties.form.state.label')}
        placeholder={t('parties.form.state.placeholder')}
      >
        {(field) => <UbTextInput {...field} uppercase maxLength={2} autoComplete="off" />}
      </UbField>
      <UbField
        name="email"
        label={t('parties.form.email.label')}
        placeholder={t('parties.form.email.placeholder')}
      >
        {(field) => <UbTextInput {...field} type="email" autoComplete="off" />}
      </UbField>
      <UbField
        name="billingLine1"
        label={t('parties.form.address.line1')}
        placeholder={t('parties.form.address.line1.placeholder')}
      >
        {(field) => <UbTextInput {...field} autoComplete="off" />}
      </UbField>
      <UbField
        name="billingCity"
        label={t('parties.form.address.city')}
        placeholder={t('parties.form.address.city.placeholder')}
      >
        {(field) => <UbTextInput {...field} autoComplete="off" />}
      </UbField>
      <UbField
        name="billingPincode"
        label={t('parties.form.address.pincode')}
        placeholder={t('parties.form.address.pincode.placeholder')}
      >
        {(field) => <UbTextInput {...field} inputMode="numeric" autoComplete="off" />}
      </UbField>
    </>
  );
  const gstFields = (
    <>
      {gstinField}
      {gstRestFields}
    </>
  );
  const remindersFields = (
    <>
      <UbField name="smsOptIn" label={t('parties.form.sms.label')} controlOwnsLabel>
        {(field) => (
          <UbSwitch
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            label={t('parties.form.sms.label')}
            description={t('parties.form.sms.hint')}
            id={field.id}
          />
        )}
      </UbField>
      <UbField name="consentSource" label={t('parties.form.consent.label')}>
        {(field) => (
          <UbSelect
            {...field}
            options={consentOptions}
            placeholder={t('parties.form.consent.placeholder')}
          />
        )}
      </UbField>
    </>
  );
  const tagsField = (
    <UbField
      name="tags"
      label={t('parties.tags.field.label')}
      placeholder={t('parties.tags.field.placeholder')}
      hint={t('parties.tags.field.hint', { max: MAX_TAGS_PER_PARTY })}
    >
      {(field) => (
        <PartyTagField
          t={t}
          id={field.id}
          value={(field.value as string[] | undefined) ?? []}
          onChange={field.onChange}
          tags={tagOptions}
          disabled={!canWrite}
          invalid={Boolean(errors.tags)}
          aria-describedby={field['aria-describedby']}
        />
      )}
    </UbField>
  );
  /* Credit days sets each Shop bill's due date; it is a customer's setting. */
  const creditDaysTop =
    fixedRole === 'customer' ? (
      <UbField
        name="creditDays"
        label={t('parties.form.creditDays.label')}
        placeholder={t('parties.form.creditDays.placeholder')}
        hint={t('parties.form.creditDays.hint')}
      >
        {(field) => <UbTextInput {...field} inputMode="numeric" autoComplete="off" />}
      </UbField>
    ) : null;

  const otherRole = fixedRole === 'customer' ? 'supplier' : 'customer';
  const existingPicker =
    fixedRole && !isEdit && canWrite && canSearchContacts ? (
      <>
        {!linked && (
          <UbBox
            className="contents"
            onInput={(event: React.FormEvent<HTMLElement>) =>
              setSearchTyped(Boolean((event.target as HTMLInputElement).value))
            }
          >
            <UbField
              name="existingContact"
              label={t(`parties.form.shop.link.label.${fixedRole}`)}
              placeholder={t(`parties.form.shop.link.placeholder.${fixedRole}`)}
              hint={t('parties.form.shop.link.hint')}
            >
              {(field) => (
                <PartyPickerField
                  field={field}
                  pickedName=""
                  onPick={(id) => void pickExisting(id)}
                  labels={{
                    clear: (name) => t('parties.form.shop.link.clear', { name }),
                    noAccess: t('parties.form.shop.link.noAccess'),
                    results: t('parties.form.shop.link.results'),
                    noMatch: t('parties.form.shop.link.noMatch'),
                    create: (name) => t(`parties.form.shop.link.useNew.${fixedRole}`, { name }),
                  }}
                  onCreate={(name) =>
                    form.setValue('name', name, { shouldDirty: true, shouldValidate: true })
                  }
                  t={t}
                  type={otherRole}
                  book="shop"
                  disabled={isSaving}
                  testId="existing-contact"
                />
              )}
            </UbField>
          </UbBox>
        )}
        {/* The picked contact, drawn as A3's saved-customer box (the
            artifact's own reference for "this person is chosen"): avatar, name
            and Change, then what will happen, so a long name never squeezes
            into a column beside the action. */}
        {linked && (
          <UbStack gap={1}>
            <UbBox
              data-testid="linked-contact"
              className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-[10px] border border-border-hairline px-3.5 py-3"
            >
              <UbAvatar name={linked.name} className="row-span-2 h-9 w-9 self-start" />
              <UbBox className="flex min-w-0 items-center justify-between gap-3">
                <UbText
                  variant="body-medium"
                  className="min-w-0 truncate text-[0.9375rem] font-semibold text-text-primary"
                >
                  {linked.name}
                </UbText>
                <UbButton
                  variant="ghost"
                  size="sm"
                  onClick={clearLinked}
                  className="ub-hit h-auto shrink-0 px-0 py-0 text-[0.875rem] font-semibold text-text-accent hover:bg-transparent"
                >
                  {t('parties.form.shop.linked.change')}
                </UbButton>
              </UbBox>
              <UbText
                variant="caption"
                className={cn(
                  'text-[0.8125rem] leading-5',
                  linked.already ? 'text-warning' : 'text-text-tertiary'
                )}
              >
                {t(
                  linked.already
                    ? `parties.form.shop.linked.already.${fixedRole}`
                    : `parties.form.shop.linked.line.${fixedRole}`
                )}
              </UbText>
            </UbBox>
            {!linked.already && (
              <UbText variant="caption" tone="tertiary" className="text-[12.5px]">
                {t('parties.form.shop.linked.body')}
              </UbText>
            )}
          </UbStack>
        )}
      </>
    ) : null;

  return (
    <UbDrawer
      className={
        quickKhata
          ? 'max-lg:[&>div:last-child]:grid max-lg:[&>div:last-child]:grid-cols-[1fr_1.5fr] max-lg:[&_input]:h-11'
          : undefined
      }
      open={open}
      onOpenChange={handleOpenChange}
      title={
        quickKhata
          ? t(isEdit ? 'parties.khata.edit' : 'parties.khata.add')
          : isEdit
            ? t(fixedRole ? `parties.form.shop.title.edit.${fixedRole}` : 'parties.form.title.edit')
            : t(`parties.form.title.create${byKind}`)
      }
      description={
        isEdit || quickKhata
          ? undefined
          : fixedRole
            ? fixedRole === 'supplier'
              ? t('parties.form.shop.subtitle.supplier')
              : undefined
            : t('parties.form.subtitle')
      }
      closeLabel={t('common.action.close')}
      // A stray tap on the backdrop must not take a half-filled form with it.
      dismissOnBackdrop={!formState.isDirty && !searchTyped && !linked}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <UbButton variant="secondary" onClick={close} disabled={isSaving}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            busy={isSaving}
            busyLabel={t('parties.form.submitting')}
            disabled={!canWrite}
          >
            {isEdit
              ? t('parties.form.submit.edit')
              : quickKhata
                ? t('parties.khata.saveAndOpen')
                : fixedRole
                  ? t(`parties.form.shop.submit.${fixedRole}`)
                  : t(`parties.form.submit.create${byKind}`)}
          </UbButton>
        </>
      }
    >
      <UbForm id={formId} form={form} onSubmit={handleSubmit} formErrors={formErrors}>
        {!canWrite && <UbStatusBanner tone="info" title={t('parties.form.readOnly')} />}

        {duplicateOf && (
          /* The server refuses a duplicate with the existing party's ID and
             deliberately not its name — that is another record's data. So this
             offers to open it rather than naming it, and the ordinary detail
             read decides whether the name may be shown. */
          /* An ARCHIVED holder is off the list, so "already in your book"
             names somebody the merchant cannot see; its page is where Restore
             is, which is the way back rather than a second record. */
          <UbStatusBanner
            tone="warning"
            title={t(
              duplicateArchived
                ? 'parties.form.duplicate.archived.title'
                : 'parties.form.duplicate.title'
            )}
            description={t(
              duplicateArchived
                ? 'parties.form.duplicate.archived.body'
                : 'parties.form.duplicate.body'
            )}
            action={
              <UbLink href={partyPath(duplicateOf)} variant="body-sm">
                {t(
                  duplicateArchived
                    ? 'parties.form.duplicate.archived.open'
                    : 'parties.form.duplicate.open'
                )}
              </UbLink>
            }
          />
        )}

        {quickKhata ? (
          <>
            {contactPickButton}
            <PartyNameInput t={t} />
            {mobileInput}
          </>
        ) : (
          <>
            {/* ── The fifteen-second path ─────────────────────────────────────── */}
            {/* One contact from the phone fills Name and Mobile, and saves nothing:
            Save does, and the server's duplicate check still decides (PTY-07
            FR-10). A new party only, and nothing at all where the browser
            cannot pick contacts — no dead button on every desktop (FR-14). */}
            {contactPickButton}
            {existingPicker}
            <PartyNameInput
              t={t}
              hintKey={fixedRole ? `parties.form.shop.name.placeholder.${fixedRole}` : undefined}
            />

            {/* `UbPhoneInput`, not a text field with `type="tel"`. The schema's
            rule is E.164 (`+91XXXXXXXXXX`), and a merchant types ten digits —
            so a plain field turns "9812345678" into a format error about a
            prefix nobody asked them for. This component shows the national
            digits and commits E.164. */}
            {mobileInput}

            {/* Two switches rather than a three-way "Customer / Supplier / Both".
            Both is not a third kind of party — it is both boxes ticked — and a
            segmented control that has to invent a word for the combination is
            a control explaining its own implementation.

            In the Shop the list the merchant came from has already answered
            the question (owner, 25 Oct 2026): Add on Customers is a customer.
            So the pair is not asked there, and the one case it existed for —
            somebody who is both — is a single switch under "More details". */}
            {!fixedRole && (
              <>
                <UbField name="isCustomer" label={t('parties.form.isCustomer')} controlOwnsLabel>
                  {(field) => (
                    <UbSwitch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      label={t('parties.form.isCustomer')}
                      id={field.id}
                    />
                  )}
                </UbField>
                <UbField name="isSupplier" label={t('parties.form.isSupplier')} controlOwnsLabel>
                  {(field) => (
                    <UbSwitch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      label={t('parties.form.isSupplier')}
                      id={field.id}
                    />
                  )}
                </UbField>
              </>
            )}

            {/* PTY-05 FR-5 — visible, not folded, and that is a deliberate
            exception to this form's own rule.
 
            Everything past the first three fields is behind a disclosure
            because it is in the way of somebody adding their fourth customer of
            the morning. Tags are the one addition that EARNS its place there:
            the flow the feature exists for is "type Camp, press Create, save"
            at the counter (FRD PTY-05 §6), and a tag behind a fold is a tag
            nobody applies — which makes the filter, the bulk dialog and the
            manager furniture around an empty table.
 
            It is last in the visible group, so the fifteen-second path is still
            name, number, which-kind, save, with tags sitting where the eye lands
            after the decision rather than before it. */}
            {!fixedRole && tagsField}

            {/* ── Everything else, folded away ───────────────────────────────── */}
            {!isEdit && !shop && (
              <UbDisclosure
                label={t('parties.form.section.opening')}
                hint={t('parties.form.section.opening.hint')}
                open={openingHasError || undefined}
              >
                <OpeningAmountInput t={t} />
                {openingDirectionInput}
                <UbField
                  name="openingAsOf"
                  label={t('parties.form.opening.asOf')}
                  placeholder={t('parties.form.opening.asOf.placeholder')}
                  hint={t('parties.form.opening.asOf.hint', { direction: openingDirection })}
                >
                  {(field) => (
                    <UbDateInput
                      {...field}
                      max={isoToday()}
                      quickChoicesLabel={t('parties.form.opening.quickDates')}
                      quickChoices={[
                        { label: t('parties.form.opening.fyStart'), date: isoFinancialYearStart() },
                        { label: t('parties.form.opening.today'), date: isoToday() },
                      ]}
                    />
                  )}
                </UbField>
                {/* What happens to the figure: the server posts it as the khata's
                first entry in the party's own transaction (LED-02 FR-2). The
                old line promised it would "join the balance when entries
                arrive", from before that was true (UAT D8). */}
                <UbText variant="caption" tone="tertiary">
                  {t('parties.form.opening.postedOnSave')}
                </UbText>
              </UbDisclosure>
            )}

            {!fixedRole && (
              <UbDisclosure label={t('parties.form.section.gst')} open={gstHasError || undefined}>
                {gstFields}
              </UbDisclosure>
            )}

            {/* DEC-019 — the collection date is the Udhaar book's promise; the Shop keeps its
            own per-role promises on the person page (BP-16), so its form does not ask.
            Removed from the Shop form at the owner's word, 25 Oct 2026. */}
            {!shop && (
              <UbDisclosure
                label={t('parties.form.section.credit')}
                open={creditHasError || undefined}
              >
                {/* PTY-06 FR-13 — a NOTICE, not an error.
 
              Lowering a limit below what somebody already owes is allowed and
              is often the whole point: a merchant who has decided to stop
              lending to this person is doing it precisely when they are owed
              the most. Refusing it would trap them, and it reverses nothing
              already posted (BR-10). So the form says what will be true and
              lets them save.
 
              `hint` rather than a banner, because it belongs to this field and
              disappears with it. It is computed from the balance the form
              already has, so there is no request behind it. */}
                <UbField
                  name="creditLimit"
                  label={t('parties.form.creditLimit.label')}
                  placeholder={t('parties.form.creditLimit.placeholder')}
                  hint={creditHint}
                >
                  {(field) => <UbMoneyInput {...field} />}
                </UbField>
                <UbField
                  name="creditDays"
                  label={t('parties.form.creditDays.label')}
                  placeholder={t('parties.form.creditDays.placeholder')}
                  hint={t('parties.form.creditDays.hint')}
                >
                  {(field) => <UbTextInput {...field} inputMode="numeric" autoComplete="off" />}
                </UbField>
                <UbField
                  name="collectionDate"
                  label={t('parties.form.collectionDate.label')}
                  placeholder={t('parties.form.collectionDate.placeholder')}
                >
                  {(field) => <UbDateInput {...field} />}
                </UbField>
              </UbDisclosure>
            )}

            {/* A6 F5/F6 — the Shop has ONE "More details", open, with the
            design's subtitle. Its customer form leads with reminders and the
            supplier form with the GSTIN; GST, address, phone, notes and tags
            are kept inside it rather than dropped (R-DEC-29: no capability is
            removed without the owner's word). */}
            <UbDisclosure
              label={t('parties.form.section.other')}
              hint={fixedRole ? t(`parties.form.shop.more.hint.${fixedRole}`) : undefined}
              open={(fixedRole && gstHasError) || undefined}
            >
              {fixedRole === 'supplier' && gstinField}
              <UbField
                name="displayCode"
                label={t('parties.form.code.label')}
                placeholder={t('parties.form.code.placeholder')}
              >
                {(field) => <UbTextInput {...field} autoComplete="off" />}
              </UbField>
              {/* A6 F6 — the design's order: code, then reminders (customer) or
                  the GSTIN (supplier); the kept fields follow. Credit days is
                  in here too (R-DEC-61): the counter asks a name and a number. */}
              {fixedRole && !isEdit && !linked && (
                <UbField
                  name="openingAmount"
                  label={t(`parties.form.shop.old.label.${fixedRole}`)}
                  placeholder={t('parties.form.shop.old.placeholder')}
                  hint={t('parties.form.shop.old.hint')}
                >
                  {(field) => <UbMoneyInput {...field} />}
                </UbField>
              )}
              {creditDaysTop}
              {fixedRole === 'customer' && remindersFields}
              {fixedRole === 'customer' && gstinField}
              {fixedRole && gstRestFields}
              <UbField
                name="altPhone"
                label={t('parties.form.altPhone.label')}
                placeholder={t('parties.form.altPhone.placeholder')}
              >
                {(field) => <UbPhoneInput {...field} autoComplete="off" />}
              </UbField>
              <UbField
                name="notes"
                label={t('parties.form.notes.label')}
                placeholder={t('parties.form.notes.placeholder')}
              >
                {(field) => <UbTextInput {...field} autoComplete="off" />}
              </UbField>
              {fixedRole && tagsField}
              {/* Reminders and their consent are about money a CUSTOMER owes; a
              supplier is paid, not reminded. */}
              {!fixedRole && remindersFields}
            </UbDisclosure>
          </>
        )}
      </UbForm>
    </UbDrawer>
  );
}
