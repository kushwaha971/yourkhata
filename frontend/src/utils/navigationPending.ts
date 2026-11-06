/**
 * Revamp F2 (docs/revamp/05 §3, "Tap that navigates") — whether a
 * `router.push` navigation is on its way, for the one progress line that says
 * so.
 *
 * A `next/link` tap needs nothing from here: the route's `loading.tsx` is
 * prefetched and drawn at once (F1). A `router.push` from a list row or a
 * "New bill" button is not prefetched, and after F1 the measurement still
 * showed 299–312 ms throttled with the old screen frozen
 * (docs/performance/2026-10-17-f1-loading-views.md). Nothing in the App Router
 * publishes "a push started", so `useAppRouter` writes it here and
 * `RouteProgress` reads it.
 *
 * A module-level store rather than Redux on purpose: it is a few milliseconds
 * of UI state that no reducer, persistence or devtools should ever see.
 */
type Listener = () => void;

let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

/** A navigation that never lands (a cancelled push) must not leave the line on for ever. */
const GIVE_UP_MS = 15_000;

const emit = (): void => listeners.forEach((listener) => listener());

export const clearNavigationPending = (): void => {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending === null) return;
  pending = null;
  emit();
};

/** Same path and query as the screen already open: the router will not move, so nothing is pending. */
const isCurrentLocation = (href: string): boolean => {
  if (typeof window === 'undefined') return true;
  const target = new URL(href, window.location.href);
  return (
    target.origin !== window.location.origin ||
    (target.pathname === window.location.pathname && target.search === window.location.search)
  );
};

export const markNavigationPending = (href: string): void => {
  if (isCurrentLocation(href)) return;
  pending = href;
  if (timer) clearTimeout(timer);
  timer = setTimeout(clearNavigationPending, GIVE_UP_MS);
  emit();
};

export const subscribeNavigationPending = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getNavigationPending = (): string | null => pending;
