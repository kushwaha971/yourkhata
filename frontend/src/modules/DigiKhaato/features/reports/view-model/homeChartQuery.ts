import { addDaysIso } from 'src/utils/calendarDays';

import type { ChartGroup, ChartQuery } from '../api/dashboardChartsService';
export type HomeChartPeriod = '7d' | 'week' | 'month' | 'year' | 'all' | 'custom';
/** Business-date ranges; grouping is independent and never changes the money basis. */
export function homeChartQuery(
  period: HomeChartPeriod,
  today: string,
  group: ChartGroup | null,
  from: string | null,
  to: string | null
): ChartQuery {
  const day = new Date(`${today}T00:00:00Z`);
  if (period === 'week')
    return {
      range: 'custom',
      from: addDaysIso(today, -((day.getUTCDay() + 6) % 7)),
      to: today,
      group,
      topBy: 'value',
    };
  if (period === 'year')
    return {
      range: 'custom',
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
      group: group ?? 'month',
      topBy: 'value',
    };
  return {
    range: period,
    from: period === 'custom' ? from : null,
    to: period === 'custom' ? to : null,
    group,
    topBy: 'value',
  };
}
