import { act, renderHook, waitFor } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';

import { SERVER_AUTOSAVE_MS } from '../constants/salesConstants';
import { emptyInvoiceForm } from '../view-model/invoiceForm';

import { useDraftAutosave } from './useDraftAutosave';

import type { UseInvoiceEditorResult } from './useInvoiceEditor';

const mockDispatch = jest.fn();

jest.mock('src/hooks/useAppStore', () => ({
  useAppSelector: () => false,
  useAppDispatch: () => mockDispatch,
}));
jest.mock('../api/salesService', () => ({
  updateInvoice: jest.fn(async () => ({})),
}));
jest.mock('src/utils/localDrafts', () => ({
  localDraftKey: () => 'test-draft',
  isLocalNewer: jest.requireActual('src/utils/localDrafts').isLocalNewer,
  readLocalDraft: jest.fn(() => null),
  writeLocalDraft: jest.fn(),
  removeLocalDraft: jest.fn(),
}));

it('keeps edits made during an in-flight save dirty and saves them next', async () => {
  jest.useFakeTimers();
  let complete!: (value: unknown) => void;
  const save = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    )
    .mockResolvedValue(null);
  const { result, unmount } = renderHook(() => {
    const form = useForm({ defaultValues: emptyInvoiceForm('2026-10-16', 'party', '') });
    const values = useWatch({ control: form.control });
    const autosave = useDraftAutosave(
      {
        form,
        values,
        save,
        kind: 'invoice',
        preview: { subtotal: '0.00' },
        editor: { documentId: 'draft-id', version: 1, loadStatus: 'succeeded', saveState: 'idle' },
      } as unknown as UseInvoiceEditorResult,
      'draft-id'
    );
    return { form, autosave };
  });
  act(() => result.current.form.setValue('partyId', 'customer-a', { shouldDirty: true }));
  act(() => jest.advanceTimersByTime(SERVER_AUTOSAVE_MS));
  expect(save).toHaveBeenCalledTimes(1);
  act(() => result.current.form.setValue('partyId', 'customer-b', { shouldDirty: true }));
  // The second debounce expires before the slow first request finishes.
  act(() => jest.advanceTimersByTime(SERVER_AUTOSAVE_MS));
  await act(async () => {
    complete({});
  });
  expect(result.current.autosave.dirty).toBe(true);
  act(() => jest.advanceTimersByTime(SERVER_AUTOSAVE_MS));
  expect(save).toHaveBeenCalledTimes(2);
  unmount();
  jest.useRealTimers();
});

it('requires review before restoring a device copy based on an older server version', () => {
  jest.useFakeTimers();
  const local = {
    savedAt: new Date().toISOString(),
    version: 1,
    form: { ...emptyInvoiceForm('2026-10-16', 'party', ''), notes: 'device edits' },
  };
  jest.requireMock('src/utils/localDrafts').readLocalDraft.mockReturnValueOnce(local);
  const { result, unmount } = renderHook(() => {
    const form = useForm({ defaultValues: emptyInvoiceForm('2026-10-16', 'party', '') });
    const values = useWatch({ control: form.control });
    return useDraftAutosave(
      {
        form,
        values,
        save: jest.fn(),
        kind: 'invoice',
        preview: { subtotal: '0.00' },
        editor: {
          documentId: 'draft-id',
          version: 2,
          loadStatus: 'succeeded',
          saveState: 'idle',
          serverUpdatedAt: '2026-10-15T00:00:00Z',
        },
      } as unknown as UseInvoiceEditorResult,
      'draft-id'
    );
  });
  act(() => jest.advanceTimersByTime(0));
  expect(result.current.restore?.version).toBe(1);
  act(() => result.current.acceptRestore());
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'invoiceEditor/restoreConflict' })
  );
  unmount();
  jest.useRealTimers();
});

