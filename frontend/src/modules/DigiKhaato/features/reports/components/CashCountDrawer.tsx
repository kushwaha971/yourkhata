'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import { CompactDrawer } from 'src/components/records/CompactOverlays';
import { DEFAULT_TENANT_TIMEZONE } from 'src/constants';
import {
  UbBox,
  UbButton,
  UbDivider,
  UbField,
  UbForm,
  UbMoneyInput,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDegradedNetwork } from 'src/hooks/useDegradedNetwork';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { formatBusinessDate, todayInTenantTz } from 'src/utils/dates';
import { absMoney, formatInr, isZeroAmount } from 'src/utils/money';

import { listCashCounts, recordCashCount } from '../api/cashCountService';
import { useCashCountSchema, type CashCountFormValues } from '../validation/cashCountSchema';
import {
  VARIANCE_TONE,
  countedWhen,
  typedVariance,
  varianceWords,
} from '../view-model/cashCountDisplay';

import type { CashCount } from '../types/reports.types';

// Loaded with dynamic(), so its words come with its own chunk.
import 'src/i18n/catalogues/reports';
import 'src/i18n/catalogues/money';
import 'src/i18n/catalogues/validation';

const FIELDS = ['countedAmount', 'note'] as const;
const WIRE_TO_FORM: Record<string, string> = { counted_amount: 'countedAmount' };

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly counts: readonly CashCount[];
      readonly expectedNow: string;
    };

/**
 * BP-17 (R-DEC-26) — "count the drawer": the owner types what is physically
 * there and sees, in words, whether it matches the Shop's cash by its records.
 *
 * The figure shown while typing is the server's as of opening the drawer; the
 * figure the saved count is compared with is the server's AT the save, inside
 * the same transaction, so a sale rung up while counting is never read from a
 * stale tile. A count posts nothing: no adjustment, no payment, no expense.
 * Saving needs a connection for that reason (`online-only`), not a queue.
 */
