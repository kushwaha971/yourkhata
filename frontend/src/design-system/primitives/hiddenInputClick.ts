import { useEffect, type RefObject } from 'react';

/** Clicks this guard has already moved out of React's effect phase. */
const replayed = new WeakSet<Event>();

/**
 * Radix Checkbox and Switch, inside a `<form>`, stop their own button's click
 * and instead fire a SYNTHETIC `click` on a hidden input from an effect, so
 * native form listeners see the change. That echo is the only click the page
 * sees — and an open Radix popover (a date picker, an item picker) closes on
 * it, correctly: the merchant tapped outside. But it closes with `flushSync`
 * during React's effect phase, and React warned "flushSync was called from
 * inside a lifecycle method" (found by seeded monkey testing on the bill
 * editor, A3; both Incl. GST and Round off).
 *
 * So the echo is not dropped — dropping it would leave the popover open after
 * a tap outside it — it is MOVED: stopped where it is, and the same click is
 * sent again to the DOCUMENT, where the popover listens, in a microtask after
 * React has finished. Never to the wrapper: the switch's wrapper is a
 * `<label>`, a click on a label activates its control, and the switch toggled,
 * echoed and was replayed for ever — the page froze (caught by the monkey
 * watchdog on every seed). A native listener; it handles no interaction.
 */
export const useHiddenInputClickGuard = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const move = (event: Event) => {
      if (event.isTrusted || replayed.has(event) || !(event.target instanceof HTMLInputElement))
        return;
      event.stopPropagation();
      queueMicrotask(() => {
        const again = new MouseEvent('click', { bubbles: true, cancelable: true });
        replayed.add(again);
        document.dispatchEvent(again);
      });
    };
    node.addEventListener('click', move);
    return () => node.removeEventListener('click', move);
  }, [ref]);
};
