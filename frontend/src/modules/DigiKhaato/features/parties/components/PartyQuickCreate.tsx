'use client';

import { useEffect, useRef } from 'react';

import { usePartyForm } from '../hooks/usePartyForm';

import { PartyFormDrawer } from './PartyFormDrawer';

import type { PartyKind } from '../constants/partyFilters';

/**
 * Counter Mode "find or start" — "Add “Ramesh Electricals” as a new customer"
 * from a picker's search: the contact form, opened with the typed name, whose
 * saved contact comes back to the picker.
 *
 * Its own module, loaded with dynamic() by the picker's caller: the form, its
 * schema and the parties catalogue belong to the chunk that OPENS the form,
 * not to every screen that draws a picker.
 */
export function PartyQuickCreate({
  name,
  kind,
  shop = true,
  onCreated,
  onClosed,
}: Readonly<{
  name: string;
  kind: PartyKind;
  shop?: boolean;
  onCreated: (id: string, name: string) => void;
  onClosed: () => void;
}>): React.JSX.Element | null {
  const partyForm = usePartyForm();
  const { openCreate, lastSaved, open } = partyForm;
  const seen = useRef(lastSaved);
  const opened = useRef(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openCreate(name);
  }, [openCreate, name]);

  useEffect(() => {
    if (lastSaved === seen.current || !lastSaved) return;
    seen.current = lastSaved;
    onCreated(lastSaved.id, lastSaved.name);
    onClosed();
  }, [lastSaved, onCreated, onClosed]);

  // Closed without saving: the bill carries on as it was.
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current && lastSaved === seen.current) onClosed();
  }, [open, lastSaved, onClosed]);

  return open ? <PartyFormDrawer form={partyForm} kind={kind} shop={shop} /> : null;
}
