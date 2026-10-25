import { render, screen } from '@testing-library/react';

import { RecordTotals } from './RecordTotals';

/**
 * The registers dropped their count-and-amounts line while a search ran and
 * drew it again when the answer came, so the table jumped under the merchant's
 * thumb on every keystroke (owner, 25 Oct 2026). Loading now keeps the line,
 * its words and its height, with a shimmer where each figure will be.
 */
describe('RecordTotals', () => {
  const figures = [
    { key: 'bought', label: 'Bought', amount: '0.00' },
    { key: 'due', label: 'To pay', amount: '0.00' },
  ];

  it('keeps the line and its labels while the figures load', () => {
    render(
      <RecordTotals
        label="Totals"
        count={0}
        countLabel="Bills"
        figures={figures}
        testId="t"
        loading
      />
    );
    const line = screen.getByTestId('t');
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(line).toHaveTextContent('Bought');
    expect(line).toHaveTextContent('To pay');
    expect(line).not.toHaveTextContent('₹');
  });

  it('shows zeros, not a gap, when there is nothing', () => {
    render(
      <RecordTotals label="Totals" count={0} countLabel="Bills" figures={figures} testId="t" />
    );
    const line = screen.getByTestId('t');
    expect(line).not.toHaveAttribute('aria-busy');
    expect(line).toHaveTextContent('0 Bills');
    expect(line).toHaveTextContent('₹0.00');
  });
});
