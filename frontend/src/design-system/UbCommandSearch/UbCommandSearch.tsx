'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { ArrowLeft, Loader2, Search, X } from 'lucide-react';

import {
  MLCommand,
  MLCommandGroup,
  MLCommandInput,
  MLCommandItem,
  MLCommandList,
  MLDialog,
} from 'src/design-system/primitives';
import { cn } from 'src/utils/cn';

import { UbLoadMore } from '../UbLoadMore';

import type { UbAsyncComboboxPaging } from '../UbAsyncCombobox';

/**
 * A command search whose results come in GROUPS — the header search's Start,
 * People, Items and Bills (A1, FB-011). Design: shop-fixes-and-business-types
 * §A1, `.sgh` / `.sgi` / `.pop` / `.sgfoot`.
 *
 * ── Why not `UbAsyncCombobox` ────────────────────────────────────────────────
 * A combobox picks ONE value for a field; its rows are a label and up to two
 * wrapping lines, and it lives in a popover the width of its trigger. On a
 * phone in a 44 px header slot that was the owner's complaint: a narrow list
 * over half the screen, the hint cut off, every row on two or three lines. A
 * search that STARTS things needs the whole screen on a phone, one line of
 * title and one of detail cut with "…", an amount column, and headings.
 *
 * ── Two layouts, one list ────────────────────────────────────────────────────
 * `screen` is a full-screen dialog with Back, the field and the keyboard up
 * (MLDialog's focus trap, scroll lock and focus return, keyboard-aware so the
 * list ends above the keyboard). `popover` renders in place: the field where
 * the header's field was and the list under it at the same width, with the
 * keyboard hints underneath. Both are cmdk, so ↑/↓/Enter work in both.
 */
export interface UbCommandRow {
  readonly value: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly detail?: string;
  /** Right-hand column: an amount or a price, in neutral ink as the design draws it. */
  readonly meta?: string;
}

export interface UbCommandGroupData {
  readonly id: string;
  readonly heading: string;
  readonly rows: readonly UbCommandRow[];
}

export interface UbCommandSearchProps {
  readonly layout: 'screen' | 'popover';
  /** The field's accessible name, and the dialog's. */
  readonly label: string;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly placeholder: string;
  /** One quiet line under the field (the screen) or in the footer (the popover). */
  readonly tip?: string;
  readonly groups: readonly UbCommandGroupData[];
  readonly loading: boolean;
  readonly loadingLabel: string;
  readonly emptyLabel: string;
  readonly onSelect: (value: string) => void;
  readonly onClose: () => void;
  readonly backLabel: string;
  readonly clearLabel: string;
  /** Keyboard hints at the bottom of the popover ("↑ ↓ move"). */
  readonly keyHints?: readonly { readonly keys: readonly string[]; readonly label: string }[];
  readonly paging?: UbAsyncComboboxPaging;
}

function Results({
  groups,
  loading,
  loadingLabel,
  emptyLabel,
  onSelect,
  paging,
  query,
}: Readonly<
  Pick<
    UbCommandSearchProps,
    'groups' | 'loading' | 'loadingLabel' | 'emptyLabel' | 'onSelect' | 'paging' | 'query'
  >
>) {
  const empty = groups.every((group) => group.rows.length === 0);
  return (
    <>
      {loading && empty && (
        <div className="ds-body-sm flex items-center gap-2 px-3.5 py-3 text-text-tertiary">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </div>
      )}
      {!loading && empty && query.trim() !== '' && (
        <div className="ds-body-sm px-3.5 py-6 text-center text-text-tertiary">{emptyLabel}</div>
      )}
      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <MLCommandGroup
            key={group.id}
            heading={group.heading}
            // `.sgh`: 11.5 px, 700, uppercase, 10/14/4 padding. The group itself
            // carries none — its rows run edge to edge like the design's.
            className="p-0 [&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[0.71875rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-text-tertiary"
          >
            {group.rows.map((row) => (
              <MLCommandItem
                key={row.value}
                value={row.value}
                onSelect={() => onSelect(row.value)}
                // `.sgi`: 48 px, 8/14 padding, 12 gap; the highlighted row is
                // `.sgi.hl` — the quiet accent wash with a card-coloured icon.
                className="group/row min-h-12 gap-3 rounded-none px-3.5 py-2 data-[selected=true]:!bg-accent-quiet data-[selected=true]:!text-text-primary"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-text-secondary group-data-[selected=true]/row:bg-surface-card group-data-[selected=true]/row:text-text-accent [&_svg]:!h-4 [&_svg]:!w-4">
                  {row.icon}
                </span>
                <span className="grid min-w-0 flex-1 leading-[1.3]">
                  <span className="ds-body-s-semibold truncate text-text-primary">{row.title}</span>
                  {row.detail && (
                    <span className="truncate text-[0.78125rem] text-text-tertiary">
                      {row.detail}
                    </span>
                  )}
                </span>
                {row.meta && (
                  <span className="ds-num shrink-0 whitespace-nowrap text-right text-[0.8125rem] text-text-secondary">
                    {row.meta}
                  </span>
                )}
              </MLCommandItem>
            ))}
          </MLCommandGroup>
        )
      )}
      {paging?.hasMore && !empty && (
        <UbLoadMore
          onLoadMore={paging.onLoadMore}
          loading={paging.loadingMore}
          loadingLabel={paging.loadingMoreLabel}
          moreLabel={paging.showMoreLabel}
        />
      )}
    </>
  );
}

