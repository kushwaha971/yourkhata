'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Bell, Printer } from 'lucide-react';

import {
  UbBottomBar,
  UbBox,
  UbButton,
  UbCheckbox,
  UbDialogLoading,
  UbChoiceChips,
  UbDrawerLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { sumMoney } from 'src/utils/money';

import { messageText } from '../api/libraryService';
import { useRemind } from '../hooks/useRemind';
import { selectLibrary, setFee } from '../redux/librarySlice';
import { fetchFees } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { dueAmount, monthName, rupees } from '../view-model/libraryDisplay';

import { FeeBadge, List, Table } from './LibraryParts';

import type { FeeFilter, Student } from '../types/library.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const FeePoster = dynamic(() => import('./FeePoster').then((m) => m.FeePoster), {
  loading: () => <UbDialogLoading />,
});

const PHONE_CHIPS: readonly FeeFilter[] = ['all', 'over', 'soon', 'part'];
const DESK_CHIPS: readonly FeeFilter[] = ['all', 'over', 'soon', 'part', 'paid'];

/** "5 days late", "Part paid", "Due 2 Nov" — the design's Late by column. */
const lateBy = (s: Student, t: TranslateFn): string => {
  if (s.fee === 'part') return t('library.fee.part');
  if (s.daysLate > 0) return t('library.fee.lateShort', { count: s.daysLate });
  return t('library.fee.dueShort');
};

/**
 * I7 · Fees — Overdue, Due soon and Part paid as chips. Pick students and
 * remind them one after another on WhatsApp (nothing is sent by the app), or
 * print the fee poster with the UPI QR for the wall.
 */
