import { homeChartQuery } from './homeChartQuery';
/** A period filter must query its business dates, not relabel seven-day figures. */
it('maps this week to Monday through today using calendar days', () => {
  expect(homeChartQuery('week', '2026-10-19', null, null, null)).toMatchObject({
    range: 'custom',
    from: '2026-10-19',
    to: '2026-10-19',
  });
  expect(homeChartQuery('week', '2026-10-25', 'week', null, null)).toMatchObject({
    from: '2026-10-19',
    to: '2026-10-25',
    group: 'week',
  });
});
it('defaults this calendar year to months, but respects a yearly override', () => {
  expect(homeChartQuery('year', '2026-10-19', null, null, null)).toMatchObject({
    from: '2026-01-01',
    to: '2026-10-19',
    group: 'month',
  });
  expect(homeChartQuery('year', '2026-10-19', 'year', null, null).group).toBe('year');
});
it('preserves explicit custom dates and never changes grouping totals itself', () => {
  expect(homeChartQuery('custom', '2026-10-19', 'month', '2025-01-01', '2026-09-30')).toEqual({
    range: 'custom',
    from: '2025-01-01',
    to: '2026-09-30',
    group: 'month',
    topBy: 'value',
  });
});
