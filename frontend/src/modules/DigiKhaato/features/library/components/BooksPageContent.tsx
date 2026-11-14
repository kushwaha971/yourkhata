'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbDrawer,
  UbDrawerLoading,
  UbEmptyState,
  UbFab,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbScanButton,
  UbScanSheet,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useScannerListener } from 'src/hooks/useScannerListener';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';
import { todayInTenantTz } from 'src/utils/dates';

import { giveBook, listBooks, listStudents, takeBack } from '../api/libraryService';
import { useBookScanLabels } from '../hooks/useBookScanLabels';
import { useLibraryAccess } from '../hooks/useLibraryAccess';
import { selectLibrary } from '../redux/librarySlice';
import { fetchBooks } from '../redux/libraryThunks';
import { shortDate } from '../view-model/libraryDisplay';

import { List } from './LibraryParts';

import type { Book, Student } from '../types/library.types';

type Scan = { title: string; hint: string };

const BookDrawer = dynamic(() => import('./BookDrawer').then((m) => m.BookDrawer), {
  loading: () => <UbDrawerLoading />,
});

/** One book: who has its copies; give one to a student, or take one back. */
function BookSheet({ book, onClose, onChanged }: Readonly<{ book: Book; onClose: () => void; onChanged: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const today = todayInTenantTz();
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 200);
  // Kept with the search it answers, so an old answer never shows under a new search.
  const [answer, setAnswer] = useState<{ q: string; rows: readonly Student[] }>({ q: '', rows: [] });
  const found = q && answer.q === q ? answer.rows : [];
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { canWrite } = useLibraryAccess();

  useEffect(() => {
    if (!q) return undefined;
    const controller = new AbortController();
    listStudents({ q, pageSize: 6 }, controller.signal)
      .then((p) => setAnswer({ q, rows: p.rows.filter((s) => s.status !== 'left') }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [q]);

  const act = async (id: string, run: () => Promise<void>, done: string, params: Record<string, string>) => {
    setBusy(id);
    try {
      await run();
      dispatch(showSnackbar({ severity: 'success', id: done, params }));
      onChanged();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'library.books.error').message ?? t('library.books.error') }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={book.title}
      description={t('library.books.leftOf', { left: book.left, copies: book.copies })}
      closeLabel={t('library.common.close')}
      keyboardAware
      footer={
        canWrite ? (
          <UbButton variant="outlineNeutral" onClick={() => setEditing(true)}>
            {t('library.books.edit')}
          </UbButton>
        ) : undefined
      }
    >
      <UbStack gap={3} data-testid="library-book-sheet">
        {book.out.length > 0 && (
          <List>
            {book.out.map((o) => (
              <UbBox as="li" key={o.id}>
                <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-2">
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {o.student}
                    </UbText>
                    <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                      {t('library.books.since', { date: shortDate(o.givenOn, today) })}
                    </UbText>
                  </UbStack>
                  {canWrite && (
                    <UbButton
                      size="sm"
                      variant="outlineNeutral"
                      busy={busy === o.id}
                      onClick={() => void act(o.id, () => takeBack(o.id, `${o.id}-back`), 'library.books.backDone', { name: o.student })}
                      data-testid="library-book-back"
                    >
                      {t('library.books.takeBack')}
                    </UbButton>
                  )}
                </UbStack>
              </UbBox>
            ))}
          </List>
        )}
        {!canWrite ? null : book.left > 0 ? (
          <UbStack gap={2}>
            <UbText variant="inherit" className="font-semibold">
              {t('library.books.giveTo')}
            </UbText>
            <UbSearchInput value={search} onChange={setSearch} placeholder={t('library.counter.search')} aria-label={t('library.books.giveTo')} />
            {found.length > 0 && (
              <List>
                {found.map((s) => (
                  <UbBox as="li" key={s.id}>
                    <UbPressable
                      onClick={() =>
                        void act(s.id, () => giveBook(book.id, s.id, `${book.id}-${s.id}-${Date.now()}`), 'library.books.giveDone', { title: book.title, name: s.name })
                      }
                      className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border-hairline px-4 py-2 text-left"
                      data-testid="library-book-give"
                    >
                      <UbText variant="inherit" className="text-[14px] font-medium">
                        {s.name}
                      </UbText>
                      <UbText variant="inherit" className="text-[12.5px] text-text-accent">
                        {t('library.books.give')}
                      </UbText>
                    </UbPressable>
                  </UbBox>
                ))}
              </List>
            )}
          </UbStack>
        ) : (
          <UbStatusBadge label={t('library.books.allOut')} tone="warning" />
        )}
      </UbStack>
      {editing && (
        <BookDrawer
          book={book}
          code=""
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </UbDrawer>
  );
}

/**
 * Books — the library's books and who has which one now (owner, 12 Nov: kept
 * simple). Scan a book's barcode with the phone camera or a USB scanner gun to
 * open it at once: give it, take it back, or add it if it is new. No fines,
 * holds or deposits — nothing in the design asks for them.
 */
export function BooksPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lib = useAppSelector(selectLibrary);
  const { canWrite } = useLibraryAccess();
  const labels = useBookScanLabels();
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [camera, setCamera] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ code: string } | null>(null);
  const scanTitle: Scan = useMemo(() => ({ title: t('library.books.scan.title'), hint: t('library.books.scan.hint') }), [t]);

  const load = useCallback(() => dispatch(fetchBooks({ q })), [dispatch, q]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const books = lib.books.data ?? [];
  const open = books.find((b) => b.id === openId) ?? null;

  /** A scan is an exact match, never a search: one scan, one book. */
  const onCode = useCallback(
    async (code: string) => {
      setCamera(false);
      try {
        const [hit] = await listBooks({ code });
        if (hit) {
          await dispatch(fetchBooks({ q }));
          setOpenId(hit.id);
        } else {
          dispatch(showSnackbar({ severity: 'info', id: 'library.books.scan.new', params: { code } }));
          setAdding({ code });
        }
      } catch {
        dispatch(showSnackbar({ severity: 'error', message: t('library.books.error') }));
      }
    },
    [dispatch, q, t]
  );
  // A USB scanner gun types the code and Enter while no text box has focus.
  useScannerListener((c) => void onCode(c), { enabled: !camera && !adding && !open });

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.books.title')}
          subtitle={t('library.books.subtitle')}
          actions={
            canWrite && (
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding({ code: '' })} className="max-lg:hidden">
                {t('library.books.add')}
              </UbButton>
            )
          }
          renderMobileActions={() => null}
        />
        <UbStack direction="row" gap={2} align="center">
          <UbSearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('library.books.search')}
            aria-label={t('library.books.search')}
            className="flex-1"
          />
          <UbScanButton label={t('library.books.scan.open')} onClick={() => setCamera(true)} data-testid="library-books-scan" />
        </UbStack>
        {lib.books.status === 'failed' && !lib.books.data ? (
          <UbEmptyState variant="error" title={t('library.books.error')} action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>} />
        ) : !lib.books.data ? (
          <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />
        ) : books.length === 0 ? (
          q ? (
            <UbEmptyState variant="filtered" title={t('library.books.noMatch')} />
          ) : (
            <UbEmptyState
              variant="firstUse"
              title={t('library.books.none')}
              description={t('library.books.noneBody')}
              action={canWrite ? <UbButton onClick={() => setAdding({ code: '' })}>{t('library.books.add')}</UbButton> : undefined}
            />
          )
        ) : (
          <List testId="library-books-list">
            {books.map((b) => (
              <UbBox as="li" key={b.id}>
                <UbPressable
                  onClick={() => setOpenId(b.id)}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left"
                  data-testid="library-book-row"
                >
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" className="line-clamp-2 text-[14px] font-medium">
                      {b.title}
                    </UbText>
                    <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                      {[b.author, b.out.length ? t('library.books.withNames', { names: b.out.map((o) => o.student).join(', ') }) : null]
                        .filter(Boolean)
                        .join(' · ') || t('library.books.allIn')}
                    </UbText>
                  </UbStack>
                  <UbStatusBadge
                    label={b.left > 0 ? t('library.books.leftOf', { left: b.left, copies: b.copies }) : t('library.books.allOut')}
                    tone={b.left > 0 ? 'success' : 'warning'}
                  />
                </UbPressable>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
      {canWrite && <UbFab label={t('library.books.add')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => setAdding({ code: '' })} />}
      {camera && (
        <UbScanSheet open onClose={() => setCamera(false)} onCode={(c) => void onCode(c)} title={scanTitle.title} hint={scanTitle.hint} labels={labels} />
      )}
      {open && <BookSheet book={open} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
      {adding && (
        <BookDrawer
          book={null}
          code={adding.code}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void load();
          }}
        />
      )}
    </UbPageShell>
  );
}