export function CashCountDrawer({
  open,
  since,
  onClose,
  onSaved,
}: Readonly<{
  open: boolean;
  /** The day the records' figure counts from, when opening cash is left out. */
  since?: string | null;
  onClose: () => void;
  onSaved: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const timezone = useAppSelector(selectTenantTimezone) ?? undefined;
  const today = useMemo(() => todayInTenantTz(timezone), [timezone]);
  const { canWrite: canWriteIn } = useDegradedNetwork();
  const canWrite = canWriteIn('online-only');
  const { key, rotate } = useIdempotencyKey();
  const schema = useCashCountSchema();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [saved, setSaved] = useState<CashCount | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<readonly string[]>([]);
  const [attempt, setAttempt] = useState(0);

  const form = useForm<CashCountFormValues>({
    resolver: yupResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { countedAmount: '', note: '' },
  });
  const { setError, formState } = form;
  const counted = useWatch({ control: form.control, name: 'countedAmount' });

  /* Mounted by its opener only while counting, so each opening starts with an
     empty form and a fresh records figure. */
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    listCashCounts(controller.signal)
      .then((result) => setLoad({ status: 'ready', ...result }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'failed' });
      });
    return () => controller.abort();
  }, [open, attempt]);

  const inFlight = useRef(false);
  const submit = useCallback(
    async (values: CashCountFormValues) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFormErrors([]);
      try {
        const count = await recordCashCount(values, key);
        // The key now names this count; another count is a new one.
        rotate();
        setSaved(count);
        setLoad((prev) =>
          prev.status === 'ready'
            ? {
                status: 'ready',
                counts: [count, ...prev.counts],
                expectedNow: count.expectedAmount,
              }
            : prev
        );
        dispatch(
          showSnackbar({
            severity: 'success',
            id: 'reports.cashCount.saved',
            params: { result: varianceWords(t, count.variance).text },
          })
        );
        onSaved();
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
        }
        /* Anything else has been toasted by the interceptor; the drawer keeps
           what was typed and Save resends it with the SAME key. */
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [key, rotate, dispatch, t, onSaved, setError]
  );

  const expected = load.status === 'ready' ? load.expectedNow : null;
  const preview = expected === null ? null : typedVariance(counted ?? '', expected);
  const previewWords = preview === null ? null : varianceWords(t, preview);
  const earlier = load.status === 'ready' ? load.counts.filter((c) => c.id !== saved?.id) : [];

  return (
    <CompactDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('reports.cashCount.title')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!formState.isDirty || saved !== null}
      footer={
        saved ? (
          <UbButton onClick={onClose} data-testid="cash-count-done">
            {t('reports.cashCount.close')}
          </UbButton>
        ) : (
          <UbButton
            type="submit"
            form={formId}
            busy={saving}
            busyLabel={t('reports.cashCount.saving')}
            disabled={!canWrite || load.status !== 'ready'}
            data-testid="cash-count-save"
          >
            {t('reports.cashCount.save')}
          </UbButton>
        )
      }
    >
      <UbStack gap={4} data-testid="cash-count-drawer">
        <UbStack gap={1} data-testid="cash-count-records">
          <UbText variant="caption" tone="secondary" className="font-semibold">
            {t('reports.cashCount.records')}
          </UbText>
          {load.status === 'loading' && <UbSkeleton className="h-7 w-28" />}
          {load.status === 'ready' && (
            <UbText as="div" variant="body" className="ds-num text-xl font-bold">
              {formatInr(load.expectedNow)}
            </UbText>
          )}
          <UbText variant="caption" tone="secondary">
            {t('reports.cashCount.recordsHint')}
          </UbText>
          {since && (
            <UbText variant="caption" tone="secondary" data-testid="cash-count-since">
              {t('reports.home.cashBasis', { date: formatBusinessDate(since) })}
            </UbText>
          )}
        </UbStack>

        {load.status === 'failed' && (
          <UbStatusBanner
            tone="error"
            title={t('reports.cashCount.loadFailed')}
            action={
              <UbButton
                size="sm"
                variant="outlineNeutral"
                onClick={() => {
                  setLoad({ status: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              >
                {t('reports.cashCount.retry')}
              </UbButton>
            }
          />
        )}
        {!canWrite && <UbStatusBanner tone="info" title={t('reports.cashCount.offline')} />}

        {saved ? (
          <UbStack gap={1} data-testid="cash-count-result" role="status">
            <UbText
              variant="h3"
              tone={VARIANCE_TONE[varianceWords(t, saved.variance).kind]}
              className="ds-num"
            >
              {varianceWords(t, saved.variance).text}
            </UbText>
            <UbText variant="body-sm" tone="secondary" className="ds-num">
              {t('reports.cashCount.against', { amount: formatInr(saved.expectedAmount) })}
            </UbText>
          </UbStack>
        ) : (
          <UbForm id={formId} form={form} onSubmit={submit} formErrors={formErrors}>
            <UbField
              name="countedAmount"
              label={t('reports.cashCount.counted')}
              placeholder={t('reports.cashCount.placeholder')}
              required
            >
              {(field) => <UbMoneyInput {...field} autoFocus inputMode="decimal" />}
            </UbField>
            {previewWords && (
              <UbText
                variant="body-sm-medium"
                tone={VARIANCE_TONE[previewWords.kind]}
                className="ds-num"
                data-testid="cash-count-preview"
                aria-live="polite"
              >
                {previewWords.text}
              </UbText>
            )}
            <UbField
              name="note"
              label={t('reports.cashCount.note')}
              placeholder={t('reports.cashCount.notePlaceholder')}
            >
              {(field) => <UbTextInput {...field} maxLength={200} />}
            </UbField>
          </UbForm>
        )}
        <UbText variant="caption" tone="secondary">
          {t('reports.cashCount.explain')}
        </UbText>

        {earlier.length > 0 && (
          <UbStack gap={2} as="section" aria-label={t('reports.cashCount.history')}>
            <UbDivider />
            <UbText variant="body-sm-medium">{t('reports.cashCount.history')}</UbText>
            <UbStack gap={3} data-testid="cash-count-history">
              {earlier.map((count) => {
                const words = varianceWords(t, count.variance);
                return (
                  <UbBox key={count.id} className="min-w-0" data-testid="cash-count-row">
                    <UbBox className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <UbText variant="body-sm" className="ds-num">
                        {countedWhen(t, count, today, timezone ?? DEFAULT_TENANT_TIMEZONE)}
                      </UbText>
                      <UbText variant="body-sm-medium" className="ds-num whitespace-nowrap">
                        {formatInr(count.countedAmount)}
                      </UbText>
                    </UbBox>
                    <UbText variant="caption" tone={VARIANCE_TONE[words.kind]} className="ds-num">
                      {words.text}
                    </UbText>
                    {count.movedSince && !isZeroAmount(count.movedSince) && (
                      <UbText
                        variant="caption"
                        tone="secondary"
                        className="ds-num"
                        data-testid="cash-count-moved"
                      >
                        {t('reports.cashCount.moved', {
                          amount: formatInr(absMoney(count.movedSince)),
                        })}
                      </UbText>
                    )}
                    {(count.countedBy || count.note) && (
                      <UbText variant="caption" tone="secondary" className="break-words">
                        {[
                          count.countedBy
                            ? t('reports.cashCount.by', { name: count.countedBy.name })
                            : '',
                          count.note,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </UbText>
                    )}
                  </UbBox>
                );
              })}
            </UbStack>
          </UbStack>
        )}
      </UbStack>
    </CompactDrawer>
  );
}
