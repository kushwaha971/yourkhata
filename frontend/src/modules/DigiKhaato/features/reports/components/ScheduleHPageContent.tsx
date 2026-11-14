'use client';

import { useEffect, useMemo, useState } from 'react';

import { UbCountLine, UbStack, UbText } from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { formatBusinessDate, todayInTenantTz } from 'src/utils/dates';
import { formatQuantity } from 'src/utils/quantity';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import { getScheduleH, type ScheduleHRow } from '../api/scheduleHService';
import { REPORT_PRESETS, resolveReportPreset } from '../view-model/reportPeriod';

import { ReportPageShell, type ReportState } from './ReportPageShell';

import type { ReportPreset } from '../types/reports.types';

const medicinesOf = (row: ScheduleHRow): string =>
  row.medicines
    .map((m) => `${m.name} (${m.schedule}) × ${formatQuantity(m.qty)} ${m.unitCode}`)
    .join(', ');

/**
 * The register's columns: Date · Bill · Customer · Medicine · Doctor · Patient.
 * A phone row reads the bill and date, the medicines under them, and the
 * doctor at the right; a sale with no doctor written says so.
 */
const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<ScheduleHRow>[] => {
  const cards = tier === 'cards';
  const doctor = (row: ScheduleHRow) => (
    <UbText as="span" variant="body-sm" tone={row.doctor ? 'primary' : 'warning'}>
      {row.doctor ?? t('reports.scheduleH.noDoctor')}
    </UbText>
  );
  if (cards)
    return [
      {
        id: 'bill',
        header: t('reports.scheduleH.col.bill'),
        priority: 1,
        cardSlot: 'title',
        cell: (row) => `${row.number ?? '—'} · ${formatBusinessDate(row.date)}`,
      },
      {
        id: 'medicine',
        header: t('reports.scheduleH.col.medicine'),
        priority: 1,
        cardSlot: 'meta',
        cell: (row) =>
          [medicinesOf(row), row.patient ? t('reports.scheduleH.forPatient', { name: row.patient }) : null]
            .filter(Boolean)
            .join(' · '),
      },
      { id: 'doctor', header: t('reports.scheduleH.col.doctor'), priority: 1, cardSlot: 'trailing', cell: doctor },
    ];
  return [
    { id: 'date', header: t('reports.scheduleH.col.date'), priority: 1, cardSlot: 'none', widthShare: 11, cell: (row) => formatBusinessDate(row.date) },
    { id: 'bill', header: t('reports.scheduleH.col.bill'), priority: 1, cardSlot: 'none', widthShare: 14, cell: (row) => row.number ?? '—' },
    { id: 'customer', header: t('reports.scheduleH.col.customer'), priority: 2, cardSlot: 'none', widthShare: 16, cell: (row) => row.customer ?? t('reports.scheduleH.quickSale') },
    { id: 'medicine', header: t('reports.scheduleH.col.medicine'), priority: 1, cardSlot: 'none', widthShare: 27, cell: (row) => medicinesOf(row) },
    { id: 'doctor', header: t('reports.scheduleH.col.doctor'), priority: 1, cardSlot: 'none', widthShare: 16, cell: doctor },
    { id: 'patient', header: t('reports.scheduleH.col.patient'), priority: 2, cardSlot: 'none', widthShare: 16, cell: (row) => row.patient ?? '—' },
  ];
};

/**
 * G4 — `/reports/schedule-h`: every sale of a Schedule H, H1 or X medicine in
 * the period, with the doctor and patient kept with the bill. A sale with no
 * doctor written is listed and counted, so the register is where it is found.
 */
export function ScheduleHPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const tier = useGridTier();
  const timezone = useAppSelector(selectTenantTimezone);
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const [preset, setPreset] = useState<ReportPreset>('thisMonth');
  const [range, setRange] = useState(
    () => resolveReportPreset('thisMonth', today) ?? { dateFrom: today, dateTo: today }
  );
  const [data, setData] = useState<Awaited<ReturnType<typeof getScheduleH>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getScheduleH(range.dateFrom, range.dateTo, controller.signal)
      .then((next) => {
        setData(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [range.dateFrom, range.dateTo, attempt]);

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const state: ReportState = failed ? 'error' : !data ? 'loading' : data.rows.length === 0 ? 'empty' : 'ready';

  return (
    <ReportPageShell<ReportPreset>
      title={t('reports.scheduleH.title')}
      description={t('reports.scheduleH.description')}
      testId="schedule-h-register"
      period={{
        presets: REPORT_PRESETS.map((value) => ({ value, label: t(`reports.shell.period.${value}`) })),
        preset,
        onPresetChange: (next) => {
          setPreset(next);
          const resolved = resolveReportPreset(next, today);
          if (resolved) {
            setData(null);
            setRange(resolved);
          }
        },
        customPreset: 'custom',
        from: range.dateFrom,
        to: range.dateTo,
        onRangeChange: (from, to) => {
          if (!from || !to) return;
          setPreset('custom');
          setData(null);
          setRange({ dateFrom: from, dateTo: to });
        },
        max: today,
        name: 'schedule-h-period',
        labels: {
          presets: t('reports.shell.period.label'),
          from: t('reports.shell.period.from'),
          to: t('reports.shell.period.to'),
          apply: t('common.action.apply'),
          close: t('common.action.close'),
        },
      }}
      state={state}
      onRetry={() => setAttempt((n) => n + 1)}
      loadingLabel={t('reports.scheduleH.loading')}
      skeletonTiles={0}
      empty={{ title: t('reports.scheduleH.empty.title'), description: t('reports.scheduleH.empty.body'), variant: 'filtered' }}
    >
      {data && data.rows.length > 0 && (
        <UbStack gap={3}>
          <UbCountLine
            items={[
              {
                id: 'bills',
                template: t('reports.scheduleH.count.bills'),
                values: { n: { text: String(data.counts.bills) } },
              },
              {
                id: 'missing',
                template: t('reports.scheduleH.count.withoutDoctor'),
                values: {
                  n: {
                    text: String(data.counts.withoutDoctor),
                    tone: data.counts.withoutDoctor > 0 ? 'payable' : 'neutral',
                  },
                },
              },
            ]}
          />
          <UbDataGrid
            variant="register"
            rows={data.rows}
            columns={columns}
            rowId={(row) => row.id}
            rowName={(row) => row.number ?? row.id}
            state="rows"
            labels={inventoryGridLabels(t, {
              loading: 'reports.scheduleH.loading',
              open: 'reports.scheduleH.title',
              selectAll: 'reports.scheduleH.title',
              selectRow: 'reports.scheduleH.title',
            })}
            emptyStates={{
              firstUse: { title: t('reports.scheduleH.empty.title'), description: '' },
              filtered: { title: t('reports.scheduleH.empty.title'), description: '' },
              error: { title: t('reports.scheduleH.error'), description: '' },
            }}
            caption={t('reports.scheduleH.title')}
            storageId="reports.scheduleH"
            cardAvatar={false}
            cardLayout="stacked"
            page={{ page: 1, pageSize: Math.max(data.rows.length, 1), total: data.rows.length, totalPages: 1 }}
            onPageChange={() => undefined}
            footer={null}
          />
        </UbStack>
      )}
    </ReportPageShell>
  );
}
