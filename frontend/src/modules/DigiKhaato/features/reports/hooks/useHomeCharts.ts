'use client';
import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';

import {
  getDashboardCharts,
  type DashboardCharts,
  type ChartQuery,
} from '../api/dashboardChartsService';
export type HomeChartLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly message: string | null }
  | { readonly status: 'ready'; readonly charts: DashboardCharts };
const DEFAULT_QUERY: ChartQuery = {
  range: '7d',
  group: null,
  from: null,
  to: null,
  topBy: 'value',
};
/** Same scoped read for initial Home, its filtered chart and initial Insights. */
export function useHomeCharts(
  enabled: boolean,
  refreshKey: string,
  query: ChartQuery = DEFAULT_QUERY
): HomeChartLoad {
  const scope = useAppSelector(selectRequestScopeKey);
  const { range, group, from, to, topBy } = query;
  const source = `${scope}:${range}:${group}:${from}:${to}:${topBy}`;
  const [load, setLoad] = useState<{ source: string; value: HomeChartLoad } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    getDashboardCharts({ range, group, from, to, topBy }, abort.signal)
      .then((charts) => {
        if (!abort.signal.aborted) setLoad({ source, value: { status: 'ready', charts } });
      })
      .catch(() => {
        if (!abort.signal.aborted) setLoad({ source, value: { status: 'failed', message: null } });
      });
    return () => abort.abort();
  }, [enabled, refreshKey, source, range, group, from, to, topBy]);
  return enabled && load?.source === source ? load.value : { status: 'loading' };
}
