import { render, screen } from '@testing-library/react';

import { UbCountLine, type UbCountLineItem } from './UbCountLine';

const items: readonly UbCountLineItem[] = [
  { id: 'c', template: 'To collect {amount}', values: { amount: { text: '₹18,450', tone: 'receivable' as const } } },
  { id: 's', template: 'Showing {n} of {total} customers', values: { n: { text: '6' }, total: { text: '1,760' } } },
];

describe('UbCountLine', () => {
  it('puts each figure where its sentence wants it, in bold', () => {
    /** Hindi orders the figures differently, so the sentence is split at its slots. */
    render(
      <UbCountLine
        items={[{ id: 'h', template: '{total} में से {n} ग्राहक', values: { n: { text: '6' }, total: { text: '1,760' } } }]}
      />
    );
    const line = screen.getByTestId('count-line');
    expect(line).toHaveTextContent('1,760 में से 6 ग्राहक');
    expect([...line.querySelectorAll('[data-part=value]')].map((b) => b.textContent)).toEqual(['1,760', '6']);
  });

  it('keeps its words while loading and only greys the figures', () => {
    /**
     * The defect it prevents: the old summary swapped itself for a skeleton of
     * another height while a search ran, and the table jumped up.
     */
    render(<UbCountLine items={items} loading loadingNote="Searching…" />);
    const line = screen.getByTestId('count-line');
    expect(line).toHaveTextContent('To collect ₹18,450Showing 6 of 1,760 customersSearching…');
    expect(line).toHaveAttribute('aria-busy', 'true');
    for (const value of line.querySelectorAll('[data-part=value]')) {
      expect(value.className).toContain('text-transparent');
      expect(value.className).toContain('bg-surface-sunken');
    }
  });

  it('colours a figure by its side once loaded', () => {
    render(<UbCountLine items={items} />);
    const [collect] = screen.getByTestId('count-line').querySelectorAll('[data-part=value]');
    expect(collect?.className).toContain('text-get');
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
  });
});
