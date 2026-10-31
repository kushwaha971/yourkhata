'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';
import { addQuantity, exceedsQuantity, trimQuantity } from 'src/utils/quantity';

import {
  addPlace,
  listPlaces,
  placeStock,
  postTransfer,
  type Place,
  type PlaceStock,
} from '../api/transferService';

export interface TransferRow extends PlaceStock {
  readonly qty: string;
}

/**
 * D P1c — Move stock (design D10). The shop's places, the two chosen, the
 * items being moved with what each place holds now, and the move itself. A
 * line asking for more than the source holds is said on the line ("Only 9 in
 * Godown") before the server refuses it.
 */
export function useStockTransfer(): ReturnType<typeof useStockTransferState> {
  return useStockTransferState();
}

function useStockTransferState() {
  const dispatch = useAppDispatch();
  const idempotency = useIdempotencyKey();
  const [places, setPlaces] = useState<readonly Place[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<readonly TransferRow[]>([]);
  const [saving, setSaving] = useState(false);

  const applyPlaces = useCallback((list: readonly Place[]) => {
    setPlaces(list);
    const shop = list.find((place) => place.isDefault) ?? list[0];
    const other = list.find((place) => place !== shop);
    // D10 draws Godown → Shop: stock usually comes out of the godown.
    if (shop && other) {
      setFrom((current) => current || other.id);
      setTo((current) => current || shop.id);
    }
  }, []);
  const loadPlaces = useCallback(
    () =>
      listPlaces()
        .catch(() => [])
        .then(applyPlaces),
    [applyPlaces]
  );

  useEffect(() => {
    let alive = true;
    void listPlaces()
      .catch(() => [])
      .then((list) => {
        if (alive) applyPlaces(list);
      });
    return () => {
      alive = false;
    };
  }, [applyPlaces]);

  const refresh = useCallback(
    async (ids: readonly string[], keep: readonly TransferRow[]) => {
      if (!from || !to || ids.length === 0) return;
      const stock = await placeStock(from, to, ids).catch(() => null);
      if (!stock) return;
      setRows(
        ids.flatMap((id) => {
          const row = stock.find((one) => one.itemId === id);
          if (!row) return [];
          return [{ ...row, qty: keep.find((one) => one.itemId === id)?.qty ?? '' }];
        })
      );
    },
    [from, to]
  );

  // Swapping or changing a place re-reads both columns for the same items.
  const setPlace = useCallback(
    (side: 'from' | 'to', id: string) => {
      const nextFrom = side === 'from' ? id : from;
      const nextTo = side === 'to' ? id : to;
      if (side === 'from') setFrom(id);
      else setTo(id);
      if (!nextFrom || !nextTo || rows.length === 0) return;
      void placeStock(
        nextFrom,
        nextTo,
        rows.map((row) => row.itemId)
      )
        .then((stock) =>
          setRows((all) =>
            all.map((row) => {
              const fresh = stock.find((one) => one.itemId === row.itemId);
              return fresh ? { ...fresh, qty: row.qty } : row;
            })
          )
        )
        .catch(() => undefined);
    },
    [from, to, rows]
  );

  const addItem = useCallback(
    (itemId: string, add?: number) => {
      const existing = rows.find((row) => row.itemId === itemId);
      if (existing) {
        if (add)
          setRows((all) =>
            all.map((row) =>
              row.itemId === itemId ? { ...row, qty: trimQuantity(addQuantity(row.qty || '0', String(add))) } : row
            )
          );
        return;
      }
      const next = [...rows, { itemId, qty: add ? String(add) : '' } as TransferRow];
      void refresh(
        next.map((row) => row.itemId),
        next
      );
    },
    [rows, refresh]
  );

  const setQty = useCallback(
    (itemId: string, qty: string) =>
      setRows((all) => all.map((row) => (row.itemId === itemId ? { ...row, qty } : row))),
    []
  );
  const removeItem = useCallback(
    (itemId: string) => setRows((all) => all.filter((row) => row.itemId !== itemId)),
    []
  );

  const swap = useCallback(() => {
    const [nextFrom, nextTo] = [to, from];
    setFrom(nextFrom);
    setTo(nextTo);
    if (rows.length > 0)
      void placeStock(
        nextFrom,
        nextTo,
        rows.map((row) => row.itemId)
      )
        .then((stock) =>
          setRows((all) =>
            all.map((row) => {
              const fresh = stock.find((one) => one.itemId === row.itemId);
              return fresh ? { ...fresh, qty: row.qty } : row;
            })
          )
        )
        .catch(() => undefined);
  }, [from, to, rows]);

  const short = useCallback(
    (row: TransferRow) => Boolean(row.qty) && exceedsQuantity(row.qty, row.atFrom || '0'),
    []
  );
  const ready = useMemo(
    () =>
      Boolean(from && to && from !== to) &&
      rows.length > 0 &&
      rows.every((row) => /[1-9]/.test(row.qty) && !short(row)),
    [from, to, rows, short]
  );

  const save = useCallback(async () => {
    if (!ready || saving) return false;
    setSaving(true);
    try {
      const result = await postTransfer(
        {
          from_location_id: from,
          to_location_id: to,
          lines: rows.map((row) => ({ item_id: row.itemId, qty: row.qty })),
        },
        idempotency.key
      );
      idempotency.rotate();
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'stock.transfer.saved',
          params: { count: rows.length, number: result.number },
        })
      );
      setRows([]);
      return true;
    } catch (thrown) {
      const error = toApiError(thrown);
      dispatch(showSnackbar({ severity: 'error', message: error.message }));
      // Someone else may have moved stock meanwhile: show the places as they are.
      void refresh(
        rows.map((row) => row.itemId),
        rows
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [ready, saving, from, to, rows, idempotency, dispatch, refresh]);

  const createPlace = useCallback(
    async (name: string) => {
      try {
        await addPlace(name);
        await loadPlaces();
        return null;
      } catch (thrown) {
        return toApiError(thrown).message;
      }
    },
    [loadPlaces]
  );

  return {
    places,
    from,
    to,
    setFrom: (id: string) => setPlace('from', id),
    setTo: (id: string) => setPlace('to', id),
    swap,
    rows,
    addItem,
    setQty,
    removeItem,
    short,
    ready,
    saving,
    save,
    createPlace,
  };
}
