'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDrawerLoading,
  UbEmptyState,
  UbNativeSelect,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbProgress,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { Card, Figure, Figures, List, Table } from 'modules/DigiKhaato/features/appParts/AppParts';

import { selectLending, setRoute } from '../redux/lendingSlice';
import { fetchToday } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { STOP_TONE, STOP_WORD, rupees, workLine } from '../view-model/lendingDisplay';

import type { Stop, StopState } from '../types/lending.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const NotPaidSheet = dynamic(() => import('./NotPaidSheet').then((m) => m.NotPaidSheet), {
  loading: () => <UbDrawerLoading />,
});

type Show = 'visit' | 'done' | 'not';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inShow = (s: StopState, show: Show): boolean =>
  show === 'visit' ? s === 'late' || s === 'due' : show === 'done' ? s === 'done' : s === 'not';

/**
 * I8 · Today — the collector's round. One card says what is collected, what is
 * still due and how much is short. Each stop shows today's amount and anything
 * late, with Not paid and Collect right on the row.
 */
export function TodayPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const today = useMemo(() => todayInTenantTz(), []);
  const [show, setShow] = useState<Show>('visit');
  const [collecting, setCollecting] = useState<Stop | null>(null);
  const [notPaying, setNotPaying] = useState<Stop | null>(null);

  const load = useCallback(() => dispatch(fetchToday(lend.route)), [dispatch, lend.route]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const round = lend.round.data;
  const date = new Date(`${today}T00:00:00`);
  const dayWords = `${t(`lending.weekday.${WEEKDAYS[date.getDay()]}`)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const stops = (round?.stops ?? []).filter((s) => inShow(s.state, show));
  const percent = round && Number(round.due) > 0 ? (Number(round.collected) / Number(round.due)) * 100 : 0;

  const routeSelect = round && (
    <UbNativeSelect
      aria-label={t('lending.today.route')}
      value={lend.route}
      onChange={(v) => dispatch(setRoute(v))}
      options={[{ value: '', label: t('lending.today.allRoutes') }, ...round.routes.map((r) => ({ value: r.id, label: r.name }))]}
      className="h-8 w-auto text-[13px]"
    />
  );

  const stopActions = (s: Stop, size: 'sm' = 'sm') =>
    s.state === 'done' ? (
      <UbStatusBadge label={t('lending.stop.collectedAmount', { amount: rupees(s.collectedToday) })} tone="success" />
    ) : s.state === 'not' ? (
      <UbStatusBadge label={t(STOP_WORD.not)} tone="error" />
    ) : (
      <UbStack direction="row" gap={1.5} className="w-full lg:w-auto lg:justify-end">
        <UbButton size={size} variant="outlineNeutral" className="flex-1 lg:flex-none" onClick={() => setNotPaying(s)} data-testid="lending-not-paid">
          {t('lending.stop.notPaidButton')}
        </UbButton>
        <UbButton size={size} variant="primary" className="flex-1 lg:flex-none" onClick={() => setCollecting(s)} data-testid="lending-collect">
          {t('lending.stop.collect')}
        </UbButton>
      </UbStack>
    );

  const body = (() => {
    if (lend.round.status === 'failed' && !round)
      return (
        <UbEmptyState variant="error" title={t('lending.today.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />
      );
    if (!round) return <UbSkeleton variant="list" count={5} label={t('lending.common.loading')} />;
    if (round.stopsTotal === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('lending.today.empty.title')}
          description={t('lending.today.empty.body')}
          action={<UbButton onClick={() => router.push(LENDING_ROUTES.newLoan)}>{t('lending.today.newLoan')}</UbButton>}
        />
      );
    const roundCard = (
      <Card testId="lending-round">
        {/* The route IS the card's title: a title beside a select naming the same route
            read "All routes  All routes" (hand pass, 12 Nov). */}
        <UbStack direction="row" align="center" gap={2}>
          <UbText variant="inherit" className="font-semibold">
            {t('lending.today.route')}
          </UbText>
          {routeSelect}
        </UbStack>
        <UbText variant="inherit" className="ds-num text-[20px] font-extrabold">
          {rupees(round.collected)}{' '}
          <UbText as="span" variant="inherit" className="text-[14px] font-medium text-text-tertiary">
            {t('lending.today.collectedOf', { due: rupees(round.due) })}
          </UbText>
        </UbText>
        <UbProgress percent={percent} tone="success" ariaLabel={t('lending.today.collectedOf', { due: rupees(round.due) })} />
        <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
          {t('lending.today.stopsDone', { done: round.stopsDone, total: round.stopsTotal })}
          {Number(round.short) > 0 && (
            <>
              {' · '}
              <UbText as="span" variant="inherit" className="text-give">
                {t('lending.today.short', { amount: rupees(round.short) })}
              </UbText>
            </>
          )}
        </UbText>
      </Card>
    );
    const chips = (
      <UbChoiceChips
        ariaLabel={t('lending.today.show')}
        value={show}
        onChange={(v) => setShow(v as Show)}
        options={[
          { value: 'visit', label: t('lending.today.toVisit', { count: round.toVisit }) },
          { value: 'done', label: t('lending.today.done', { count: round.stopsDone }) },
          { value: 'not', label: t('lending.today.notPaid', { count: round.notPaid }) },
        ]}
        className="flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
      />
    );
    const none = (
      <UbText variant="inherit" className="text-[13px] text-text-tertiary">
        {t(`lending.today.none.${show}`)}
      </UbText>
    );
    return (
      <>
        <UbStack gap={3} className="lg:hidden">
          {roundCard}
          {chips}
          {stops.length === 0 ? (
            none
          ) : (
            <List testId="lending-stops">
              {stops.map((s) => (
                <UbBox as="li" key={s.id}>
                  <UbStack direction="row" wrap align="start" className="gap-2.5 border-b border-border-hairline px-4 py-3">
                    <UbPressable onClick={() => router.push(LENDING_ROUTES.loan(s.id))} className="flex min-w-0 flex-1 gap-3 text-left">
                      <UbAvatar name={s.borrower} size="sm" />
                      <UbStack gap={0} className="min-w-0">
                        <UbText variant="inherit" truncate className="text-[14px] font-medium">
                          {s.borrower}
                        </UbText>
                        <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                          {workLine(s)}
                        </UbText>
                        <UbText variant="inherit" className="ds-num text-[12.5px] text-text-tertiary">
                          {t('lending.stop.today', { amount: rupees(s.today) })}
                          {Number(s.lateAtStart) > 0 && (
                            <>
                              {' · '}
                              <UbText as="span" variant="inherit" className="text-give">
                                {t('lending.stop.lateAmount', { amount: rupees(s.lateAtStart) })}
                              </UbText>
                            </>
                          )}
                        </UbText>
                      </UbStack>
                    </UbPressable>
                    {s.state === 'done' || s.state === 'not' ? stopActions(s) : <UbBox className="basis-full pl-11">{stopActions(s)}</UbBox>}
                  </UbStack>
                </UbBox>
              ))}
            </List>
          )}
        </UbStack>
        <UbStack gap={4} className="max-lg:hidden">
          <Figures testId="lending-figures">
            <Figure label={t('lending.fig.collected')} value={rupees(round.collected)} caption={t('lending.today.stopsOf', { done: round.stopsDone, total: round.stopsTotal })} tone="get" />
            <Figure label={t('lending.fig.stillDue')} value={rupees(round.short)} caption={t('lending.today.stopsLeft', { count: round.toVisit })} />
            <Figure label={t('lending.fig.late')} value={rupees(round.book.late)} caption={t('lending.today.borrowers', { count: round.book.lateBorrowers })} tone="give" />
            <Figure label={t('lending.fig.lentMonth')} value={rupees(round.book.lentMonth)} caption={t('lending.today.loans', { count: round.book.loansMonth })} />
          </Figures>
          {(round?.stops.length ?? 0) === 0 ? (
            none
          ) : (
            <Table
              testId="lending-stops-table"
              head={[
                { label: t('lending.col.borrower') },
                { label: t('lending.col.loan') },
                { label: t('lending.col.today'), align: 'right' },
                { label: t('lending.col.late'), align: 'right' },
                { label: t('lending.col.status') },
                { label: '' },
              ]}
            >
              {/* Every stop, as the design's desktop table draws it; the phone filters by chip. */}
              {(round?.stops ?? []).map((s) => (
                <UbBox as="tr" key={s.id}>
                  <UbBox as="td">
                    <UbPressable onClick={() => router.push(LENDING_ROUTES.loan(s.id))} className="flex w-auto items-center gap-2.5 text-left">
                      <UbAvatar name={s.borrower} size="sm" />
                      <UbStack gap={0}>
                        <UbText variant="inherit" className="font-semibold">
                          {s.borrower}
                        </UbText>
                        <UbText variant="inherit" className="text-[12px] text-text-tertiary">
                          {s.work}
                        </UbText>
                      </UbStack>
                    </UbPressable>
                  </UbBox>
                  <UbBox as="td" className="text-text-secondary">
                    {s.number}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right">
                    {rupees(s.today)}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right text-give">
                    {Number(s.lateAtStart) > 0 ? rupees(s.lateAtStart) : '—'}
                  </UbBox>
                  <UbBox as="td">
                    <UbStatusBadge label={t(STOP_WORD[s.state])} tone={STOP_TONE[s.state]} />
                  </UbBox>
                  <UbBox as="td" className="text-right">
                    {s.state === 'late' || s.state === 'due' ? stopActions(s) : null}
                  </UbBox>
                </UbBox>
              ))}
            </Table>
          )}
        </UbStack>
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('lending.today.title')}
          subtitle={round ? t('lending.today.subtitle', { day: dayWords, name: round.name }) : undefined}
          actions={
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              {routeSelect}
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => router.push(LENDING_ROUTES.newLoan)} className="lg:h-10 lg:text-[14px]">
                {t('lending.today.newLoan')}
              </UbButton>
            </UbStack>
          }
          renderMobileActions={() => null}
          className="max-lg:[&_[data-ub-page-subtitle]]:hidden"
        />
        {body}
      </UbStack>
      {collecting && round && (
        <CollectSheet
          loan={collecting}
          lenderName={round.name}
          onClose={() => setCollecting(null)}
          onSaved={() => void load()}
        />
      )}
      {notPaying && <NotPaidSheet loan={notPaying} onClose={() => setNotPaying(null)} onSaved={() => void load()} />}
    </UbPageShell>
  );
}
