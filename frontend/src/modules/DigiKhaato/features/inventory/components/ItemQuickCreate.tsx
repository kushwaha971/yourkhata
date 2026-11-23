'use client';

import { useEffect, useRef } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';

import { lookupItemByBarcode } from '../api/itemService';
import { useItemForm } from '../hooks/useItemForm';
import { selectItemFormLastSaved } from '../redux/itemFormSlice';

import { ItemFormDrawer } from './ItemFormDrawer';

import type { ItemListRow } from '../types/item.types';

/**
 * Counter Mode step 9 — "Create “ragi” as a new item" from a bill's item
 * search: the item form, opened with the typed name, whose saved item comes
 * back as a list row for the bill to take.
 *
 * Its own module, loaded with dynamic() by `ItemQuickAdd`: the form, its
 * thunks and the items catalogue belong to the chunk that OPENS the form, not
 * to every editor route that draws the search (they cost each one the whole
 * items catalogue when imported there).
 */
export function ItemQuickCreate({
  name,
  onCreated,
  onClosed,
}: Readonly<{
  name: string;
  onCreated: (row: ItemListRow) => void;
  onClosed: () => void;
}>): React.JSX.Element | null {
  const itemForm = useItemForm();
  const { openCreate } = itemForm;
  const lastSaved = useAppSelector(selectItemFormLastSaved);
  const seen = useRef(lastSaved);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openCreate({ name });
  }, [openCreate, name]);

  useEffect(() => {
    if (lastSaved === seen.current || !lastSaved) return;
    seen.current = lastSaved;
    void lookupItemByBarcode(lastSaved.sku)
      .then((row) => {
        if (row) onCreated(row);
      })
      .catch(() => undefined)
      .finally(onClosed);
  }, [lastSaved, onCreated, onClosed]);

  // Closed without saving: the bill carries on as it was.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (itemForm.open) wasOpen.current = true;
    else if (wasOpen.current && lastSaved === seen.current) onClosed();
  }, [itemForm.open, lastSaved, onClosed]);

  return itemForm.open ? <ItemFormDrawer form={itemForm} /> : null;
}
