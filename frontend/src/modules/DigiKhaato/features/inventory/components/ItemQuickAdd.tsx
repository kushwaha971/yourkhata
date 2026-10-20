'use client';

import { memo, useCallback, useId, useState } from 'react';

import { UbBox, UbLoadMore, UbSearchInput, UbText } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { cn } from 'src/utils/cn';

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
}

/*
 * The words come from the caller, as `ItemLineCell`'s do: the item-picker
 * catalogue rides with every screen that filters by item (reports, settings),
 * and five strings in two languages there cost ~0.8 KB on routes that never
 * draw this search. The editor's own catalogue carries them instead.
 */
export interface ItemQuickAddProps {
  readonly labels: ItemQuickAddLabels;
  readonly onPick: (row: ItemListRow) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

function ItemQuickAddBase({
  labels,
  onPick,
  disabled = false,
  className,
}: Readonly<ItemQuickAddProps>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { can } = usePermissions();
  const search = useItemSearch();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const choose = useCallback(
    (row: ItemListRow) => {
      setOpen(false);
      setActive(0);
      search.clear();
      onPick(row);
    },
    [search, onPick]
  );

  const scan = useCallback(
    (code: string) => {
      void search.lookup(code).then((row) => {
        if (row) choose(row);
        else
          dispatch(
            showSnackbar({ severity: 'warning', id: 'items.scan.notFound', params: { code } })
          );
      });
    },
    [search, choose, dispatch]
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
        const chosen = search.pending ? undefined : search.results[active];
        if (chosen && open) choose(chosen);
        else if (code) scan(code);
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
        setActive((index) => (index + 1) % search.results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (index - 1 + search.results.length) % search.results.length);
      }
    },
    [search, active, open, choose, scan]
  );

  if (!search.canSearch) return null;

  const showList = open && search.active;
  const query = search.query.trim();

  return (
    <UbBox className={cn('relative w-full', className)} data-testid="item-quick-add">
      <UbSearchInput
        value={search.query}
        onChange={(next) => {
          search.setQuery(next);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          search.activate();
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder={labels.placeholder}
        aria-label={labels.label}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && search.results[active] ? `${listId}-${active}` : undefined
        }
      />
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
          ) : (
            search.options.map((option, index) => (
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
            ))
          )}
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
    </UbBox>
  );
}

ItemQuickAddBase.displayName = 'ItemQuickAdd';
export const ItemQuickAdd = memo(ItemQuickAddBase);
