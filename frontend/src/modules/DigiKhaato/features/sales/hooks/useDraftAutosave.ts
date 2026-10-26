'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { selectActiveTenant, selectSessionUser } from 'src/redux/slice/sessionSlice';
import { draftSnapshot, settleAutosave } from 'src/utils/draftCreation';
import {
  isLocalNewer,
  localDraftKey,
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
  type LocalDraft,
} from 'src/utils/localDrafts';

import { LOCAL_AUTOSAVE_MS, SERVER_AUTOSAVE_MS } from '../constants/salesConstants';
import { restoreConflict } from '../redux/invoiceEditorSlice';
import { isCompleteLine, type InvoiceFormValues } from '../view-model/invoiceForm';

import type { UseInvoiceEditorResult } from './useInvoiceEditor';

/**
 * SAL-06 FR-1…FR-3 — never lose a half-typed bill.
 *
 * * Every change is written to THIS device 500 ms after the last keystroke.
 * * Once the bill means something (a complete line or a chosen party) it is
 *   saved to the server 3 s after the last change while dirty, so it can be
 *   opened on another device; the header shows Saving… / Saved hh:mm /
 *   Offline — saved on this device.
 * * Opening a draft whose local copy is NEWER than the server's offers to
 *   restore it; a new bill offers the unsynced one left on this device.
 *
 * The local slot of a bill that has never reached the server is `new`; after
 * its first save the copy moves under the server id.
 */
export type AutosaveIndicator = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';

const meaningful = (values: InvoiceFormValues): boolean =>
  !!values.partyId || (values.lines ?? []).some(isCompleteLine);

/**
 * QA B8 — a discount outside its limits is refused by the server (400), so a
 * save of it can only fail; it waits until the field is fixed, and the field
 * says why. The limits are the server's: a percent is 0–100; a rupee discount
 * is at most what it is taken from — the line's qty × rate, or the bill's
 * subtotal. The bill's own discount was not checked here, so 150 % off, or
 * more rupees than the subtotal, sent a refused draft every 3 s (A3, the
 * owner's question, checked live).
 */
const overLimit = (type: string, value: string, base: number): boolean => {
  const n = Number(value);
  if (!type || !value.trim() || Number.isNaN(n)) return false;
  return n < 0 || (type === 'percent' ? n > 100 : n > base);
};

export const discountsInRange = (values: InvoiceFormValues, subtotal?: string): boolean =>
  (values.lines ?? []).every(
    (line) =>
      !overLimit(
        line.discountType,
        line.discountValue ?? '',
        Number(line.qty || 0) * Number(line.unitPrice || 0)
      )
  ) &&
  (subtotal === undefined ||
    !overLimit(values.discountType, values.discountValue ?? '', Number(subtotal)));

export interface UseDraftAutosaveResult {
  readonly indicator: AutosaveIndicator;
  readonly savedAt: string | null;
  readonly restore: LocalDraft<InvoiceFormValues> | null;
  readonly acceptRestore: () => void;
  readonly discardRestore: () => void;
  /** Close the offer without answering it: the device copy is kept. */
  readonly postponeRestore: () => void;
  readonly clearLocal: () => void;
  readonly dirty: boolean;
}

