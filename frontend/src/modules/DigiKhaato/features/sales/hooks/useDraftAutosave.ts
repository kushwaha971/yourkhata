'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { LINE_AMOUNT_LIMIT, LINE_QTY_LIMIT, LINE_RATE_LIMIT } from 'src/constants';
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
import { isCompleteLine, toWireBody, type InvoiceFormValues } from '../view-model/invoiceForm';

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

/**
 * FB-020 — a line over the quantity, rate or amount limit would only be refused
 * (400), and so would a fraction of a whole-number unit ("3.141 NOS", found by
 * the A4 monkey run: a refused save every 3 s under the field's own message).
 */
const lineOverLimit = (qty: string, rate: string, allowDecimal?: boolean): boolean => {
  const q = Number(qty || 0);
  const r = Number(rate || 0);
  return (
    (allowDecimal === false && !Number.isInteger(q)) ||
    q > Number(LINE_QTY_LIMIT) ||
    r > Number(LINE_RATE_LIMIT) ||
    q * r > Number(LINE_AMOUNT_LIMIT)
  );
};

export const discountsInRange = (values: InvoiceFormValues, subtotal?: string): boolean =>
  (values.lines ?? []).every(
    (line) => !lineOverLimit(line.qty ?? '', line.unitPrice ?? '', line.allowDecimal)
  ) &&
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

  // A change still waiting for its 500 ms is written at once when the bill
  // closes or the page unloads: a merchant who keeps typing and then taps
  // Bills, or reloads, never gave the timer its quiet half-second, and that
  // change was on neither the device nor the server (A4 monkey runs, seeds
  // 501 and 4401). One synchronous write; nothing waits on the network.
  const pendingLocal = useRef<(() => void) | null>(null);
  const leaveSave = useRef<(() => void) | null>(null);
  const serverRef = useRef(server);
  useEffect(() => {
    serverRef.current = server;
  }, [server]);
  useEffect(() => {
    const flush = () => {
      pendingLocal.current?.();
      pendingLocal.current = null;
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // FR-1 — the local copy, 500 ms after the last change.
  useEffect(() => {
    if (!dirty) return undefined;
    pendingLocal.current = () => writeLocalDraft(key, form.getValues(), server.version);
    const timer = window.setTimeout(() => {
      pendingLocal.current = null;
      writeLocalDraft(key, form.getValues(), server.version);
      if (slot !== 'new') removeLocalDraft(localDraftKey(tenantId, kind, 'new', userId));
    }, LOCAL_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, dirty, key, form, server.version, slot, tenantId, kind, userId]);

  // FR-2 — the server copy, 3 s after the last change, while dirty and meaningful.
  const blocked = offline || server.saveState === 'conflict' || server.issuing || !!server.issued;
  const subtotal = editor.preview.subtotal;
  useEffect(() => {
    // A bill already on the server is saved even once it is emptied: skipping
    // it left the removed item on the server under "Draft saved" (manual
    // beginner pass, 27 Oct 2026). A never-saved empty bill still waits.
    const worth = meaningful(values) || !!server.documentId;
    leaveSave.current = null;
    if (repeatId || !dirty || blocked || !worth || !discountsInRange(values, subtotal))
      return undefined;
    // Armed while this change waits for its 3 s: leaving the bill inside the
    // app sends it at once (see the unmount effect below).
    if (kind === 'invoice')
      leaveSave.current = () => {
        // The id and version as they are when the bill closes, not when armed.
        const { documentId: savedId, version } = serverRef.current;
        if (!savedId || version === null) return;
        void import('../api/salesService')
          .then(({ updateInvoice }) =>
            updateInvoice(savedId, { ...toWireBody(form.getValues()), version }, { quiet: true })
          )
          .catch(() => undefined);
      };
    const timer = window.setTimeout(() => {
      leaveSave.current = null;
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
  }, [
    values,
    dirty,
    blocked,
    save,
    form,
    saveRevision,
    repeatId,
    subtotal,
    server.documentId,
    kind,
  ]);

  // Leaving the bill inside the app (Bills, Back, another page) sends a change
  // still inside its 3 s straight to the server, so the Bills list, the held
  // strip and another device are never behind (owner delegated, 27 Oct 2026;
  // the monkey's "kept on this device only" warning). The SERVICE is called,
  // not the editor's thunk: a reply landing in the store after close is how
  // the old draft's address came back (E3). A reload or a closed tab cannot
  // finish a request reliably; the device copy, written at once on `pagehide`,
  // covers those. A refusal (a newer version elsewhere) leaves the device copy
  // to be offered back.
  useEffect(
    () => () => {
      leaveSave.current?.();
      leaveSave.current = null;
    },
    []
  );

  const acceptRestore = useCallback(() => {
    if (restore) {
      form.reset(restore.form, { keepDefaultValues: true });
      if (documentId && restore.version !== server.version) dispatch(restoreConflict());
    }
    setRestore(null);
  }, [restore, form, documentId, server.version, dispatch]);
  const discardRestore = useCallback(() => {
    pendingLocal.current = null;
    leaveSave.current = null;
    removeLocalDraft(key);
    setRestore(null);
  }, [key]);
  const postponeRestore = useCallback(() => setRestore(null), []);
  /** FR-10 / §6 — issued or deleted: the device copy has done its job. */
  const clearLocal = useCallback(() => {
    pendingLocal.current = null;
    leaveSave.current = null;
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
