import { render, screen } from '@testing-library/react';

import type { TranslateFn } from 'src/hooks/useTranslation';

import { KhataPeopleSummary } from './KhataPeopleSummary';

it('uses two balance cards without repeated people counts or a separator', () => {
  // Defect: two count lines and a divider crowded the personal people list.
  const t = ((id: string) => id) as TranslateFn;
  render(<KhataPeopleSummary t={t} count={2} rowCount={2} totals={{ receivable: '500.00', payable: '200.00' }} scope="filtered" loading={false} balance="all" />);
  const summary = screen.getByTestId('khata-people-summary');
  expect(summary).not.toHaveClass('border-b');
  expect(summary.querySelectorAll('.rounded-xl')).toHaveLength(2);
  expect(screen.queryByText('parties.khata.showing')).not.toBeInTheDocument();
  expect(summary.querySelector('.text-get')).toBeInTheDocument();
  expect(summary.querySelector('.text-give')).toBeInTheDocument();
});
