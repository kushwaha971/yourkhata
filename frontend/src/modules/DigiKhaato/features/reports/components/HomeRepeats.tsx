'use client';
import { useState } from 'react';

import dynamic from 'next/dynamic';

import { UbBox, UbButton, UbActionLink, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { formatInr } from 'src/utils/money';

import { groupLabels } from '../view-model/chartDisplay';

import type { RepeatSource } from '../api/counterService';
const Expense = dynamic(() => import('./RepeatExpense').then((m) => m.RepeatExpense), {
  ssr: false,
});
export function HomeRepeats({
  sources,
}: Readonly<{ sources: readonly RepeatSource[] }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const locale = useAppSelector(selectLocale);
  const { can } = usePermissions();
  const [expense, setExpense] = useState<RepeatSource | null>(null);
  const visible = sources.filter((s) =>
    can(
      s.kind === 'sale'
        ? 'sales.invoice.write'
        : s.kind === 'purchase'
          ? 'purchases.bill.write'
          : 'expenses.expense.write'
    )
  );
  if (!visible.length) return null;
  return (
    <UbBox className="hidden space-y-2 lg:block">
      <UbBox className="flex flex-wrap items-center gap-2">
        <UbText variant="caption" tone="secondary">
          {t('reports.home.repeat')}
        </UbText>
        {visible.map((s) =>
          s.kind === 'expense' ? (
            <UbButton
              key={s.id}
              variant="outlineNeutral"
              size="sm"
              className="h-auto min-h-8 whitespace-normal rounded-full px-3 py-1 text-left font-normal"
              onClick={() => setExpense(s)}
            >
              {t('reports.home.repeatExpense', { name: s.name, amount: formatInr(s.amount) })}
            </UbButton>
          ) : (
            <UbActionLink
              key={s.id}
              variant="outlineNeutral"
              size="sm"
              className="h-auto min-h-8 whitespace-normal rounded-full px-3 py-1 text-left font-normal"
              href={`${s.kind === 'sale' ? '/sales/invoices' : '/purchases/bills'}/new?repeat=${encodeURIComponent(s.id)}`}
            >
              {t(s.kind === 'sale' ? 'reports.home.repeatSale' : 'reports.home.repeatPurchase', {
                name: s.name,
                date: groupLabels(s.date, 'day', locale, t).longLabel,
              })}
            </UbActionLink>
          )
        )}
      </UbBox>
      <UbText variant="caption" tone="secondary">
        {t('reports.home.repeatBasis')}
      </UbText>
      {expense && <Expense source={expense} onClose={() => setExpense(null)} />}
    </UbBox>
  );
}