export const useDraftAutosave = (
  editor: UseInvoiceEditorResult,
  documentId: string | null
): UseDraftAutosaveResult => {
  const repeatId = useSearchParams()?.get('repeat');
  const dispatch = useAppDispatch();
  const tenant = useAppSelector(selectActiveTenant);
  const offline = useAppSelector(selectNetworkImpaired);
  const user = useAppSelector(selectSessionUser);
  const userId = user?.id ?? 'none';
  const { form, values, save, editor: server, kind } = editor;
  const tenantId = tenant?.id ?? 'none';
  const slot = server.documentId ?? documentId ?? 'new';
  // Per kind: an estimate's device copy must never be offered to a bill.
  const key = localDraftKey(tenantId, kind, slot, userId);
  const dirty = form.formState.isDirty;
  const [restore, setRestore] = useState<LocalDraft<InvoiceFormValues> | null>(null);
  const saving = useRef(false);
  const [saveRevision, setSaveRevision] = useState(0);
  const checked = useRef<string | null>(null);
  const editorScope = `${tenantId}.${userId}.${kind}.${documentId ?? 'new'}`;

  // FR-3 / FR-4 — offer the device's newer copy once per editor.
  const { serverUpdatedAt, loadStatus } = server;
  useEffect(() => {
    // Once per mounted editor: a new bill's first save moves the slot, and the
    // copy written under the new id a moment later must not prompt mid-typing.
    if (checked.current === editorScope) return undefined;
    if (documentId && loadStatus !== 'succeeded') return undefined;
    checked.current = editorScope;
    const local = readLocalDraft<InvoiceFormValues>(key);
    if (!local || !isLocalNewer(local, documentId ? serverUpdatedAt : null)) return undefined;
    // Deferred a tick: the prompt opens after the form has been seeded from the server.
    const timer = window.setTimeout(() => setRestore(local), 0);
    return () => window.clearTimeout(timer);
  }, [slot, key, documentId, loadStatus, serverUpdatedAt, editorScope]);

  // FR-1 — the local copy, 500 ms after the last change.
  useEffect(() => {
    if (!dirty) return undefined;
    const timer = window.setTimeout(() => {
      writeLocalDraft(key, form.getValues(), server.version);
      if (slot !== 'new') removeLocalDraft(localDraftKey(tenantId, kind, 'new', userId));
    }, LOCAL_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, dirty, key, form, server.version, slot, tenantId, kind, userId]);

  // FR-2 — the server copy, 3 s after the last change, while dirty and meaningful.
  const blocked = offline || server.saveState === 'conflict' || server.issuing || !!server.issued;
  const subtotal = editor.preview.subtotal;
  useEffect(() => {
    if (repeatId || !dirty || blocked || !meaningful(values) || !discountsInRange(values, subtotal))
      return undefined;
    const timer = window.setTimeout(() => {
      if (saving.current) return;
      saving.current = true;
      const submitted = draftSnapshot(form.getValues());
      void save(true).then((result) => {
        saving.current = false;
        // Only the submitted values are saved; newer typing stays dirty and re-arms.
        if (result && settleAutosave(form, submitted)) setSaveRevision((revision) => revision + 1);
      });
    }, SERVER_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, dirty, blocked, save, form, saveRevision, repeatId, subtotal]);

  const acceptRestore = useCallback(() => {
    if (restore) {
      form.reset(restore.form, { keepDefaultValues: true });
      if (documentId && restore.version !== server.version) dispatch(restoreConflict());
    }
    setRestore(null);
  }, [restore, form, documentId, server.version, dispatch]);
  const discardRestore = useCallback(() => {
    removeLocalDraft(key);
    setRestore(null);
  }, [key]);
  const postponeRestore = useCallback(() => setRestore(null), []);
  /** FR-10 / §6 — issued or deleted: the device copy has done its job. */
  const clearLocal = useCallback(() => {
    removeLocalDraft(key);
    removeLocalDraft(localDraftKey(tenantId, kind, 'new', userId));
  }, [key, tenantId, kind, userId]);

  const indicator: AutosaveIndicator = offline
    ? dirty
      ? 'offline'
      : 'idle'
    : server.saveState === 'saving'
      ? 'saving'
      : server.saveState === 'conflict'
        ? 'conflict'
        : server.saveState === 'error'
          ? 'error'
          : server.savedAt
            ? 'saved'
            : 'idle';

  return {
    indicator,
    savedAt: server.savedAt,
    restore,
    acceptRestore,
    discardRestore,
    postponeRestore,
    clearLocal,
    dirty,
  };
};
