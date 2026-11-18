'use client';
import { useState } from 'react';

import {
  UbBox,
  UbButton,
  UbFilterSelect,
  UbPeriodSelect,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { UbCompactColumns } from 'src/design-system/charts/UbCompactColumns/UbCompactColumns';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import {
  CHART_GROUPS,
  barsFor,
  MAX_BARS,
  type ChartGroup,
  type DashboardCharts,
} from '../api/dashboardChartsService';
import { useHomeCharts } from '../hooks/useHomeCharts';
import { groupLabels } from '../view-model/chartDisplay';
import { homeChartQuery, type HomeChartPeriod } from '../view-model/homeChartQuery';
export function HomeDaily({
  data,
  today,
  refreshKey,
}: Readonly<{
  data: DashboardCharts;
  today: string;
  refreshKey: string;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const locale = useAppSelector(selectLocale);
  const [table, setTable] = useState(false);
  const [period, setPeriod] = useState<HomeChartPeriod>('7d');
  const [group, setGroup] = useState<ChartGroup | null>(null);
  const [dates, setDates] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [attempt, setAttempt] = useState(0);
  const initial = period === '7d' && group === null;
  const query = homeChartQuery(period, today, group, dates.from, dates.to);
  const result = useHomeCharts(!initial, `${refreshKey}:${attempt}`, query);
  const charts = initial ? data : result.status === 'ready' ? result.charts : null;
  const points = (charts?.trend?.points ?? []).map((p) => ({
    key: p.date,
    label: groupLabels(p.date, charts?.group ?? 'day', locale, t).label,
    amount: p.sales ?? '0.00',
    partial:
      p.date <= today &&
      today <= (charts?.to ?? today) &&
      p.date === charts?.trend?.points.at(-1)?.date,
  }));
  if (initial && !data.trend?.series.includes('sales')) return null;
  return (
    <UbStack gap={2} data-testid="home-daily">
      <UbText as="h2" variant="body-sm-medium">
        {t('reports.home.billedBy', {
          group: t(`reports.charts.group.${charts?.group ?? query.group ?? 'day'}`),
        })}
      </UbText>
      <UbStack direction="row" className="flex-nowrap gap-2" data-testid="home-chart-filters">
        <UbPeriodSelect<HomeChartPeriod>
          size="sm"
          presets={(['7d', 'week', 'month', 'year', 'all', 'custom'] as const).map((value) => ({
            value,
            label: t(`reports.home.range.${value}`),
          }))}
          value={period}
          customValue="custom"
          from={dates.from}
          to={dates.to}
          max={today}
          locale={locale}
          onChange={(value, from, to) => {
            setPeriod(value);
            setDates({ from, to });
            setGroup(null);
          }}
          labels={{
            period: t('reports.charts.range.label'),
            from: t('reports.charts.from'),
            to: t('reports.charts.to'),
            apply: t('reports.charts.apply'),
            close: t('common.action.close'),
          }}
        />
        <UbFilterSelect
          size="sm"
          showLabel={false}
          spec={{
            kind: 'single',
            key: 'group',
            label: t('reports.charts.group.label'),
            options: CHART_GROUPS.map((value) => ({
              value,
              label: t(`reports.charts.group.${value}`),
              disabled: charts ? barsFor(charts.from, charts.to, value) > MAX_BARS : false,
            })),
          }}
          value={group ?? charts?.group ?? ''}
          onChange={(value) => setGroup(value as ChartGroup)}
          closeLabel={t('common.action.close')}
        />
      </UbStack>
      {!charts ? (
        result.status === 'failed' ? (
          <UbStack>
            <UbText variant="caption" tone="secondary">
              {t('reports.home.chartFailed')}
            </UbText>
            <UbButton variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {t('common.action.retry')}
            </UbButton>
          </UbStack>
        ) : (
          <UbSkeleton className="h-24 w-full" />
        )
      ) : (
        <>
          {table ? (
            <UbStack as="dl" gap={0}>
              {points.map((p) => (
                <UbStack
                  key={p.key}
                  direction="row"
                  justify="between"
                  className="gap-3 border-b border-border-hairline py-1"
                >
                  <UbText as="dt" variant="caption">
                    {groupLabels(p.key, charts.group, locale, t).longLabel}
                    {p.partial ? ` · ${t('reports.home.soFar')}` : ''}
                  </UbText>
                  <UbText as="dd" variant="caption" className="ds-num">
                    {formatInr(p.amount)}
                  </UbText>
                </UbStack>
              ))}
              <UbStack direction="row" justify="between">
                <UbText variant="body-sm-medium">{t('reports.home.total')}</UbText>
                <UbText variant="body-sm-medium">{formatInr(charts.trend?.totals.sales)}</UbText>
              </UbStack>
            </UbStack>
          ) : (
            <UbCompactColumns points={points} label={t('reports.home.daily')} />
          )}
          <UbBox>
            <UbText variant="caption" tone="secondary">
              {t('reports.home.dailyBasis', {
                from: formatBusinessDate(charts.from),
                to: formatBusinessDate(charts.to),
              })}
            </UbText>
            <UbButton variant="ghost" size="sm" onClick={() => setTable(!table)}>
              {t(table ? 'reports.home.showChart' : 'reports.home.showTable')}
            </UbButton>
          </UbBox>
        </>
      )}
    </UbStack>
  );
}