describe('the device copy of a change still inside its 500 ms', () => {
  const mount = () =>
    renderHook(() => {
      const form = useForm({ defaultValues: emptyInvoiceForm('2026-10-27', 'party', '') });
      const values = useWatch({ control: form.control });
      useDraftAutosave(
        {
          form,
          values,
          save: jest.fn().mockResolvedValue(null),
          kind: 'invoice',
          preview: { subtotal: '0.00' },
          editor: {
            documentId: 'draft-id',
            version: 1,
            loadStatus: 'succeeded',
            saveState: 'idle',
          },
        } as unknown as UseInvoiceEditorResult,
        'draft-id'
      );
      return { form };
    });
  const { writeLocalDraft } = jest.requireMock('src/utils/localDrafts') as {
    writeLocalDraft: jest.Mock;
  };

  /* Prevents (A4 monkey runs, seeds 501 and 4401): typing, then Bills or a
     reload before 500 ms of quiet — the last change was on neither the
     device nor the server. */
  it('is written at once when the bill closes', () => {
    jest.useFakeTimers();
    writeLocalDraft.mockClear();
    const { result, unmount } = mount();
    act(() => result.current.form.setValue('notes', 'typed then left', { shouldDirty: true }));
    expect(writeLocalDraft).not.toHaveBeenCalled();
    unmount();
    expect(writeLocalDraft).toHaveBeenCalledWith(
      'test-draft',
      expect.objectContaining({ notes: 'typed then left' }),
      1
    );
    jest.useRealTimers();
  });

  it('is written at once when the page unloads (a reload)', () => {
    jest.useFakeTimers();
    writeLocalDraft.mockClear();
    const { result, unmount } = mount();
    act(() => result.current.form.setValue('notes', 'typed then reloaded', { shouldDirty: true }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(writeLocalDraft).toHaveBeenCalledWith(
      'test-draft',
      expect.objectContaining({ notes: 'typed then reloaded' }),
      1
    );
    unmount();
    jest.useRealTimers();
  });
});

/** Prevents "Draft saved" over a server copy that still has the removed item (manual beginner pass, 27 Oct 2026). */
it('saves a bill already on the server even once it is emptied', () => {
  jest.useFakeTimers();
  const save = jest.fn().mockResolvedValue(null);
  const { result, unmount } = renderHook(() => {
    const form = useForm({ defaultValues: emptyInvoiceForm('2026-10-27', 'walkIn', '27') });
    const values = useWatch({ control: form.control });
    useDraftAutosave(
      {
        form,
        values,
        save,
        kind: 'invoice',
        preview: { subtotal: '0.00' },
        editor: { documentId: 'draft-id', version: 2, loadStatus: 'succeeded', saveState: 'idle' },
      } as unknown as UseInvoiceEditorResult,
      'draft-id'
    );
    return { form };
  });
  // No item and no customer: an emptied bill, edited.
  act(() => result.current.form.setValue('notes', 'emptied', { shouldDirty: true }));
  act(() => jest.advanceTimersByTime(SERVER_AUTOSAVE_MS));
  expect(save).toHaveBeenCalledWith(true);
  unmount();
  jest.useRealTimers();
});

describe('leaving the bill inside the app', () => {
  const { updateInvoice } = jest.requireMock('../api/salesService') as { updateInvoice: jest.Mock };
  const mountWith = (editorState: Record<string, unknown>) =>
    renderHook(() => {
      const form = useForm({ defaultValues: emptyInvoiceForm('2026-10-27', 'party', '27') });
      const values = useWatch({ control: form.control });
      useDraftAutosave(
        {
          form,
          values,
          save: jest.fn().mockResolvedValue(null),
          kind: 'invoice',
          preview: { subtotal: '0.00' },
          editor: {
            documentId: 'draft-id',
            version: 4,
            loadStatus: 'succeeded',
            saveState: 'idle',
            ...editorState,
          },
        } as unknown as UseInvoiceEditorResult,
        'draft-id'
      );
      return { form };
    });

  /* Prevents (monkey "kept on this device only"): a change inside its 3 s,
     then Bills — the server and the Bills list stayed behind until the bill
     was reopened and restored. */
  it('sends a change still waiting for its autosave straight to the server', async () => {
    jest.useFakeTimers();
    updateInvoice.mockClear();
    const { result, unmount } = mountWith({});
    act(() => result.current.form.setValue('partyId', 'customer-a', { shouldDirty: true }));
    act(() => jest.advanceTimersByTime(1000));
    unmount();
    jest.useRealTimers();
    await waitFor(() =>
      expect(updateInvoice).toHaveBeenCalledWith(
        'draft-id',
        expect.objectContaining({ version: 4, party_id: 'customer-a' }),
        { quiet: true }
      )
    );
  });

  it('sends nothing for an issued bill', async () => {
    jest.useFakeTimers();
    updateInvoice.mockClear();
    const { result, unmount } = mountWith({ issued: { id: 'draft-id' } });
    act(() => result.current.form.setValue('partyId', 'customer-a', { shouldDirty: true }));
    unmount();
    jest.useRealTimers();
    await new Promise((ok) => setTimeout(ok, 50));
    expect(updateInvoice).not.toHaveBeenCalled();
  });
});
