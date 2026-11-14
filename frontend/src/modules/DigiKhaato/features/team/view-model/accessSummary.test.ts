import { accessSummary } from './accessSummary';

/**
 * A group's row must name every part once, by level, in plain words: a summary
 * that lists only the parts that are on hides what the member CANNOT do, which
 * is the thing the owner opened the list to check.
 */
const t = (id: string): string =>
  ({
    'team.access.level.full': 'Full',
    'team.access.level.view': 'View only',
    'team.access.level.off': 'Off',
    'team.access.part.sales.short': 'Sales',
    'team.access.part.stock.short': 'Stock',
    'team.access.part.purchases.short': 'Purchases',
  })[id] ?? id;

const PARTS = [
  { part: 'sales', levels: ['off', 'view', 'full'] as const },
  { part: 'purchases', levels: ['off', 'view', 'full'] as const },
  { part: 'stock', levels: ['off', 'view', 'full'] as const },
];

describe('accessSummary', () => {
  it('names every part once, grouped Full, View only, Off', () => {
    expect(accessSummary(t, PARTS, { purchases: 'off', stock: 'view' })).toBe(
      'Full: Sales · View only: Stock · Off: Purchases'
    );
  });

  it('reads a part with no level as Full', () => {
    expect(accessSummary(t, PARTS, {})).toBe('Full: Sales, Purchases, Stock');
  });
});
