'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { Printer, Share2 } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbEmptyState,
  UbNativeSelect,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectSessionUser } from 'src/redux/slice/sessionSlice';
import { cn } from 'src/utils/cn';
import { todayInTenantTz } from 'src/utils/dates';

import { selectMoneyBook } from '../redux/moneybookSlice';
import { fetchPeople, fetchReport } from '../redux/moneybookThunks';
import { MONEYBOOK_ROUTES } from '../routes';
import { KIND_WORD, rupees, shortDate } from '../view-model/moneybookDisplay';

import { Figure } from './MoneyBookParts';

type Period = 'this_month' | 'last_month' | 'this_year' | 'pick';
const PERIODS: readonly Period[] = ['this_month', 'last_month', 'this_year', 'pick'];

const pad = (n: number): string => String(n).padStart(2, '0');
const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The dates a period means, from today (IST). */
export const periodRange = (period: Period, today: string): { from: string; to: string } | null => {
  const [y, m] = today.split('-').map(Number) as [number, number];
  if (period === 'this_month') return { from: `${y}-${pad(m)}-01`, to: today };
  if (period === 'last_month') {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` };
  }
  if (period === 'this_year') return { from: `${y}-01-01`, to: today };
  return null;
};

/**
 * I3 · Report. Everyone, or one person, for any dates: what you gave and got in
 * the period, and what stands now. Share PDF and Print open the browser's own
 * print sheet (ADR-021: client PDF through `window.print()`, no PDF library),
 * where a phone offers Save as PDF and Share.
 */
export function ReportPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const params = useSearchParams();
  const book = useAppSelector(selectMoneyBook);
  const user = useAppSelector(selectSessionUser);
  const today = useMemo(() => todayInTenantTz(), []);
  const person = params.get('person') ?? '';
  const [period, setPeriod] = useState<Period>('this_month');
  const [picked, setPicked] = useState({ from: today, to: today });
  const range = period === 'pick' ? picked : periodRange(period, today);
  const badRange = Boolean(range && range.from > range.to);

  useEffect(() => {
    const request = dispatch(fetchPeople({ page: 1, pageSize: 100, sort: 'name' }));
    return () => request.abort();
  }, [dispatch]);
  useEffect(() => {
    if (badRange) return undefined;
    const request = dispatch(
      fetchReport({ person: person || undefined, from: range?.from, to: range?.to })
    );
    return () => request.abort();
  }, [dispatch, person, range?.from, range?.to, badRange]);

  const people = book.people?.rows ?? [];
  const who = person
    ? (people.find((p) => p.id === person)?.name ?? '')
    : t('moneybook.report.all');
  const scope = range
    ? t('moneybook.report.scope', {
        who,
        from: shortDate(range.from, today),
        to: shortDate(range.to, today),
      })
    : t('moneybook.report.scopeAll', { who });
  const report = book.report;
  const s = report?.summary;

  const table = (() => {
    if (badRange) return <UbStatusBanner tone="error" title={t('moneybook.report.badRange')} />;
    if (book.reportStatus === 'failed')
      return (
        <UbEmptyState
          variant="error"
          title={t('moneybook.report.error')}
          action={
            <UbButton
              onClick={() =>
                dispatch(
                  fetchReport({ person: person || undefined, from: range?.from, to: range?.to })
                )
              }
            >
              {t('moneybook.common.tryAgain')}
            </UbButton>
          }
        />
      );
    if (!report)
      return <UbSkeleton variant="list" count={6} label={t('moneybook.common.loading')} />;
    if (report.rows.length === 0)
      return (
        <UbEmptyState
          variant="filtered"
          title={t('moneybook.report.empty.title')}
          description={t('moneybook.report.empty.body')}
        />
      );
    return (
      <UbBox className="overflow-x-auto rounded-xl border border-border-hairline bg-surface-card print:overflow-visible">
        <UbBox
          as="table"
          className="w-full min-w-[560px] border-collapse text-[13.4px] [&_td]:border-b [&_td]:border-border-hairline [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_tr:last-child>td]:border-b-0"
          data-testid="moneybook-report-table"
        >
          <UbBox
            as="thead"
            className="bg-surface-sunken text-left text-[11.8px] text-text-secondary"
          >
            <UbBox as="tr">
              {(['date', 'name', 'entry', 'amount', 'note'] as const).map((c) => (
                <UbBox
                  as="th"
                  key={c}
                  className={cn('font-semibold', c === 'amount' && 'text-right')}
                >
                  {t(`moneybook.report.col.${c}`)}
                </UbBox>
              ))}
            </UbBox>
          </UbBox>
          <UbBox as="tbody">
            {report.rows.map((row) => (
              <UbBox as="tr" key={row.id}>
                <UbBox as="td" className="whitespace-nowrap">
                  {shortDate(row.entryDate, today)}
                </UbBox>
                <UbBox as="td">{row.personName}</UbBox>
                <UbBox
                  as="td"
                  className={cn('font-semibold', row.kind === 'got' ? 'text-get' : 'text-give')}
                >
                  {t(KIND_WORD[row.kind])}
                </UbBox>
                <UbBox as="td" className="ds-num text-right">
                  {rupees(row.amount)}
                </UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {row.note}
                </UbBox>
              </UbBox>
            ))}
          </UbBox>
        </UbBox>
      </UbBox>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-6">
        <UbPageHeader
          title={t('moneybook.report.title')}
          subtitle={scope}
          actions={
            <UbStack direction="row" gap={2} className="ub-print-hide">
              <UbButton
                variant="outlineNeutral"
                icon={<Share2 className="h-4 w-4" aria-hidden />}
                onClick={() => window.print()}
                disabled={!report?.rows.length}
              >
                {t('moneybook.report.sharePdf')}
              </UbButton>
              <UbButton
                icon={<Printer className="h-4 w-4" aria-hidden />}
                onClick={() => window.print()}
                disabled={!report?.rows.length}
              >
                {t('moneybook.report.print')}
              </UbButton>
            </UbStack>
          }
        />
        {user?.name && (
          <UbText variant="inherit" className="hidden text-[13px] print:block">
            {t('moneybook.report.printedBy', { name: user.name })}
          </UbText>
        )}
        <UbStack direction="row" wrap gap={2} align="center" className="ub-print-hide">
          <UbChoiceChips
            ariaLabel={t('moneybook.report.period.label')}
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((value) => ({
              value,
              label: t(`moneybook.report.period.${value}`),
            }))}
          />
          <UbNativeSelect
            aria-label={t('moneybook.report.who')}
            value={person}
            onChange={(value) =>
              router.replace(value ? MONEYBOOK_ROUTES.personReport(value) : MONEYBOOK_ROUTES.report)
            }
            options={[
              { value: '', label: t('moneybook.report.all') },
              ...people.map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="w-auto"
          />
        </UbStack>
        {period === 'pick' && (
          <UbBox className="ub-print-hide grid grid-cols-2 gap-2.5 sm:max-w-md">
            <UbDateInput
              aria-label={t('moneybook.report.from')}
              value={picked.from}
              max={today}
              onChange={(v) => setPicked((p) => ({ ...p, from: v ?? today }))}
            />
            <UbDateInput
              aria-label={t('moneybook.report.to')}
              value={picked.to}
              max={today}
              onChange={(v) => setPicked((p) => ({ ...p, to: v ?? today }))}
            />
          </UbBox>
        )}
        {s && !badRange && (
          <UbBox className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Figure
              label={t('moneybook.report.youGave')}
              value={rupees(s.youGave)}
              caption={t('moneybook.entries.count', { count: s.youGaveEntries })}
              side="give"
            />
            <Figure
              label={t('moneybook.report.youGot')}
              value={rupees(s.youGot)}
              caption={t('moneybook.entries.count', { count: s.youGotEntries })}
              side="get"
            />
            <Figure
              label={t('moneybook.report.toGetNow')}
              value={rupees(s.toGetNow)}
              caption={t('moneybook.people.count', { count: s.peopleToGet })}
              side="get"
            />
            <Figure
              label={t('moneybook.report.toGiveNow')}
              value={rupees(s.toGiveNow)}
              caption={t('moneybook.people.count', { count: s.peopleToGive })}
              side="give"
            />
          </UbBox>
        )}
        {table}
      </UbStack>
    </UbPageShell>
  );
}
