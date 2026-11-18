'use client';

import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbBox,
  UbButton,
  UbField,
  UbInfoRow,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbSwitch,
  UbText,
} from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { getTodayRates, PURITIES, type Purity } from '../../inventory/api/metalRateService';
import { priceOldGold } from '../view-model/jewelPrice';

import type { InvoiceFormValues, OldGoldForm } from '../view-model/invoiceForm';
import type { UseFormReturn } from 'react-hook-form';

/** How a tested purity reads at the counter: "22K · 91.6%". */
const TESTED: Record<Purity, string> = {
  gold_24k: '24K · 99.9%',
  gold_22k: '22K · 91.6%',
  gold_18k: '18K · 75%',
  silver: 'Silver · 99.9%',
};

const EMPTY: OldGoldForm = { weightG: '', purity: 'gold_22k', rate: '', lessPct: '' };

/**
 * G2c — design G2: old gold taken in against this bill. On the bill it is one
 * card ("8.200 g · 22K tested 91.6% · less 2%  − ₹93,619.40", Edit); the sheet
 * asks the weight, the tested purity, the rate (today's) and the melting
 * deduction, shows how the value is reached, and "Take ₹… off" puts it on the
 * bill. It is a purchase from the customer: the server keeps it in its own
 * old-gold stock and settles it against the bill as no money moved.
 */
