import { saveDraftWithRecovery } from './draftRecovery';

import type { InvoiceEditorState } from '../redux/invoiceEditorSlice';
import type { InvoiceFormValues } from '../view-model/invoiceForm';
import type { UseFormReturn } from 'react-hook-form';

const form = {
  getValues: () => ({ clientDraftKey: 'k1', lines: [] }) as unknown as InvoiceFormValues,
  setValue: jest.fn(),
} as unknown as UseFormReturn<InvoiceFormValues>;

const editor = (over: Partial<InvoiceEditorState>): InvoiceEditorState =>
  ({
    documentId: 'd1',
    version: 3,
    loadStatus: 'succeeded',
    saveState: 'saved',
    issuing: false,
    issued: null,
    ...over,
  }) as unknown as InvoiceEditorState;

/**
 * A3 functional run, found on the live stack: Issue saves the bill first; an
 * autosave whose 3 s timer fired during that save QUEUED behind it. When the
 * save returned, the queued autosave and Issue's `/issue` request started in
 * the same tick — a PATCH racing the issue, refused with 409
 * `document_not_draft` (+5612 ms, both). A save whose turn comes while the
 * bill is being issued must send nothing: the issue carries the bill.
 */
it('sends nothing when its turn comes while the bill is being issued', async () => {
  const send = jest.fn();
  const result = await saveDraftWithRecovery({
    form,
    kind: 'invoice',
    documentId: null,
    tenantId: 't1',
    userId: 'u1',
    quiet: true,
    currentScope: () => true,
    getEditor: () => editor({ issuing: true }),
    send,
  });
  expect(result).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

/** The guard is about issuing only: an ordinary draft save still goes out. */
it('still saves a draft that is not being issued', async () => {
  const send = jest.fn().mockResolvedValue(null);
  await saveDraftWithRecovery({
    form,
    kind: 'invoice',
    documentId: null,
    tenantId: 't1',
    userId: 'u1',
    quiet: true,
    currentScope: () => true,
    getEditor: () => editor({}),
    send,
  });
  expect(send).toHaveBeenCalledTimes(1);
});
