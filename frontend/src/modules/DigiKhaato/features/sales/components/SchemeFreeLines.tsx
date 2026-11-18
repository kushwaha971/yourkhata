'use client';

import { Gift } from 'lucide-react';

import { UbStack, UbText } from 'src/design-system';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import type { SchemeRow } from '../api/schemeService';
import type { InvoiceLineForm } from '../view-model/invoiceForm';
import type { SchemeDiscount, SchemeFreeLine, SchemeRule } from '../view-model/schemes';

/** G9 — what the running schemes do to the bill being typed (the editor's preview). */
export interface SchemePreview {
  readonly running: readonly SchemeRow[];
  readonly discounts: readonly (SchemeDiscount | null)[];
  readonly free: readonly SchemeFreeLine[];
  readonly offer: { readonly scheme: SchemeRule; readonly short: string } | null;
}

const qty = (raw: string | null | undefined) => (raw ? String(Number(raw)) : '');

/** "Scheme 10 + 1 free", "Scheme ₹40 off each", "Scheme 2% off". */
export const schemeRuleText = (scheme: SchemeRule, t: TranslateFn): string => {
  if (scheme.rule === 'free') return t('sales.scheme.ruleFree', { buy: qty(scheme.buy_qty), free: qty(scheme.free_qty) });
  if (scheme.rule === 'per_unit') return t('sales.scheme.rulePerUnit', { amount: formatInr(scheme.amount ?? '0') });
  return t('sales.scheme.rulePercent', { pct: qty(scheme.amount), amount: formatInr(scheme.min_bill ?? '0') });
};

/** The caption under a bill line a scheme counts or discounts. */
export const schemeLineText = (
  schemes: SchemePreview,
  index: number,
  itemId: string,
  t: TranslateFn
): string => {
  const applied = schemes.discounts[index];
  const scheme =
    (applied && schemes.running.find((s) => s.code === applied.scheme)) ||
    schemes.running.find((s) => s.rule === 'free' && s.item_id === itemId);
  return scheme ? t('sales.scheme.onLine', { code: scheme.code, rule: schemeRuleText(scheme, t) }) : '';
};

/** Design pScheme: the free case as a ₹0 line, and the nearest offer still open. */
export function SchemeFreeLines({
  schemes,
  lines,
}: Readonly<{ schemes: SchemePreview; lines: readonly InvoiceLineForm[] }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const offer = schemes.offer;
  const offerScheme = offer ? schemes.running.find((s) => s.code === offer.scheme.code) : undefined;
  if (schemes.free.length === 0 && !offer) return null;
  return (
    <UbStack gap={2} data-testid="scheme-lines">
      {schemes.free.map((free) => {
        const name = lines.find((line) => line.itemId === free.item_id)?.description ?? '';
        return (
          <UbStack
            key={`${free.scheme}-${free.item_id}`}
            direction="row"
            gap={2}
            className="items-center justify-between rounded-card border border-border-hairline bg-surface-card px-4 py-3"
            data-testid="scheme-free-line"
          >
            <UbStack gap={0} className="min-w-0">
              <UbText variant="body-sm" className="font-semibold">
                {t('sales.scheme.freeName', { name })}
              </UbText>
              <UbText variant="caption" tone="secondary">
                {t('sales.scheme.freeFrom', { qty: qty(free.qty), unit: free.unit_code, code: free.scheme })}
              </UbText>
            </UbStack>
            <UbText variant="body-sm" tone="success" className="shrink-0 font-semibold">
              {formatInr('0')}
            </UbText>
          </UbStack>
        );
      })}
      {offer && (
        <UbStack direction="row" gap={2} className="items-start rounded-card bg-surface-sunken px-4 py-3" data-testid="scheme-offer">
          <Gift aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-text-accent" />
          <UbText variant="body-sm">
            {t('sales.scheme.offer', {
              amount: formatInr(offer.short),
              name: offerScheme?.item?.name ?? t('sales.scheme.thisBill'),
              pct: qty(offer.scheme.amount),
              date: offerScheme ? formatBusinessDate(offerScheme.valid_till) : '',
            })}
          </UbText>
        </UbStack>
      )}
    </UbStack>
  );
}
