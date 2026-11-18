'use client';

import { useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import { UbButton, UbDrawer, UbField, UbForm, UbScanButton, UbScanSheet, UbStack, UbTextInput } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';

import { saveBook } from '../api/libraryService';
import { useBookScanLabels } from '../hooks/useBookScanLabels';
import { useLibrarySchemas, type BookValues } from '../validation/librarySchemas';

import type { Book } from '../types/library.types';

/**
 * Add or edit a book. Its own file so the form (React Hook Form, the Yup
 * schema) loads when Add or Edit is tapped, not with the list.
 */
export function BookDrawer({
  book,
  code,
  onClose,
  onSaved,
}: Readonly<{ book: Book | null; code: string; onClose: () => void; onSaved: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const labels = useBookScanLabels();
  const { bookSchema } = useLibrarySchemas();
  const { key, rotate } = useIdempotencyKey();
  const [saving, setSaving] = useState(false);
  const [camera, setCamera] = useState(false);
  const form = useForm<BookValues>({
    resolver: yupResolver(bookSchema),
    mode: 'onTouched',
    defaultValues: {
      title: book?.title ?? '',
      author: book?.author ?? '',
      copies: String(book?.copies ?? 1),
      code: book?.code ?? code,
    },
  });
  const save = async (values: BookValues) => {
    setSaving(true);
    try {
      await saveBook(values, book?.id ?? null, key);
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'library.books.saved', params: { title: values.title } }));
      onSaved();
    } catch (e) {
      const err = toApiError(e, 'library.books.saveError');
      if (err.code === 'code_in_use') form.setError('code', { message: err.message ?? '' });
      else dispatch(showSnackbar({ severity: 'error', message: err.message ?? t('library.books.saveError') }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t(book ? 'library.books.edit' : 'library.books.add')}
      closeLabel={t('library.common.close')}
      keyboardAware
      footer={
        <UbButton type="submit" form={formId} busy={saving} size="lg" data-testid="library-book-save">
          {t('library.common.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save}>
        <UbField name="title" label={t('library.books.titleLabel')} required>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" autoFocus />}
        </UbField>
        <UbField name="author" label={t('library.books.author')} optionalLabel={t('library.common.optional')}>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" />}
        </UbField>
        <UbField name="copies" label={t('library.books.copies')} required>
          {(field) => <UbTextInput {...field} value={field.value as string} inputMode="numeric" />}
        </UbField>
        <UbField name="code" label={t('library.books.code')} hint={t('library.books.codeHint')} optionalLabel={t('library.common.optional')}>
          {(field) => (
            <UbStack direction="row" gap={2}>
              <UbTextInput {...field} value={field.value as string} autoComplete="off" className="flex-1" />
              <UbScanButton label={t('library.books.scan.open')} onClick={() => setCamera(true)} data-testid="library-book-code-scan" />
            </UbStack>
          )}
        </UbField>
      </UbForm>
      {camera && (
        <UbScanSheet
          open
          onClose={() => setCamera(false)}
          onCode={(c) => {
            form.setValue('code', c, { shouldValidate: true });
            setCamera(false);
          }}
          title={t('library.books.scan.codeTitle')}
          hint={t('library.books.scan.hint')}
          labels={labels}
        />
      )}
    </UbDrawer>
  );
}
