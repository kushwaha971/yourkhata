'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { Printer, Share2, SlidersHorizontal } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbDrawer,
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

import { Figure, List } from './MoneyBookParts';

import type { Person } from '../types/moneybook.types';

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
  const [filtering, setFiltering] = useState(false);
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

  /* Share PDF (owner, 11 Nov: it must work on a phone). Where the phone can share
     (Android Chrome, iPhone Safari) its own share sheet opens with the report as
     text — the period, the four totals and every row with its amount — ready for
     WhatsApp. Elsewhere, the print sheet, whose Save as PDF is the PDF (ADR-021:
     no PDF library). Nothing is sent by the app itself (DEC-012). */
  const share = async (): Promise<void> => {
    if (!report || !s) return;
    const lines = [
      `${t('moneybook.report.title')} · ${scope}`,
      `${t('moneybook.report.youGave')}: ${rupees(s.youGave)} · ${t('moneybook.report.youGot')}: ${rupees(s.youGot)}`,
      `${t('moneybook.report.toGetNow')}: ${rupees(s.toGetNow)} · ${t('moneybook.report.toGiveNow')}: ${rupees(s.toGiveNow)}`,
      '',
      ...report.rows.map(
        (row) =>
          `${shortDate(row.entryDate, today)} · ${row.personName ?? ''} · ${t(KIND_WORD[row.kind])} ${rupees(row.amount)}${row.note ? ` · ${row.note}` : ''}`
      ),
    ];
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('moneybook.report.title'), text: lines.join('\n') });
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return; // the person closed the sheet
      }
    }
    window.print();
  };

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
      <>
        {/* Phone: the person page's entry rows with the name on them — a five-column
          table cut Amount and Note off a 390 px screen (look sweep, 11 Nov). */}
        <List className="lg:hidden print:hidden" testId="moneybook-report-list">
          {report.rows.map((row) => (
            <UbBox as="li" key={row.id}>
              <UbStack
                direction="row"
                align="center"
                gap={3}
                className="min-h-14 border-b border-border-hairline px-4 py-3"
              >
                <UbStack gap={0} className="min-w-0 flex-1">
                  <UbText
                    variant="inherit"
                    className="line-clamp-2 break-words text-[14px] font-medium"
                  >
                    {row.personName}
                  </UbText>
                  <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                    {[shortDate(row.entryDate, today), t(KIND_WORD[row.kind]), row.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </UbText>
                </UbStack>
                <UbText
                  variant="inherit"
                  className={cn(
                    'ds-num shrink-0 text-[14px] font-bold',
                    row.kind === 'got' ? 'text-get' : 'text-give'
                  )}
                >
                  {rupees(row.amount)}
                </UbText>
              </UbStack>
            </UbBox>
          ))}
        </List>
        <UbBox className="hidden overflow-x-auto rounded-xl border border-border-hairline bg-surface-card lg:block print:block print:overflow-visible">
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
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-6">
        <UbPageHeader
          title={t('moneybook.report.title')}
          subtitle={scope}
          actions={
            /* Owner, 11 Nov: Filters beside Share and Print, all three as icons on
               the title's line at every size — rows of worded buttons above the
               figures pushed the report down. Each icon keeps its name (tooltip
               and screen reader). */
            <UbStack direction="row" gap={2} className="ub-print-hide">
              <UbButton
                variant="outlineNeutral"
                iconOnly
                title={t('moneybook.report.filters')}
                icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
                onClick={() => setFiltering(true)}
                data-testid="moneybook-report-filters"
              >
                {t('moneybook.report.filters')}
              </UbButton>
              <UbButton
                variant="outlineNeutral"
                iconOnly
                title={t('moneybook.report.sharePdf')}
                icon={<Share2 className="h-4 w-4" aria-hidden />}
                onClick={() => void share()}
                data-testid="moneybook-report-share"
                disabled={!report?.rows.length}
              >
                {t('moneybook.report.sharePdf')}
              </UbButton>
              <UbButton
                iconOnly
                title={t('moneybook.report.print')}
                icon={<Printer className="h-4 w-4" aria-hidden />}
                onClick={() => window.print()}
                disabled={!report?.rows.length}
              >
                {t('moneybook.report.print')}
              </UbButton>
            </UbStack>
          }
          // The phone copy; the desktop copy hides itself below lg. Without lg:hidden
          // a desktop drew all three icons twice (owner's screenshot check, 12 Nov).
          renderMobileActions={(actions) => <UbBox className="lg:hidden">{actions}</UbBox>}
        />
        {user?.name && (
          <UbText variant="inherit" className="hidden text-[13px] print:block">
            {t('moneybook.report.printedBy', { name: user.name })}
          </UbText>
        )}
        {filtering && (
          <ReportFilterDrawer
            t={t}
            today={today}
            people={people}
            initial={{ period, from: range?.from ?? today, to: range?.to ?? today, person }}
            onClose={() => setFiltering(false)}
            onApply={(next) => {
              setFiltering(false);
              setPeriod(next.period);
              if (next.period === 'pick') setPicked({ from: next.from, to: next.to });
              if (next.person !== person)
                router.replace(
                  next.person ? MONEYBOOK_ROUTES.personReport(next.person) : MONEYBOOK_ROUTES.report
                );
            }}
          />
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

interface ReportFilters {
  readonly period: Period;
  readonly from: string;
  readonly to: string;
  readonly person: string;
}

/**
 * The report's filters in one drawer (owner, 11 Nov): the period as chips, the
 * From and To dates when "Pick dates" is chosen, and the person. Nothing is
 * asked of the server until Apply, and a start after the end is refused here.
 */
function ReportFilterDrawer({
  t,
  today,
  people,
  initial,
  onClose,
  onApply,
}: Readonly<{
  t: (id: string, values?: Record<string, string | number>) => string;
  today: string;
  people: readonly Person[];
  initial: ReportFilters;
  onClose: () => void;
  onApply: (next: ReportFilters) => void;
}>) {
  const [draft, setDraft] = useState<ReportFilters>(initial);
  const set = (patch: Partial<ReportFilters>): void => setDraft((d) => ({ ...d, ...patch }));
  const bad = draft.period === 'pick' && draft.from > draft.to;
  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('moneybook.report.filters')}
      closeLabel={t('moneybook.common.close')}
      footer={
        <UbButton
          size="lg"
          disabled={bad}
          onClick={() => onApply(draft)}
          data-testid="moneybook-report-apply"
        >
          {t('moneybook.report.apply')}
        </UbButton>
      }
    >
      <UbStack gap={4}>
        <UbStack gap={2}>
          <UbText variant="inherit" className="text-[13px] font-semibold">
            {t('moneybook.report.period.label')}
          </UbText>
          <UbChoiceChips
            ariaLabel={t('moneybook.report.period.label')}
            value={draft.period}
            onChange={(period) => {
              const range = periodRange(period, today);
              set(range ? { period, ...range } : { period });
            }}
            options={PERIODS.map((value) => ({
              value,
              label: t(`moneybook.report.period.${value}`),
            }))}
          />
        </UbStack>
        <UbBox className="grid grid-cols-2 gap-2.5">
          <UbStack gap={1.5}>
            <UbText variant="inherit" className="text-[13px] font-semibold">
              {t('moneybook.report.from')}
            </UbText>
            <UbDateInput
              aria-label={t('moneybook.report.from')}
              value={draft.from}
              max={today}
              onChange={(v) => set({ period: 'pick', from: v ?? today })}
            />
          </UbStack>
          <UbStack gap={1.5}>
            <UbText variant="inherit" className="text-[13px] font-semibold">
              {t('moneybook.report.to')}
            </UbText>
            <UbDateInput
              aria-label={t('moneybook.report.to')}
              value={draft.to}
              max={today}
              onChange={(v) => set({ period: 'pick', to: v ?? today })}
            />
          </UbStack>
        </UbBox>
        {bad && <UbStatusBanner tone="error" title={t('moneybook.report.badRange')} />}
        <UbStack gap={1.5}>
          <UbText variant="inherit" className="text-[13px] font-semibold">
            {t('moneybook.report.who')}
          </UbText>
          <UbNativeSelect
            aria-label={t('moneybook.report.who')}
            value={draft.person}
            onChange={(person) => set({ person })}
            options={[
              { value: '', label: t('moneybook.report.all') },
              ...people.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </UbStack>
      </UbStack>
    </UbDrawer>
  );
}
