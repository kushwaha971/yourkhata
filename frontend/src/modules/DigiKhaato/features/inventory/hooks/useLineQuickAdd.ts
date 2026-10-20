'use client';

import { useCallback, useMemo, useState } from 'react';

import type { UbLineFocusRequest } from 'src/design-system';
import { stepQuantity } from 'src/utils/quantity';

import type { ItemQuickAddVia } from '../components/ItemQuickAdd';
import type { ItemListRow } from '../types/item.types';

interface CounterLine {
  readonly itemId: string | null;
  readonly description: string;
  readonly qty: string;
  readonly unitCode: string;
}

interface LineQuickAddResult {
  readonly quickAdd: (item: ItemListRow, via: ItemQuickAddVia) => void;
  readonly focusRequest: UbLineFocusRequest | null;
  readonly lineOptions: readonly { value: string; label: string }[];
  readonly findLine: (value: string) => void;
}

/** Shared counter orchestration only: each document retains its own pricing/default owner. */
export function useLineQuickAdd({
  lines,
  readLines,
  appendEmpty,
  pick,
  setQuantity,
  maxLines,
  lineLabel,
  disabled = false,
}: Readonly<{
  lines: readonly CounterLine[] | undefined;
  readLines: () => readonly CounterLine[];
  appendEmpty: () => void;
  pick: (index: number, item: ItemListRow) => void;
  setQuantity: (index: number, quantity: string) => void;
  maxLines: number;
  lineLabel: (number: number) => string;
  disabled?: boolean;
}>): LineQuickAddResult {
  const [focusRequest, setFocusRequest] = useState<UbLineFocusRequest | null>(null);
  const focusQuantity = useCallback((row: number) => {
    setFocusRequest((previous) => ({ row, col: 1, seq: (previous?.seq ?? 0) + 1 }));
  }, []);
  const quickAdd = useCallback(
    (item: ItemListRow, via: ItemQuickAddVia) => {
      if (disabled) return;
      const current = readLines();
      const same = current.map((line) => line.itemId).lastIndexOf(item.id);
      const counted = same >= 0 ? stepQuantity(current[same]?.qty ?? '') : null;
      if (same >= 0 && counted !== null && counted !== current[same]?.qty) {
        setQuantity(same, counted);
        if (via === 'list') focusQuantity(same);
        return;
      }
      const last = current.length - 1;
      const trailingEmpty = last >= 0 && !current[last]?.itemId && !current[last]?.description;
      if (!trailingEmpty && current.length >= maxLines) return;
      const index = trailingEmpty ? last : current.length;
      if (!trailingEmpty) appendEmpty();
      pick(index, item);
      // The search owns its scanner caret. A list choice moves to this line's Qty.
      if (via === 'list') focusQuantity(index);
    },
    [disabled, readLines, setQuantity, focusQuantity, maxLines, appendEmpty, pick]
  );
  const lineOptions = useMemo(
    () =>
      (lines ?? []).flatMap((line, index) =>
        line.description
          ? [
              {
                value: String(index),
                label: [
                  lineLabel(index + 1),
                  line.description,
                  `${line.qty || '0'} ${line.unitCode}`,
                ].join(' · '),
              },
            ]
          : []
      ),
    [lines, lineLabel]
  );
  const findLine = useCallback(
    (value: string) => {
      if (disabled || !/^\d+$/.test(value)) return;
      const row = Number(value);
      if (row < readLines().length) focusQuantity(row);
    },
    [disabled, readLines, focusQuantity]
  );
  return { quickAdd, focusRequest, lineOptions, findLine };
}

export const LINE_FINDER_FROM = 10;
