import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';

import { MessagePreview } from 'modules/DigiKhaato/features/appParts/AppParts';

/**
 * QA audit, 13 Nov 2026. `/lending/messages` was 2 px wider than a 390 px phone
 * (`e2e/monkey.mjs --path=/lending --seed=11 --width=390`). The page's grid had
 * no column of its own below `lg`, so its one implicit column grew to the widest
 * row: a borrower with a long name, whose `truncate` hides the words but not
 * their width. A grid that holds rows names a column that may shrink. jsdom has
 * no layout, so this pins the rule in the source; the monkey measures the page.
 */
describe('The message preview never widens the page', () => {
  it('has one column that may shrink, and a bubble whose words may break anywhere', () => {
    render(<MessagePreview text={'x'.repeat(400)} />);
    const box = screen.getByTestId('message-preview');
    expect(box.className).toContain('grid-cols-[minmax(0,1fr)]');
    expect(box.className).toContain('min-w-0');
    expect(screen.getByText('x'.repeat(400)).className).toContain('[overflow-wrap:anywhere]');
  });

  it('shows the editor in place of the bubble while the message is being changed', () => {
    render(
      <MessagePreview text="Namaste">
        <textarea aria-label="Edit" defaultValue="Namaste" />
      </MessagePreview>
    );
    expect(screen.getByLabelText('Edit')).toBeInTheDocument();
    expect(screen.queryByText('Namaste', { selector: 'p' })).not.toBeInTheDocument();
  });
});

describe('A page grid of rows never grows to its longest row', () => {
  const FEATURES = join(process.cwd(), 'src/modules/DigiKhaato/features');
  const PAGES = [
    'lending/components/MessagesPageContent.tsx',
    'lending/components/LoanPageContent.tsx',
    'lending/components/NewLoanPageContent.tsx',
    'library/components/StudentPageContent.tsx',
    'library/components/SeatsPageContent.tsx',
  ];

  it.each(PAGES)('%s gives its two-part grid a column that may shrink on a phone', (file) => {
    const grids = readFileSync(join(FEATURES, file), 'utf8').match(/className="grid [^"]*lg:\[grid-template-columns:[^"]*"/g) ?? [];
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) expect(grid).toContain('grid-cols-[minmax(0,1fr)]');
  });
});
