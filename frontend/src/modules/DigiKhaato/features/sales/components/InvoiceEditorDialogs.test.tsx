import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from 'src/tests/renderWithProviders';
import { formatClock } from 'src/utils/dates';

import { invoiceEditorReducer } from '../redux/invoiceEditorSlice';

import { InvoiceEditorDialogs } from './InvoiceEditorDialogs';

import type { UseDraftAutosaveResult } from '../hooks/useDraftAutosave';
import type { InvoiceFormValues } from '../view-model/invoiceForm';

/*
 * 07-screens/09 §3 draft recovery, seen on the live stack (20 Oct): the offer
 * read "Restore unsaved changes from this device?" with no time, and Restore —
 * the SAFE answer, the one that keeps the bill — was drawn as the red outlined
 * danger button. A counter clerk reads red as "this deletes something" and
 * taps Discard. The time tells them which bill it is; Restore is the primary.
 */
const SAVED_AT = '2026-10-20T10:42:00.000Z';
const autosave = (over: Partial<UseDraftAutosaveResult> = {}): UseDraftAutosaveResult =>
  ({
    indicator: 'idle',
    savedAt: null,
    restore: { savedAt: SAVED_AT, version: null, form: {} as InvoiceFormValues },
    acceptRestore: jest.fn(),
    discardRestore: jest.fn(),
    postponeRestore: jest.fn(),
    clearLocal: jest.fn(),
    dirty: false,
    ...over,
  }) as UseDraftAutosaveResult;

const renderDialogs = (value: UseDraftAutosaveResult) =>
  renderWithProviders(
    <InvoiceEditorDialogs
      autosave={value}
      server={invoiceEditorReducer(undefined, { type: '@@init' })}
      confirmDelete={false}
      onConfirmDeleteChange={jest.fn()}
      onDelete={jest.fn()}
    />
  );

it('names when the unsynced bill was kept, and offers Restore as the safe primary', async () => {
  const value = autosave();
  renderDialogs(value);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent(formatClock(SAVED_AT));
  const restore = screen.getByRole('button', { name: 'Restore' });
  expect(restore.className).not.toMatch(/error/);
  await userEvent.click(restore);
  expect(value.acceptRestore).toHaveBeenCalled();
});

it('does not throw the bill away on a stray tap outside the dialog', async () => {
  const value = autosave();
  renderDialogs(value);
  await screen.findByRole('dialog');
  await userEvent.keyboard('{Escape}');
  expect(value.discardRestore).not.toHaveBeenCalled();
  expect(value.postponeRestore).toHaveBeenCalled();
});

it('throws the copy away only when Discard is chosen', async () => {
  const value = autosave();
  renderDialogs(value);
  await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));
  expect(value.discardRestore).toHaveBeenCalled();
});
