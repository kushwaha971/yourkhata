'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbBottomBar,
  UbBox,
  UbButton,
  UbDateInput,
  UbEmptyState,
  UbField,
  UbForm,
  UbMoneyInput,
  UbNativeSelect,
  UbPageHeader,
  UbPageShell,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';
import { todayInTenantTz } from 'src/utils/dates';
import { REGEX } from 'src/utils/regexConstants';

import { Card, Figure, Figures, KeyValue, OwnerOnly, Table } from 'modules/DigiKhaato/features/appParts/AppParts';

import { createLoan, listBorrowers, listRoutes, previewLoan } from '../api/lendingService';
import { useLendingAccess } from '../hooks/useLendingAccess';
import { LENDING_ROUTES } from '../routes';
import { useLendingSchemas } from '../validation/lendingSchemas';
import { rupees, shortDate } from '../view-model/lendingDisplay';

import type { Borrower, Frequency, LoanPreview, NewLoanValues, Route } from '../types/lending.types';

/** The plans a small lender uses, as the design's one select ("Daily · 40 days"). */
const PLANS: readonly { readonly key: string; readonly frequency: Frequency; readonly count: number }[] = [
  { key: 'daily-40', frequency: 'daily', count: 40 },
  { key: 'daily-60', frequency: 'daily', count: 60 },
  { key: 'daily-100', frequency: 'daily', count: 100 },
  { key: 'weekly-10', frequency: 'weekly', count: 10 },
  { key: 'weekly-12', frequency: 'weekly', count: 12 },
  { key: 'weekly-25', frequency: 'weekly', count: 25 },
  { key: 'monthly-6', frequency: 'monthly', count: 6 },
  { key: 'monthly-12', frequency: 'monthly', count: 12 },
];

