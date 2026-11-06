import type { TranslateFn } from 'src/hooks/useTranslation';

import type { ChartGroup } from '../api/dashboardChartsService';

export const intlLocale = (locale: string): string => (locale === 'hi' ? 'hi-IN' : 'en-IN');

/** Axis ticks and tooltip headings, in the reader's language. */
export const groupLabels = (
  date: string,
  group: ChartGroup,
  locale: string,
  t?: TranslateFn
): { label: string; longLabel: string } => {
  const day = new Date(`${date}T00:00:00`);
  const lang = intlLocale(locale);
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang, options).format(day);
  if (group === 'year')
    return { label: fmt({ year: 'numeric' }), longLabel: fmt({ year: 'numeric' }) };
  if (group === 'month') {
    return { label: fmt({ month: 'short' }), longLabel: fmt({ month: 'long', year: 'numeric' }) };
  }
  if (group === 'week') {
    const start = fmt({ day: 'numeric', month: 'short' });
    return {
      label: fmt({ day: '2-digit', month: '2-digit' }),
      longLabel: t ? t('reports.charts.weekOf', { date: start }) : start,
    };
  }
  return {
    label: fmt({ day: '2-digit', month: '2-digit' }),
    longLabel: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
  };
};