export function OldGoldSection({
  form,
  disabled,
  t,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  disabled: boolean;
  t: TranslateFn;
}>): React.JSX.Element {
  const current = form.watch('oldGold') ?? null;
  const [editing, setEditing] = useState<OldGoldForm | null>(null);
  const [rates, setRates] = useState<Readonly<Record<string, string | null>>>({});
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    void getTodayRates(controller.signal)
      .then((today) => {
        const got: Readonly<Record<string, string | null>> = today.today?.rates ?? {};
        setRates(got);
        // Today's rate arrives after the sheet opens: fill it if nothing is typed.
        setEditing((was) =>
          was && !was.rate && got[was.purity as Purity]
            ? { ...was, rate: got[was.purity as Purity] ?? '' }
            : was
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [editing]);
  const priced = priceOldGold(current);
  const draft = editing;
  const parts = priceOldGold(draft);
  const set = (patch: Partial<OldGoldForm>) =>
    setEditing((was) => {
      const next = { ...(was ?? EMPTY), ...patch };
      // A purity chosen with no rate typed takes today's rate for it.
      if (patch.purity && !(was?.rate ?? '')) next.rate = rates[patch.purity] ?? '';
      return next;
    });
  const open = () => setEditing(current ?? { ...EMPTY, rate: rates.gold_22k ?? '' });

  return (
    <>
      {current && priced ? (
        <UbStack
          gap={2}
          className="rounded-xl border border-border-hairline bg-surface-card p-4"
          data-testid="old-gold-card"
        >
          <UbStack direction="row" justify="between" align="center">
            <UbText variant="body-sm-medium">{t('sales.oldGold.title')}</UbText>
            <UbButton variant="ghost" size="sm" onClick={open} disabled={disabled}>
              {t('sales.oldGold.edit')}
            </UbButton>
          </UbStack>
          <UbStack direction="row" justify="between" align="center" className="gap-3">
            <UbText variant="body-sm" tone="secondary" className="ds-num min-w-0">
              {t('sales.oldGold.summary', {
                weight: current.weightG,
                purity: TESTED[current.purity as Purity] ?? current.purity,
                less: Number(current.lessPct || 0).toString(),
              })}
            </UbText>
            <UbText
              variant="body-sm-medium"
              tone="error"
              className="ds-num shrink-0"
              data-testid="old-gold-value"
            >
              {`− ${formatInr(priced.value)}`}
            </UbText>
          </UbStack>
        </UbStack>
      ) : (
        <UbButton
          variant="secondary"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={open}
          disabled={disabled}
          className="self-start"
          data-testid="old-gold-add"
        >
          {t('sales.oldGold.add')}
        </UbButton>
      )}
      {draft && (
        <UbDrawer
          open
          onOpenChange={(next) => (next ? undefined : setEditing(null))}
          title={t('sales.oldGold.title')}
          closeLabel={t('common.action.close')}
          footer={
            <>
              {current ? (
                <UbButton
                  variant="ghost"
                  className="text-error"
                  onClick={() => {
                    form.setValue('oldGold', null, { shouldDirty: true });
                    setEditing(null);
                  }}
                >
                  {t('sales.oldGold.remove')}
                </UbButton>
              ) : (
                <UbButton variant="secondary" onClick={() => setEditing(null)}>
                  {t('common.action.cancel')}
                </UbButton>
              )}
              <UbButton
                disabled={!parts || Number(parts.value) <= 0}
                onClick={() => {
                  form.setValue('oldGold', draft, { shouldDirty: true });
                  setEditing(null);
                }}
                data-testid="old-gold-take"
              >
                {parts
                  ? t('sales.oldGold.take', { amount: formatInr(parts.value) })
                  : t('sales.oldGold.takeEmpty')}
              </UbButton>
            </>
          }
        >
          <UbStack gap={4} data-testid="old-gold-sheet">
            <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <UbField name="oldGold.weightG" label={t('sales.oldGold.weight')}>
                {(field) => (
                  <UbQuantityInput
                    id={field.id}
                    value={draft.weightG}
                    onChange={(next) => set({ weightG: next })}
                    decimals={3}
                    unit="g"
                    autoFocus
                  />
                )}
              </UbField>
              <UbField name="oldGold.purity" label={t('sales.oldGold.purity')}>
                {(field) => (
                  <UbSelect
                    id={field.id}
                    aria-label={t('sales.oldGold.purity')}
                    value={draft.purity}
                    options={PURITIES.map((p) => ({ value: p, label: TESTED[p] }))}
                    onChange={(next) => set({ purity: next })}
                  />
                )}
              </UbField>
              <UbField name="oldGold.rate" label={t('sales.oldGold.rate')}>
                {(field) => (
                  <UbMoneyInput
                    id={field.id}
                    value={draft.rate}
                    onChange={(next) => set({ rate: next })}
                    unit="/ g"
                  />
                )}
              </UbField>
              <UbField name="oldGold.lessPct" label={t('sales.oldGold.less')}>
                {(field) => (
                  <UbQuantityInput
                    id={field.id}
                    value={draft.lessPct}
                    onChange={(next) => set({ lessPct: next })}
                    decimals={2}
                    unit="%"
                  />
                )}
              </UbField>
            </UbBox>
            {parts && (
              <UbStack
                gap={0}
                className="divide-y divide-border-hairline rounded-lg border border-border-hairline px-3.5"
                data-testid="old-gold-breakdown"
              >
                <UbInfoRow
                  className="min-h-11"
                  label={t('sales.oldGold.gross', {
                    weight: draft.weightG,
                    rate: formatInr(draft.rate || '0'),
                  })}
                  value={formatInr(parts.gross)}
                />
                <UbInfoRow
                  className="min-h-11"
                  label={t('sales.oldGold.lessRow', { pct: Number(draft.lessPct || 0).toString() })}
                  value={`− ${formatInr(parts.less)}`}
                />
                <UbInfoRow
                  className="min-h-11"
                  variant="total"
                  label={t('sales.oldGold.value')}
                  value={formatInr(parts.value)}
                />
              </UbStack>
            )}
            <UbSwitch
                  checked={Boolean(draft.cashBack)}
                  onCheckedChange={(on) => setEditing({ ...draft, cashBack: on })}
                  label={t('sales.oldGold.cashBack')}
                  description={t('sales.oldGold.cashBackHint')}
                  data-testid="old-gold-cash-back"
                />
                <UbText variant="caption" tone="tertiary">
              {t('sales.oldGold.note')}
            </UbText>
          </UbStack>
        </UbDrawer>
      )}
    </>
  );
}
