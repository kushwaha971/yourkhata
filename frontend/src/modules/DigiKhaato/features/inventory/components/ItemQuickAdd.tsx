'use client';

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import dynamic from 'next/dynamic';

import { AlertTriangle, ScanLine, X } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbLoadMore,
  UbSearchInput,
  UbText,
} from 'src/design-system';
import type { UbScanSheetProps } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { cn } from 'src/utils/cn';
import { scanFeedback } from 'src/utils/scanFeedback';

import { lookupItemByBarcode, restoreItem, searchItems } from '../api/itemService';
import { useItemSearch } from '../hooks/useItemSearch';

import type { ItemListRow } from '../types/item.types';

/**
 * 07-screens/09 §3 — the bill editor's always-open "Add item: name, code or
 * scan", at the top of the lines.
 *
 * The item search used to live only inside a line, so every item cost a tap on
 * "Add item" before anything could be typed, and a scanner aimed at the screen
 * had nowhere to land. This is the same search (`useItemSearch`, the one item
 * picker source) and the same scanner path (`lookup` on Enter), drawn as a
 * combobox that is always there; the caller decides which line a pick fills.
 * It holds no line state and computes no price: `onPick` hands the row on to
 * the editor's own default-line owner (`itemLineDefaults`).
 *
 * The keyboard is `PartyQuickSearch`'s: arrows move, Enter picks, Escape
 * closes. Enter while the list still answers an earlier term is the scanner's
 * cue, not a pick — a HID scanner types the code and presses Enter faster than
 * any search can reply, and picking whatever row was on screen then would bill
 * the wrong item.
 */
export interface ItemQuickAddLabels {
  readonly label: string;
  readonly placeholder: string;
  readonly empty: (query: string) => string;
  readonly none: string;
  readonly askOwner: string;
  /** "Create “ragi” as a new item"; without it nothing is offered. */
  readonly create?: (query: string) => string;
  /** "Restore Ragi flour 1 kg" — the archived look-alike, offered first. */
  readonly restore?: (name: string) => string;
  /** C1 — "Not found: <code>. The bill is not affected." Absent: a snackbar. */
  readonly notFound?: (code: string) => string;
  /** C1 — "+ Add item" on that note. */
  readonly addScanned?: string;
  /** C1 — the note's close button name. */
  readonly dismiss?: string;
  /**
   * C1 (design pScan) — the phone's camera: a teal scan button beside the
   * search that opens the full-screen camera. Absent: no camera button.
   */
  readonly camera?: {
    readonly open: string;
    readonly title: string;
    readonly hint: string;
    readonly lastScanned: string;
    /** "3 items · ₹448" — the bill so far, from the caller. */
    readonly summary: string;
    readonly labels: UbScanSheetProps['labels'];
  };
}

/* The form belongs to the chunk that OPENS it, never to the bill's route. */
/** EAN-8 … EAN-14 / UPC: what a scanner types. */
const BARCODE_SHAPE = /^\d{8,14}$/;

/* C1: the camera sheet loads when the scan button is first tapped. */
const UbScanSheet = dynamic(() => import('src/design-system').then((m) => m.UbScanSheet), {
  ssr: false,
});

const ItemQuickCreate = dynamic(() => import('./ItemQuickCreate').then((m) => m.ItemQuickCreate), {
  ssr: false, loading: () => <UbDrawerLoading />,
});

interface NoMatchAction {
  readonly id: string;
  readonly label: string;
  readonly run: () => void;
}

/*
 * The words come from the caller, as `ItemLineCell`'s do: the item-picker
 * catalogue rides with every screen that filters by item (reports, settings),
 * and five strings in two languages there cost ~0.8 KB on routes that never
 * draw this search. The editor's own catalogue carries them instead.
 */
/**
 * How the row was chosen. A scan keeps the focus here, because a HID scanner
 * types into whatever is focused: had the caret moved to Qty, the next code
 * would have been typed into the quantity. A pick from the list hands the
 * caret on, since a person choosing by name usually sets the quantity next.
 */
export type ItemQuickAddVia = 'scan' | 'list';

