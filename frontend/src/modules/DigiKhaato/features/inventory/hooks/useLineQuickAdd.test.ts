import { act, renderHook } from '@testing-library/react';

import { useLineQuickAdd } from './useLineQuickAdd';

import type { ItemListRow } from '../types/item.types';

// Orchestration reads only identity; each feature's pick owns the other item fields.
const item = { id: 'new' } as ItemListRow;
const row = (id: string | null, qty = '1') => ({
  itemId: id,
  description: id ?? '',
  qty,
  unitCode: 'NOS',
});
const setup = (lines: ReturnType<typeof row>[]) => {
  const appendEmpty = jest.fn(),
    pick = jest.fn(),
    setQuantity = jest.fn();
  const view = renderHook(() =>
    useLineQuickAdd({
      lines,
      readLines: () => lines,
      appendEmpty,
      pick,
      setQuantity,
      maxLines: 100,
      lineLabel: (n) => `Line ${n}`,
    })
  );
  return { ...view, appendEmpty, pick, setQuantity };
};

it('uses a trailing empty slot at the limit, but never appends past100 rows', () => {
  // Prevents quick-add bypassing the existing document line limit.
  const empty = setup([...Array.from({ length: 99 }, (_, i) => row(String(i))), row(null)]);
  act(() => empty.result.current.quickAdd(item, 'list'));
  expect(empty.pick).toHaveBeenCalledWith(99, item);
  expect(empty.appendEmpty).not.toHaveBeenCalled();
  const full = setup(Array.from({ length: 100 }, (_, i) => row(String(i))));
  act(() => full.result.current.quickAdd(item, 'list'));
  expect(full.pick).not.toHaveBeenCalled();
  expect(full.appendEmpty).not.toHaveBeenCalled();
});

it('increments exact loose quantity at the limit without reapplying defaults or claiming scanner focus', () => {
  // Prevents float drift and a repeat scan resetting bill-specific cost/discount.
  const lines = Array.from({ length: 100 }, (_, i) => row(String(i)));
  lines[12] = row(item.id, '0.125');
  const view = setup(lines);
  act(() => view.result.current.quickAdd(item, 'scan'));
  expect(view.setQuantity).toHaveBeenCalledWith(12, '1.125');
  expect(view.pick).not.toHaveBeenCalled();
  expect(view.result.current.focusRequest).toBeNull();
  act(() => view.result.current.quickAdd(item, 'list'));
  expect(view.result.current.focusRequest).toMatchObject({ row: 12, col: 1 });
});

it('uses numbered choices for identical names and rejects invalid finder indexes', () => {
  // Prevents selecting a different same-named line or a nonexistent row.
  const view = setup([row('cable'), row('cable', '2')]);
  expect(view.result.current.lineOptions.map((x) => x.label)).toEqual([
    'Line 1 · cable · 1 NOS',
    'Line 2 · cable · 2 NOS',
  ]);
  for (const value of ['', '-1', '2', 'nope']) act(() => view.result.current.findLine(value));
  expect(view.result.current.focusRequest).toBeNull();
  act(() => view.result.current.findLine('1'));
  expect(view.result.current.focusRequest).toMatchObject({ row: 1, col: 1 });
});