/** The field: a search glyph, the input, and a clear button once something is typed. */
function Field({
  query,
  onQueryChange,
  placeholder,
  label,
  clearLabel,
  screen,
}: Readonly<{
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
  screen: boolean;
}>) {
  const input = useRef<HTMLInputElement>(null);
  // Focus is TAKEN here, after mount, rather than left to `autoFocus`. On a
  // phone the dialog moves focus to its first control (Back) when focus is
  // not already inside it, and the magnifier that opened the search kept it:
  // the keyboard never came up and the letters typed after the tap went to
  // the magnifier (A1, found by using it at 390 px). This field is inside the
  // dialog, so its effect runs first; MLDialog then finds focus already inside
  // and leaves it where it is.
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  return (
    <span
      className={cn(
        // `.inp.focus`: the field reads as focused for as long as the search is
        // open, because it is — the input never loses focus to the list.
        'relative flex min-w-0 flex-1 items-center rounded-control border border-text-primary bg-surface-card',
        screen ? 'h-[42px]' : 'h-10',
        // cmdk wraps its input in a bordered row with its own icon; here the
        // field is the box, so the wrapper is just the row inside it.
        '[&_[cmdk-input-wrapper]>svg]:hidden [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:px-3'
      )}
    >
      <Search aria-hidden className="ml-3 h-4 w-4 shrink-0 text-text-tertiary" />
      <MLCommandInput
        ref={input}
        value={query}
        onValueChange={onQueryChange}
        placeholder={placeholder}
        aria-label={label}
        className="ds-body-base-regular h-full py-0 pl-0 text-text-primary placeholder:text-text-tertiary"
      />
      {query && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onQueryChange('')}
          className="ub-hit mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-control text-text-tertiary hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

export function UbCommandSearch(props: Readonly<UbCommandSearchProps>): React.JSX.Element {
  const { layout, label, tip, onClose, backLabel, keyHints } = props;
  const titleId = useId();
  const field = (
    <Field
      query={props.query}
      onQueryChange={props.onQueryChange}
      placeholder={props.placeholder}
      label={label}
      clearLabel={props.clearLabel}
      screen={layout === 'screen'}
    />
  );

  if (layout === 'screen')
    return (
      <MLDialog
        open
        onOpenChange={(open) => !open && onClose()}
        labelledBy={titleId}
        keyboardAware
        className="h-dvh max-h-none rounded-none border-0 bg-surface-card shadow-none sm:w-full sm:max-w-none sm:rounded-none"
      >
        <span id={titleId} className="sr-only">
          {label}
        </span>
        <MLCommand shouldFilter={false} loop className="h-full rounded-none bg-surface-card">
          {/* `.phead` 58 px: Back (40 px), the field (42 px). */}
          <span className="flex h-[58px] shrink-0 items-center gap-1.5 border-b border-border-hairline px-2">
            <button
              type="button"
              aria-label={backLabel}
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-text-primary hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden className="h-5 w-5" />
            </button>
            {field}
          </span>
          <MLCommandList className="max-h-none min-h-0 flex-1 overflow-y-auto pb-4">
            {tip && <span className="ds-caption block px-4 pt-2 text-text-tertiary">{tip}</span>}
            <Results {...props} />
          </MLCommandList>
        </MLCommand>
      </MLDialog>
    );

  return (
    <MLCommand
      shouldFilter={false}
      loop
      label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      className="relative overflow-visible rounded-none bg-transparent"
    >
      {field}
      {/* `.pop`: under the field at its width, 12 px corners, clipped. */}
      <span className="absolute inset-x-0 top-[calc(100%+6px)] z-50 flex max-h-[min(32rem,70dvh)] flex-col overflow-clip rounded-card border border-border-hairline bg-surface-card shadow-ub-modal">
        <MLCommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
          <Results {...props} />
        </MLCommandList>
        {(keyHints?.length || tip) && (
          <span className="flex shrink-0 items-center gap-3.5 border-t border-border-hairline px-3.5 py-2 text-xs text-text-tertiary">
            {keyHints?.map((hint) => (
              <span key={hint.label} className="flex items-center gap-1 whitespace-nowrap">
                {hint.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-[4px] border border-border-hairline bg-surface-sunken px-1.5 font-sans text-[0.6875rem] font-semibold"
                  >
                    {key}
                  </kbd>
                ))}
                {hint.label}
              </span>
            ))}
            {tip && <span className="ml-auto min-w-0 truncate">{tip}</span>}
          </span>
        )}
      </span>
    </MLCommand>
  );
}
