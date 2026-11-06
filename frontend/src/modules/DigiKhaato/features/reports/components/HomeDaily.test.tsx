import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { HomeDaily } from './HomeDaily';

import type { DashboardCharts } from '../api/dashboardChartsService';
jest.mock('../api/dashboardChartsService', () => ({
  ...jest.requireActual('../api/dashboardChartsService'),
  getDashboardCharts: jest.fn(),
}));
const data: DashboardCharts = {
  range: '7d',
  group: 'day',
  from: '2026-10-13',
  to: '2026-10-19',
  trend: {
    series: ['sales'],
    points: [{ date: '2026-10-19', sales: '1240378.00' }],
    totals: { sales: '1240378.00' },
  },
};
it('shows exact daily figures in table and can return to its compact chart', async () => {
  renderWithProviders(<HomeDaily data={data} today="2026-10-19" refreshKey="1" />);
  await userEvent.click(screen.getByRole('button', { name: 'Show as table' }));
  expect(screen.getAllByText('₹12,40,378.00')).toHaveLength(2);
  expect(screen.getAllByText(/so far/)).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Show as chart' }));
  expect(screen.getByRole('img', { name: 'Billed per day' })).toBeInTheDocument();
});
it('queries the selected calendar year instead of changing labels over the same data', async () => {
  const service = jest.requireMock('../api/dashboardChartsService');
  service.getDashboardCharts.mockResolvedValue({ ...data, group: 'month', from: '2026-01-01' });
  renderWithProviders(<HomeDaily data={data} today="2026-10-19" refreshKey="1" />);
  await userEvent.click(screen.getByRole('button', { name: /Last 7 days/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'This year' }));
  await waitFor(() =>
    expect(service.getDashboardCharts).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'custom',
        from: '2026-01-01',
        to: '2026-10-19',
        group: 'month',
      }),
      expect.anything()
    )
  );
});
