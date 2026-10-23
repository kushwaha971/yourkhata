'use client';

import { memo, useEffect, useRef } from 'react';

import { cn } from 'src/utils/cn';

/**
 * The last row of a scrolling result list (owner, 5 Oct 2026: "on scroll that
 * pagination should work"). When it scrolls into view it asks for the next
 * page; while that page is on its way it says so.
 *
 * `IntersectionObserver` with the viewport as root still honours every
 * scrolling ancestor's clip, so the row counts as visible only when the person
 * has actually scrolled the panel down to it — not when the panel opens with
 * the row hidden below its own fold. Without the observer (jsdom, an old
 * WebView) the row is a button: tapping it loads the next page, so nothing is
 * ever unreachable.
 */
export interface UbLoadMoreProps {
  readonly onLoadMore: () => void;
  readonly loading: boolean;
  /** Failed append keeps its manual retry without an automatic retry loop. */
  readonly automatic?: boolean;
  /** Prevent a stationary sentinel chaining every page after a short/overlapping response. */
  readonly repeatWhileVisible?: boolean;
  /** "Loading more…" — said while the next page is on its way. */
  readonly loadingLabel: string;
  /** "Show more" — the fallback button's name. */
  readonly moreLabel: string;
  /** `li` inside a listbox, `div` elsewhere. */
  readonly as?: 'li' | 'div';
  readonly className?: string;
}

function UbLoadMoreBase({
  onLoadMore,
  loading,
  automatic = true,
  repeatWhileVisible = true,
  loadingLabel,
  moreLabel,
  as = 'div',
  className,
}: Readonly<UbLoadMoreProps>): React.JSX.Element {
  const node = useRef<HTMLElement | null>(null);
  const latest = useRef(onLoadMore);
  const visible = useRef(false);
  useEffect(() => {
    latest.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const target = node.current;
    if (!target || loading || !automatic || typeof IntersectionObserver !== 'function')
      return undefined;
    const observer = new IntersectionObserver((entries) => {
      const intersects = entries.some((entry) => entry.isIntersecting);
      if (intersects && (repeatWhileVisible || !visible.current)) latest.current();
      visible.current = intersects;
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, automatic, repeatWhileVisible]);

  const Tag = as;
  return (
    <Tag
      ref={(element: HTMLElement | null) => {
        node.current = element;
      }}
      role={as === 'li' ? 'presentation' : undefined}
      className={cn('flex justify-center px-3 py-2', className)}
    >
      {loading ? (
        <span role="status" className="ds-body-s-regular text-text-tertiary">
          {loadingLabel}
        </span>
      ) : (
        <button
          type="button"
          // Not a focus target in a listbox: the keyboard pages with ↓ instead.
          tabIndex={as === 'li' ? -1 : 0}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => latest.current()}
          className="ub-hit ds-body-s-medium min-h-11 px-3 text-text-accent hover:underline"
        >
          {moreLabel}
        </button>
      )}
    </Tag>
  );
}

UbLoadMoreBase.displayName = 'UbLoadMore';
export const UbLoadMore = memo(UbLoadMoreBase);