export function FeesPageContent(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const { remind, busy } = useRemind();
  // Picks belong to the chip they were made on: another chip's list starts empty.
  const [pickedFor, setPickedFor] = useState<{ fee: FeeFilter; ids: ReadonlySet<string> }>({ fee: 'over', ids: new Set() });
  const [queue, setQueue] = useState<readonly Student[]>([]);
  const [collecting, setCollecting] = useState<Student | null>(null);
  const [poster, setPoster] = useState(false);
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const fee = lib.fee;
  // Home's "Remind 5 overdue" arrives with ?pick=over: every overdue student ticked (I7).
  const [autoPick, setAutoPick] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pick') === 'over');

  const load = useCallback(() => dispatch(fetchFees(fee)), [dispatch, fee]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const page = lib.fees.data;
  const rows = useMemo(() => page?.rows ?? [], [page]);
  const counts = page?.counts;
  if (autoPick && page && fee === 'over') {
    setAutoPick(false);
    setPickedFor({ fee, ids: new Set(rows.filter((r) => r.fee === 'over').map((r) => r.id)) });
  }
  const picked: ReadonlySet<string> = pickedFor.fee === fee ? pickedFor.ids : new Set();
  const setPicked = (ids: ReadonlySet<string>) => setPickedFor({ fee, ids });

  // The desktop's message preview: the first picked student, else the first row.
  const previewOf = rows.find((r) => picked.has(r.id)) ?? rows.find((r) => r.fee !== 'paid');
  useEffect(() => {
    if (!previewOf) return undefined;
    const controller = new AbortController();
    messageText(previewOf.id, 'fee_due', locale, controller.signal)
      .then((m) => setPreview({ id: previewOf.id, text: m.text }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [previewOf, locale]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const pickedDue = sumMoney(pickedRows.map((r) => r.due || '0.00'));

  /** One at a time: WhatsApp opens for the first; the dock offers the next. */
  const startQueue = (list: readonly Student[]) => {
    const [first, ...rest] = list;
    if (!first) return;
    setQueue(rest);
    void remind(first);
  };
  const next = () => startQueue(queue);
  const overdueRows = rows.filter((r) => r.fee === 'over');

  const chipRow = (chips: readonly FeeFilter[]) => (
    <UbChoiceChips
      ariaLabel={t('library.fees.show')}
      value={fee}
      revealSelected
      onChange={(v) => dispatch(setFee(v as FeeFilter))}
      options={chips.map((v) => ({
        value: v,
        label:
          counts && !(v === 'all' && chips === PHONE_CHIPS)
            ? t('library.students.chipCount', { label: t(`library.students.chip.${v}`), count: counts[v] })
            : t(`library.students.chip.${v}`),
      }))}
      className="flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
    />
  );

  const body = (() => {
    if (lib.fees.status === 'failed' && !page)
      return (
        <UbEmptyState
          variant="error"
          title={t('library.fees.error')}
          action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
        />
      );
    if (!page) return <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />;
    if (rows.length === 0)
      return (
        <UbEmptyState
          variant="filtered"
          title={t(`library.fees.none.${fee}`)}
          description={fee === 'over' ? t('library.fees.none.overBody') : undefined}
        />
      );
    return (
      <>
        <List className="lg:hidden" testId="library-fees-list">
          {rows.map((s) => (
            <UbBox as="li" key={s.id}>
              <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-2">
                <UbCheckbox
                  checked={picked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  label={<UbText as="span" variant="inherit" className="sr-only">{t('library.fees.pick', { name: s.name })}</UbText>}
                />
                <UbPressable onClick={() => router.push(LIBRARY_ROUTES.student(s.id))} className="min-w-0 flex-1 text-left">
                  <UbText variant="inherit" truncate className="block text-[14px] font-medium">
                    {s.name}
                  </UbText>
                  <UbText variant="inherit" truncate className="block text-[12.5px] text-text-tertiary">
                    {[s.seat ? t('library.fees.seat', { seat: s.seat }) : null, lateBy(s, t)].filter(Boolean).join(' · ')}
                  </UbText>
                </UbPressable>
                <UbText variant="inherit" className={cn('ds-num text-[14px] font-bold', s.fee === 'paid' ? 'text-get' : 'text-give')}>
                  {dueAmount(s)}
                </UbText>
              </UbStack>
            </UbBox>
          ))}
        </List>
        <UbBox className="grid items-start gap-4 max-lg:hidden lg:[grid-template-columns:minmax(0,1fr)_380px]">
          <Table
            testId="library-fees-table"
            head={[
              { label: '' },
              { label: t('library.col.student') },
              { label: t('library.col.seat') },
              { label: t('library.col.lateBy') },
              { label: t('library.col.due'), align: 'right' },
              { label: '' },
            ]}
          >
            {rows.map((s) => (
              <UbBox as="tr" key={s.id}>
                <UbBox as="td" className="w-10">
                  <UbCheckbox
                    checked={picked.has(s.id)}
                    onChange={() => toggle(s.id)}
                    label={<UbText as="span" variant="inherit" className="sr-only">{t('library.fees.pick', { name: s.name })}</UbText>}
                  />
                </UbBox>
                <UbBox as="td">
                  <UbPressable onClick={() => router.push(LIBRARY_ROUTES.student(s.id))} className="w-auto text-left font-semibold">
                    {s.name}
                  </UbPressable>
                </UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {s.seat ? `${s.seat} · ${s.shift}` : s.shift}
                </UbBox>
                <UbBox as="td">{s.fee === 'paid' ? <FeeBadge fee="paid" t={t} /> : lateBy(s, t)}</UbBox>
                <UbBox as="td" className="ds-num text-right font-semibold">
                  {dueAmount(s)}
                </UbBox>
                <UbBox as="td" className="text-right">
                  {s.fee !== 'paid' && s.fee !== 'hold' && (
                    <UbButton variant="link" size="sm" onClick={() => setCollecting(s)}>
                      {t('library.home.collect')}
                    </UbButton>
                  )}
                </UbBox>
              </UbBox>
            ))}
          </Table>
          <UbStack gap={2} data-testid="library-fees-preview">
            <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
              {t('library.fees.preview')}
            </UbText>
            <UbBox className="grid rounded-[12px] bg-[#ECE5DD] p-3.5">
              <UbText
                variant="inherit"
                className="max-w-[92%] justify-self-end whitespace-pre-wrap rounded-[10px_10px_2px_10px] bg-[#DCF8C6] px-3 py-2.5 text-[14px] leading-[1.45] text-[#111]"
              >
                {preview?.id === previewOf?.id ? preview?.text : t('library.common.loading')}
              </UbText>
            </UbBox>
            <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
              {t('library.fees.oneAtATime')}
            </UbText>
          </UbStack>
        </UbBox>
      </>
    );
  })();

  const monthLabel = page ? monthName(page.month, t) : '';
  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-32 lg:pb-6">
        <UbPageHeader
          title={t('library.fees.title')}
          subtitle={
            page
              ? `${monthLabel} · ${t('library.fees.collected', { amount: rupees(page.collected) })} · ${t('library.fees.toCome', { amount: rupees(page.toCome) })}`
              : undefined
          }
          actions={
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton variant="outlineNeutral" icon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => setPoster(true)}>
                {t('library.fees.poster')}
              </UbButton>
              {(counts?.over ?? 0) > 0 && (
                <UbButton
                  variant="primary"
                  icon={<Bell className="h-4 w-4" aria-hidden />}
                  onClick={() => (fee === 'over' ? startQueue(overdueRows) : dispatch(setFee('over')))}
                >
                  {t('library.home.remindOverdue', { count: counts?.over ?? 0 })}
                </UbButton>
              )}
            </UbStack>
          }
          renderMobileActions={() => null}
          className="max-lg:[&_[data-ub-page-subtitle]]:hidden"
        />
        <UbText variant="inherit" className="-mt-2 text-[12.5px] text-text-tertiary lg:hidden">
          {monthLabel}
        </UbText>
        <UbBox className="lg:hidden">{chipRow(PHONE_CHIPS)}</UbBox>
        <UbBox className="max-lg:hidden">{chipRow(DESK_CHIPS)}</UbBox>
        {body}
      </UbStack>
      {(picked.size > 0 || queue.length > 0) && (
        <UbBottomBar
          sticky={false}
          // Pinned, not sticky: on a short list a sticky dock floated mid-screen (hand pass, 12 Nov).
          className="fixed inset-x-0 bottom-[var(--ub-nav-offset)] z-20 border-t border-border-hairline bg-surface-card px-4 pb-3.5 pt-2.5 grid gap-2 lg:hidden" data-testid="library-fees-dock">
          <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
            {queue.length > 0
              ? t('library.fees.next', { name: queue[0]?.name ?? '', count: queue.length })
              : t('library.fees.selected', { count: picked.size, amount: rupees(pickedDue) })}
          </UbText>
          <UbBox className="grid grid-cols-2 gap-2">
            {queue.length > 0 ? (
              <>
                <UbButton variant="secondary" size="lg" onClick={() => setQueue([])}>
                  {t('library.fees.stop')}
                </UbButton>
                <UbButton variant="primary" size="lg" busy={busy !== null} onClick={next}>
                  {t('library.fees.remindNext')}
                </UbButton>
              </>
            ) : (
              <>
                <UbButton
                  variant="secondary"
                  size="lg"
                  disabled={pickedRows.length !== 1}
                  onClick={() => pickedRows[0] && setCollecting(pickedRows[0])}
                >
                  {t('library.home.collect')}
                </UbButton>
                <UbButton variant="primary" size="lg" busy={busy !== null} onClick={() => startQueue(pickedRows)}>
                  {t('library.fees.remindCount', { count: picked.size })}
                </UbButton>
              </>
            )}
          </UbBox>
        </UbBottomBar>
      )}
      {collecting && (
        <CollectSheet
          student={collecting}
          onClose={() => setCollecting(null)}
          onSaved={() => {
            setPicked(new Set());
            void load();
          }}
        />
      )}
      {poster && <FeePoster onClose={() => setPoster(false)} />}
    </UbPageShell>
  );
}
