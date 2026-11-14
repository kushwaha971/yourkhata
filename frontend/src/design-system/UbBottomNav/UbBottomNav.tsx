'use client';

import { memo, type ReactNode } from 'react';

import Link from 'next/link';

import { UbBottomBar } from 'src/design-system/UbBottomBar';
import { cn } from 'src/utils/cn';

/**
 * docs/mobile-redesign/04 §6.1 — the phone's navigation bar: four destinations
 * and More, at the bottom of the screen, below `lg`.
 *
 * Until this existed the phone had no navigation at all — every screen sat
 * behind a ☰ drawer that held the desktop sidebar — while every app manifest
 * had been marking its `bottomNav` rows since Sprint 1 for a component nobody
 * had built (audit finding A1).
 *
 * It is presentational: which items, which one is current and what their
 * badges say are the caller's (`MobileTabBar`, from the manifests), so the
 * design system never learns what an app is.
 *
 *  · **Labels always.** Icon-only navigation bars fail people who do not know
 *    the icon; Material's own guidance keeps labels for four or five
 *    destinations.
 *  · **`fixed`, inside `UbBottomBar`.** The wrapper publishes its height as
 *    `--ub-bottom-inset`, so the global toast sits above the bar rather than
 *    on it — the CR-2026-09-19-G defect class this hook exists for. The marker
 *    `data-ub-bottom-nav` is what lets sticky action bars and the FAB lift
 *    themselves above it in CSS (`--ub-nav-offset`, primitives.css).
 *  · **`lg:hidden`.** Desktop has the rail; at 1024 px and up this renders
 *    nothing visible and costs no layout.
 */
export interface UbBottomNavItem {
  readonly key: string;
  /** A destination. An item without one is a BUTTON and needs `onSelect`. */
  readonly href?: string;
  /**
   * Revamp 04 §2 — the App button: the slot opens a sheet instead of a page.
   * It is a `button` with `aria-haspopup="dialog"`, never a link to nowhere.
   */
  readonly onSelect?: () => void;
  /** The button's spoken name when it says more than its label. */
  readonly ariaLabel?: string;
  /** A small mark after the label (the App button's ▴). */
  readonly trailing?: ReactNode;
  readonly label: string;
  /** `aria-hidden` icon, 24 px. */
  readonly icon: ReactNode;
  readonly active?: boolean;
  /** A count that needs attention; announced with the label. */
  readonly badge?: number;
  /** Spoken after the count, e.g. "2 need attention". */
  readonly badgeLabel?: string;
}

export interface UbBottomNavProps {
  readonly label: string;
  readonly items: readonly UbBottomNavItem[];
  readonly className?: string;
}

/** A link for a destination, a button for the App slot; same look either way. */
function Slot({
  item,
  className,
  children,
}: Readonly<{ item: UbBottomNavItem; className: string; children: ReactNode }>) {
  if (item.href === undefined) {
    return (
      <button
        type="button"
        onClick={item.onSelect}
        aria-haspopup="dialog"
        aria-label={item.ariaLabel}
        aria-current={item.active ? 'page' : undefined}
        className={className}
      >
        {children}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      aria-label={item.ariaLabel}
      className={className}
    >
      {children}
    </Link>
  );
}

function UbBottomNavBase({ label, items, className }: Readonly<UbBottomNavProps>) {
  return (
    <UbBottomBar
      as="nav"
      sticky={false}
      aria-label={label}
      data-ub-bottom-nav=""
      data-print="hide"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border-hairline bg-surface-card lg:hidden',
        'pb-[env(safe-area-inset-bottom,0px)]',
        className
      )}
    >
      <ul
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.key} className="flex min-w-0">
            <Slot
              item={item}
              className={cn(
                'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 outline-none',
                'focus-visible:shadow-focus',
                item.active ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-pill transition-[background-color,transform] duration-fast',
                  // Revamp F2: the tab had no press look at all (baseline H6).
                  'group-active:scale-95 group-active:bg-surface-active motion-reduce:group-active:scale-100',
                  item.active && 'bg-accent-quiet text-text-accent'
                )}
              >
                {item.icon}
              </span>
              {/* QA B23 — never cut a word: "Custome…" on a 360 px phone. The label
                  uses the whole cell, tightens a little, and a two-word label may
                  take a second line; the owner's rule is plain words a rural
                  shopkeeper reads at a glance, so the word stays and the box fits it. */}
              <span
                data-testid="bottom-nav-label"
                className="line-clamp-2 w-full break-normal px-0.5 text-center text-[0.6875rem] font-medium leading-[13px] tracking-tight"
              >
                {item.label}
                {item.trailing}
              </span>
              {item.badge ? (
                <span className="absolute left-1/2 top-1.5 ml-2 min-w-[18px] rounded-pill bg-error px-1 text-center text-[0.6875rem] font-semibold leading-[18px] text-text-inverse">
                  {item.badge > 99 ? '99+' : item.badge}
                  {item.badgeLabel ? <span className="sr-only"> {item.badgeLabel}</span> : null}
                </span>
              ) : null}
            </Slot>
          </li>
        ))}
      </ul>
    </UbBottomBar>
  );
}

UbBottomNavBase.displayName = 'UbBottomNav';
export const UbBottomNav = memo(UbBottomNavBase);