export interface ItemQuickAddProps {
  readonly labels: ItemQuickAddLabels;
  readonly onPick: (row: ItemListRow, via: ItemQuickAddVia) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  /** Shown at the end of the search box (design §A4 billTable). */
  readonly trailing?: ReactNode;
  /** A key that puts the caret in the search from anywhere on the page (F2). */
  readonly hotkey?: string;
}

function ItemQuickAddBase({
  labels,
  onPick,
  disabled = false,
  className,
  trailing,
  hotkey,
}: Readonly<ItemQuickAddProps>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!hotkey) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== hotkey || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { can } = usePermissions();
  const search = useItemSearch();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /*
   * The list closes a moment after the box loses focus, so a click on an
   * option still lands. That close must not outlive a return: after a pick the
   * caret moves to Qty, and a person who clicks back and types the next name
   * inside those 150 ms had the list shut on them, answered but hidden.
   */
  const closing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closing.current), []);

  /*
   * Counter Mode step 9 — nothing matches. A member who may add items is
   * offered the archived look-alike first ("ragi" is usually the Ragi flour
   * archived last month, and a second one would split its history), then
   * Create with the name typed. Whichever it is lands on the bill.
   */
  const mayAdd = can('inventory.item.write');
  const offerAdd = mayAdd && !!labels.create;
  const query = search.query.trim();
  const noMatch = search.isEmpty && !search.pending && query !== '';
  const [lookAlike, setLookAlike] = useState<{ query: string; row: ItemListRow | null } | null>(
    null
  );
  useEffect(() => {
    if (!noMatch || !offerAdd || !labels.restore) return undefined;
    const controller = new AbortController();
    searchItems(query, 1, controller.signal, { status: 'archived' })
      .then((answer) => setLookAlike({ query, row: answer.rows[0] ?? null }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [noMatch, offerAdd, labels.restore, query]);
  const archived = noMatch && lookAlike?.query === query ? lookAlike.row : null;
  const [extra, setExtra] = useState(-1);

  /** The name being made into a new item, while its form is open. */
  const [creating, setCreating] = useState<string | null>(null);
  const stopCreating = useCallback(() => setCreating(null), []);

  const choose = useCallback(
    (row: ItemListRow, via: ItemQuickAddVia = 'list') => {
      setOpen(false);
      setActive(0);
      search.clear();
      onPick(row, via);
    },
    [search, onPick]
  );

  const actions = useMemo<readonly NoMatchAction[]>(
    () =>
      !noMatch || !offerAdd
        ? []
        : [
            ...(archived && labels.restore
              ? [
                  {
                    id: 'restore',
                    label: labels.restore(archived.name),
                    run: () => {
                      const row = archived;
                      void restoreItem(row.id)
                        .then(() => lookupItemByBarcode(row.sku))
                        .then((restored) => {
                          if (restored) choose(restored);
                        })
                        .catch(() => undefined);
                    },
                  },
                ]
              : []),
            {
              id: 'create',
              label: labels.create?.(query) ?? '',
              run: () => {
                setOpen(false);
                setCreating(query);
              },
            },
          ],
    [noMatch, offerAdd, archived, labels, query, choose]
  );

  /*
   * C1 (design dScan) — an unknown code is a note under the search, not a
   * snackbar: "Not found: <code>. The bill is not affected.", with "+ Add item"
   * for a member who may, and a close. It never takes the caret, so the next
   * code can be scanned at once; the next scan replaces it.
   */
  const [missed, setMissed] = useState<string | null>(null);
  /** The person moved through the list with the arrows since typing. */
  const arrowed = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  /** C1 tray: the names scanned while the camera is open, newest first. */
  const [scanned, setScanned] = useState<readonly string[]>([]);
  const scan = useCallback(
    (code: string) => {
      void search.lookup(code).then((row) => {
        if (row) {
          setMissed(null);
          scanFeedback('added');
          setScanned((list) => [row.name, ...list].slice(0, 3));
          choose(row, 'scan');
          return;
        }
        scanFeedback('notFound');
        search.clear();
        if (labels.notFound) setMissed(code);
        else
          dispatch(
            showSnackbar({ severity: 'warning', id: 'items.scan.notFound', params: { code } })
          );
      });
    },
    [search, choose, dispatch, labels]
  );

  const handleKey = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      const code = search.query.trim();
      if (event.key === 'Enter') {
        event.preventDefault();
        // C1 (found by c1-scan): a barcode-shaped entry is a SCAN unless the
        // person arrowed to a row. The list matches numbers loosely (890… is
        // most Indian barcodes), and Enter used to pick its first row: an
        // unknown code put "Ghee 0 1kg" on the bill. Now it is an exact lookup
        // and, if it misses, the "Not found" note.
        if (BARCODE_SHAPE.test(code) && !arrowed.current) {
          scan(code);
          return;
        }
        const chosen = search.pending ? undefined : search.results[active];
        const action = open ? actions[extra] : undefined;
        if (chosen && open) choose(chosen);
        else if (action) action.run();
        else if (code) scan(code);
        return;
      }
      if (
        !search.results.length &&
        actions.length &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      ) {
        event.preventDefault();
        setOpen(true);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setExtra((index) =>
          index < 0 && step < 0
            ? actions.length - 1
            : (index + step + actions.length) % actions.length
        );
        return;
      }
      if (search.pending || !search.results.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
        if (active === search.results.length - 1 && search.hasMore) {
          search.loadMore();
          return;
        }
        arrowed.current = true;
        setActive((index) => (index + 1) % search.results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        arrowed.current = true;
        setActive((index) => (index - 1 + search.results.length) % search.results.length);
      }
    },
    [search, active, open, choose, scan, actions, extra]
  );

  if (!search.canSearch) return null;

  const showList = open && search.active;

  return (
    <UbBox className={cn('relative w-full', className)} data-testid="item-quick-add">
      <UbBox className={cn(labels.camera && 'flex items-center gap-2')}>
        <UbSearchInput
          ref={input}
          trailing={trailing}
          value={search.query}
          onChange={(next) => {
            arrowed.current = false;
            search.setQuery(next);
            setActive(0);
            setExtra(-1);
            setOpen(true);
          }}
          onFocus={() => {
            window.clearTimeout(closing.current);
            search.activate();
            setOpen(true);
          }}
          onBlur={() => {
            closing.current = window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={labels.placeholder}
          aria-label={labels.label}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && search.results[active]
              ? `${listId}-${active}`
              : showList && actions[extra]
                ? `${listId}-${actions[extra].id}`
                : undefined
          }
        />
        {labels.camera && (
          <UbButton
            variant="primary"
            iconOnly
            icon={<ScanLine aria-hidden className="h-5 w-5" />}
            className="h-11 w-11 shrink-0 !bg-action !text-white"
            onClick={() => {
              setScanned([]);
              setCameraOpen(true);
            }}
            disabled={disabled}
            data-testid="open-camera-scan"
          >
            {labels.camera.open}
          </UbButton>
        )}
      </UbBox>
      {showList && (
        <UbBox
          as="ul"
          id={listId}
          role="listbox"
          aria-label={labels.label}
          className="absolute left-0 right-0 top-11 z-40 max-h-80 overflow-y-auto rounded-control border border-border-hairline bg-surface-card py-1 shadow-2"
        >
          {search.options.length === 0 ? (
            <UbBox as="li" className="px-3 py-2">
              <UbText as="span" variant="inherit" className="ds-body-s-regular text-text-tertiary">
                {!search.isEmpty
                  ? t('common.search.loading')
                  : query
                    ? [labels.empty(query), can('inventory.item.write') ? '' : labels.askOwner]
                        .filter(Boolean)
                        .join(' ')
                    : labels.none}
              </UbText>
            </UbBox>
          ) : null}
          {search.options.length === 0 &&
            actions.map((action, index) => (
              <UbBox
                as="li"
                key={action.id}
                id={`${listId}-${action.id}`}
                role="option"
                aria-selected={index === extra}
                onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
                onClick={action.run}
                onMouseEnter={() => setExtra(index)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center px-3 py-2',
                  index === extra && 'bg-surface-hover'
                )}
              >
                <UbText
                  as="span"
                  variant="inherit"
                  className="ds-body-base-medium whitespace-normal break-words text-text-accent"
                >
                  {action.label}
                </UbText>
              </UbBox>
            ))}
          {search.options.length === 0
            ? null
            : search.options.map((option, index) => (
                <UbBox
                  as="li"
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={!search.pending && index === active}
                  aria-disabled={search.pending}
                  onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
                  onClick={() => {
                    const row = search.find(option.value);
                    if (row && !search.pending) choose(row);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    'flex cursor-pointer flex-col gap-0.5 px-3 py-2',
                    index === active && 'bg-surface-hover'
                  )}
                >
                  <UbText
                    as="span"
                    variant="inherit"
                    className="ds-body-base-medium whitespace-normal break-words text-text-primary"
                  >
                    {option.label}
                  </UbText>
                  {option.description && (
                    <UbText
                      as="span"
                      variant="inherit"
                      className="ds-num-s-regular text-text-secondary"
                    >
                      {option.description}
                    </UbText>
                  )}
                  {option.detail && (
                    <UbText
                      as="span"
                      variant="inherit"
                      className="ds-body-s-regular whitespace-normal break-words text-text-secondary"
                    >
                      {option.detail}
                    </UbText>
                  )}
                </UbBox>
              ))}
          {search.hasMore && search.options.length > 0 && (
            <UbLoadMore
              as="li"
              onLoadMore={search.loadMore}
              loading={search.status === 'loadingMore'}
              loadingLabel={t('common.search.loadingMore')}
              moreLabel={t('common.search.showMore')}
            />
          )}
        </UbBox>
      )}
      {missed !== null && labels.notFound && (
        <UbBox
          role="status"
          data-testid="scan-not-found"
          className="mt-2 flex items-center gap-2.5 rounded-md bg-warning-dim px-3 py-2 text-text-primary"
        >
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-warning" />
          <UbText as="span" variant="caption" className="min-w-0 flex-1 text-[13px]">
            {labels.notFound(missed)}
          </UbText>
          {offerAdd && labels.addScanned && (
            <UbButton
              variant="link"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setCreating(missed);
                setMissed(null);
              }}
            >
              {labels.addScanned}
            </UbButton>
          )}
          <UbButton
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X aria-hidden className="h-4 w-4" />}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMissed(null)}
          >
            {labels.dismiss ?? 'Close'}
          </UbButton>
        </UbBox>
      )}
      {labels.camera && cameraOpen && (
        <UbScanSheet
          open
          onClose={() => setCameraOpen(false)}
          onCode={scan}
          title={labels.camera.title}
          hint={labels.camera.hint}
          labels={labels.camera.labels}
          tray={
            <UbBox className="grid gap-2">
              {/* Colours on the spans themselves: UbText paints its own ink,
                  which on this dark tray was invisible (seen in c1-scan). */}
              <UbBox className="flex justify-between text-[13px]">
                <UbText as="span" variant="inherit" className="text-[#A3A9B2]">
                  {labels.camera.lastScanned}
                </UbText>
                <UbText as="span" variant="inherit" className="text-[#A3A9B2]">
                  {labels.camera.summary}
                </UbText>
              </UbBox>
              {scanned.map((name, index) => (
                <UbText
                  key={`${name}-${index}`}
                  as="span"
                  variant="inherit"
                  className={cn(
                    'truncate text-sm',
                    index === 0 ? 'font-bold text-[#6FCF7C]' : 'text-[#ECEEF0]'
                  )}
                >
                  {index === 0 ? `+ ${name}` : name}
                </UbText>
              ))}
            </UbBox>
          }
        />
      )}
      {creating !== null && (
        <ItemQuickCreate name={creating} onCreated={choose} onClosed={stopCreating} />
      )}
    </UbBox>
  );
}

ItemQuickAddBase.displayName = 'ItemQuickAdd';
export const ItemQuickAdd = memo(ItemQuickAddBase);
