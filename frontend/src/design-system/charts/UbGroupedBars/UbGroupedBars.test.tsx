import { render } from '@testing-library/react';

import { UbGroupedBars } from './UbGroupedBars';

/**
 * The fourth chart form. Two things a reader would misread if they broke: a
 * LOSS must hang below a zero line (not vanish), and a fourth series must not
 * squeeze in — three is the cap, more is a table.
 */
const series = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'profit', label: 'Profit' },
  { key: 'expenses', label: 'Expenses' },
];

const groups = [
  {
    key: 'a',
    label: 'Mon',
    longLabel: 'Mon 5 Oct',
    values: ['1000.00', '400.00', '-150.00', '20.00'],
  },
  { key: 'b', label: 'Tue', longLabel: 'Tue 6 Oct', values: ['800.00', '0.00', '300.00', '10.00'] },
];

it('draws at most three series, and a negative figure below the zero line', () => {
  const { container } = render(
    <UbGroupedBars series={series} groups={groups} labelledBy="t" describedBy="d" />
  );
  const fills = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('class'));
  expect(fills.filter((c) => c === 'fill-viz-3')).toHaveLength(2);
  expect(container.textContent).not.toContain('Expenses');
  // The axis gains a negative tick, so the zero line sits inside the plot.
  const ticks = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
  expect(ticks.some((t) => t?.startsWith('-'))).toBe(true);
  expect(ticks).toContain('0');
});

it('reserves more axis space for large Indian-grouped amounts', () => {
  // Home baseline clipped 2,50,000/1,25,000/5,00,000 at the left SVG edge.
  const { container } = render(
    <UbGroupedBars
      series={series.slice(0, 1)}
      groups={[{ key: 'x', label: 'Today', longLabel: 'Today', values: ['500000.00'] }]}
      labelledBy="t"
      describedBy="d"
    />
  );
  const tick = [...container.querySelectorAll('text')].find(
    (node) => node.textContent === '5,00,000'
  );
  expect(Number(tick?.getAttribute('x'))).toBeGreaterThan(56);
});