const tomorrow = (today: string): string => {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * I10 · New loan — amount lent, plan, each day's amount, start date and route.
 * The whole schedule is shown before Save (the server's own), so the borrower
 * can see it too: what will be collected, any charge taken at the start, the
 * last day, and every collection day.
 */
export function NewLoanPageContent({ borrowerId }: Readonly<{ borrowerId?: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const { canLend } = useLendingAccess();
  if (canLend) return <NewLoanForm borrowerId={borrowerId} />;
  return (
    <UbPageShell>
      <OwnerOnly title={t('lending.common.ownerOnly.title')} body={t('lending.common.ownerOnly.body')} />
    </UbPageShell>
  );
}

function NewLoanForm({ borrowerId }: Readonly<{ borrowerId?: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const formId = useId();
  const today = useMemo(() => todayInTenantTz(), []);
  const { newLoanSchema } = useLendingSchemas();
  const { key, rotate } = useIdempotencyKey();
  const [borrowers, setBorrowers] = useState<readonly Borrower[]>([]);
  const [routes, setRoutes] = useState<readonly Route[]>([]);
  const [plan, setPlan] = useState('daily-40');
  const [answer, setAnswer] = useState<{ ask: string; preview: LoanPreview } | null>(null);
  const [saving, setSaving] = useState(false);
  // A failed load is never an empty list of borrowers (H70): it says so, with Try again.
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const form = useForm<NewLoanValues>({
    resolver: yupResolver(newLoanSchema),
    mode: 'onTouched',
    defaultValues: {
      borrowerId: borrowerId ?? '',
      lent: '',
      frequency: 'daily',
      count: '40',
      each: '',
      startsOn: tomorrow(today),
      routeId: '',
      charges: '',
    },
  });
  const values = useWatch({ control: form.control });
  const asked = useDebounce(JSON.stringify(values), 300);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([listBorrowers('', controller.signal), listRoutes(controller.signal)])
      .then(([b, r]) => {
        setLoadFailed(false);
        setBorrowers(b);
        setRoutes(r.filter((x) => x.active));
        const chosen = b.find((x) => x.id === (borrowerId ?? ''));
        if (chosen?.routeId) form.setValue('routeId', chosen.routeId);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted && !(e instanceof DOMException)) setLoadFailed(true);
      });
    return () => controller.abort();
  }, [borrowerId, form, attempt]);

  // The schedule before Save, asked of the server only for numbers it would accept.
  const v = values as NewLoanValues;
  const ready =
    Boolean(v.lent && v.each && v.count) &&
    REGEX.DECIMAL_2DP.test(v.lent ?? '') &&
    REGEX.DECIMAL_2DP.test(v.each ?? '') &&
    Number(v.each) * Number(v.count) >= Number(v.lent);
  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    const ask = asked;
    previewLoan({ ...v, borrowerId: v.borrowerId || 'preview' }, controller.signal)
      .then((preview) => setAnswer({ ask, preview }))
      .catch(() => undefined);
    return () => controller.abort();
    // `asked` carries every value; `v` is read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, asked]);
  const preview = ready && answer?.ask === asked ? answer.preview : null;
  const borrower = borrowers.find((b) => b.id === v.borrowerId);

  const save = async (values: NewLoanValues) => {
    setSaving(true);
    try {
      const loan = await createLoan(values, key);
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'lending.newLoan.saved', params: { number: loan.number, name: loan.borrower } }));
      router.push(LENDING_ROUTES.loan(loan.id));
    } catch (e) {
      const err = toApiError(e, 'lending.newLoan.error');
      if (err.code === 'validation_error') rotate();
      dispatch(showSnackbar({ severity: 'error', message: err.message ?? t('lending.newLoan.error') }));
    } finally {
      setSaving(false);
    }
  };

  const each = t(`lending.newLoan.each.${v.frequency ?? 'daily'}`);
  const fields = (
    <>
      {/* Started from a borrower: the design names them in the subtitle and asks no more. */}
      {!borrowerId && (
      <UbField name="borrowerId" label={t('lending.newLoan.borrower')} required>
        {(field) => (
          <UbNativeSelect
            {...field}
            value={field.value as string}
            onChange={(id) => {
              field.onChange(id);
              const b = borrowers.find((x) => x.id === id);
              if (b?.routeId) form.setValue('routeId', b.routeId);
            }}
            options={[{ value: '', label: t('lending.newLoan.chooseBorrower') }, ...borrowers.map((b) => ({ value: b.id, label: b.name }))]}
          />
        )}
      </UbField>
      )}
      {borrower && (
        <UbText variant="inherit" className="-mt-2 text-[12.5px] text-text-tertiary">
          {[borrower.mobile ? `+91 ${borrower.mobile.slice(0, 5)} ${borrower.mobile.slice(5)}` : null, borrower.loans ? t('lending.newLoan.running', { count: borrower.loans }) : t('lending.newLoan.noneRunning')]
            .filter(Boolean)
            .join(' · ')}
        </UbText>
      )}
      <UbField name="lent" label={t('lending.newLoan.lent')} required>
        {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" className="text-right" />}
      </UbField>
      <UbStack gap={1.5}>
        <UbText variant="inherit" className="text-[13px] font-semibold">
          {t('lending.newLoan.plan')}
        </UbText>
        <UbNativeSelect
          aria-label={t('lending.newLoan.plan')}
          value={plan}
          onChange={(k) => {
            setPlan(k);
            const p = PLANS.find((x) => x.key === k);
            if (p) {
              form.setValue('frequency', p.frequency, { shouldValidate: true });
              form.setValue('count', String(p.count), { shouldValidate: true });
            }
          }}
          options={[
            ...PLANS.map((p) => ({ value: p.key, label: t(`lending.plan.${p.frequency}`, { count: p.count }) })),
            { value: 'other', label: t('lending.newLoan.otherPlan') },
          ]}
        />
      </UbStack>
      {plan === 'other' && (
        <UbBox className="grid grid-cols-2 gap-3">
          <UbField name="frequency" label={t('lending.newLoan.howOften')}>
            {(field) => (
              <UbNativeSelect
                {...field}
                value={field.value as string}
                options={(['daily', 'weekly', 'monthly'] as const).map((f) => ({ value: f, label: t(`lending.frequency.${f}`) }))}
              />
            )}
          </UbField>
          <UbField name="count" label={t('lending.newLoan.count')}>
            {(field) => <UbTextInput {...field} value={field.value as string} inputMode="numeric" />}
          </UbField>
        </UbBox>
      )}
      <UbBox className="grid grid-cols-2 gap-3">
        <UbField name="each" label={each} required>
          {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" className="text-right" />}
        </UbField>
        <UbField name="startsOn" label={t('lending.newLoan.starts')}>
          {(field) => <UbDateInput {...field} value={field.value as string} onChange={(d) => field.onChange(d ?? today)} />}
        </UbField>
      </UbBox>
      <UbField name="routeId" label={t('lending.newLoan.route')}>
        {(field) => (
          <UbNativeSelect
            {...field}
            value={field.value as string}
            options={[{ value: '', label: t('lending.newLoan.noRoute') }, ...routes.map((r) => ({ value: r.id, label: r.name }))]}
          />
        )}
      </UbField>
      <UbField name="charges" label={t('lending.newLoan.charges')} optionalLabel={t('lending.common.optional')} hint={t('lending.newLoan.chargesHint')}>
        {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" className="text-right" />}
      </UbField>
    </>
  );

  const sched = preview?.schedule ?? [];
  const shown = sched.length > 4 ? [...sched.slice(0, 3), null, sched[sched.length - 1]] : sched;
  const ruleLine = preview
    ? t(v.frequency === 'daily' ? 'lending.newLoan.ruleDaily' : 'lending.newLoan.rule', { count: sched.length, amount: rupees(v.each) })
    : '';

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-32 lg:pb-28">
        <UbPageHeader title={t('lending.newLoan.title')} subtitle={borrower?.name ?? t('lending.newLoan.subtitle')} />
        {loadFailed && (
          <UbEmptyState
            variant="error"
            title={t('lending.newLoan.loadError')}
            action={<UbButton onClick={() => setAttempt((n) => n + 1)}>{t('lending.common.tryAgain')}</UbButton>}
          />
        )}
        <UbForm id={formId} form={form} onSubmit={save} className={loadFailed ? 'hidden' : undefined}>
          <UbBox className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:[grid-template-columns:420px_minmax(0,1fr)]">
            <Card className="gap-3.5" testId="lending-new-loan-form">
              {fields}
            </Card>
            <UbStack gap={2.5}>
              {/* Phone: the design's Preview card. */}
              <Card className="lg:hidden" testId="lending-new-loan-preview">
                <UbText variant="inherit" className="font-semibold">
                  {t('lending.newLoan.preview')}
                </UbText>
                {preview ? (
                  <>
                    <KeyValue label={t('lending.newLoan.toCollect')} value={rupees(preview.toCollect)} />
                    <KeyValue label={t('lending.newLoan.chargesAtStart')} value={rupees(addCharges(v.charges))} />
                    <KeyValue label={t('lending.newLoan.inHand')} value={rupees(preview.inHand)} />
                    <KeyValue label={t('lending.newLoan.lastDay')} value={shortDate(preview.lastDay, today)} />
                    <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                      {ruleLine}
                    </UbText>
                  </>
                ) : (
                  <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                    {t('lending.newLoan.previewHint')}
                  </UbText>
                )}
              </Card>
              <UbStack gap={2.5} className="max-lg:hidden">
                {preview ? (
                  <>
                    <Figures testId="lending-new-loan-figures">
                      <Figure label={t('lending.newLoan.toCollect')} value={rupees(preview.toCollect)} caption={t('lending.newLoan.collections', { count: sched.length })} />
                      <Figure label={each} value={rupees(v.each)} caption={v.frequency === 'daily' ? t('lending.newLoan.sundaysSkipped') : t(`lending.frequency.${v.frequency}`)} />
                      <Figure label={t('lending.newLoan.lastDay')} value={shortDate(preview.lastDay, today)} caption={t(`lending.weekday.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${preview.lastDay}T00:00:00`).getDay()]}`)} />
                    </Figures>
                    <Table testId="lending-new-loan-schedule" head={[{ label: '#' }, { label: t('lending.col.date') }, { label: t('lending.col.due'), align: 'right' }]}>
                      {shown.map((r, i) =>
                        r ? (
                          <UbBox as="tr" key={r.seq}>
                            <UbBox as="td">{r.seq}</UbBox>
                            <UbBox as="td">{shortDate(r.dueOn, today)}</UbBox>
                            <UbBox as="td" className="ds-num text-right">
                              {rupees(r.amount)}
                            </UbBox>
                          </UbBox>
                        ) : (
                          <UbBox as="tr" key={`gap-${i}`}>
                            <UbBox as="td">…</UbBox>
                            <UbBox as="td">…</UbBox>
                            <UbBox as="td" className="text-right">
                              …
                            </UbBox>
                          </UbBox>
                        )
                      )}
                    </Table>
                  </>
                ) : (
                  <Card>
                    <UbText variant="inherit" className="text-[13px] text-text-tertiary">
                      {t('lending.newLoan.previewHint')}
                    </UbText>
                  </Card>
                )}
              </UbStack>
            </UbStack>
          </UbBox>
        </UbForm>
      </UbStack>
      <UbBottomBar
        sticky={false}
        className="fixed inset-x-0 bottom-[var(--ub-nav-offset)] z-20 flex items-center gap-2 border-t border-border-hairline bg-surface-card px-4 pb-3.5 pt-2.5 lg:bottom-0 lg:left-[var(--ub-rail-width,232px)] lg:justify-end lg:px-6"
      >
        <UbStack gap={0} className="max-lg:hidden lg:mr-auto">
          <UbText variant="inherit" className="text-[13px] text-text-secondary">
            {t('lending.newLoan.lentTotal')}
          </UbText>
          <UbText variant="inherit" className="ds-num text-[22px] font-extrabold">
            {rupees(v.lent || '0')}
          </UbText>
        </UbStack>
        <UbButton variant="secondary" size="lg" className="max-lg:hidden" onClick={() => router.push(LENDING_ROUTES.today)}>
          {t('lending.common.cancel')}
        </UbButton>
        <UbButton type="submit" form={formId} size="lg" busy={saving} className="max-lg:w-full" data-testid="lending-new-loan-save">
          {t('lending.newLoan.save')}
        </UbButton>
      </UbBottomBar>
    </UbPageShell>
  );
}

/** The charge as typed, or ₹0. */
const addCharges = (v: string | undefined): string => (v && Number(v) > 0 ? v : '0');
