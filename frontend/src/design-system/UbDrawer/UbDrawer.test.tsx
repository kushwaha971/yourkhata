import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbDrawer } from './UbDrawer';

const open = (extra: Partial<React.ComponentProps<typeof UbDrawer>> = {}) =>
  render(
    <UbDrawer
      open
      onOpenChange={jest.fn()}
      title="Add party"
      closeLabel="Close"
      footer={<button type="button">Save party</button>}
      {...extra}
    >
      <input aria-label="Name" />
    </UbDrawer>
  );

describe('the long form', () => {
  it('is a dialog with a name, so a screen reader announces what it is', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Add party' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('keeps the actions outside the scrolling body', () => {
    // A Save button that has to be scrolled to, in a form this long, is a form
    // people abandon halfway.
    open();
    const save = screen.getByRole('button', { name: 'Save party' });
    expect(save.closest('[data-testid="ml-dialog-body"]')).toBeNull();
  });

  it('can refuse a backdrop tap, which is how a dirty form survives one', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    open({ onOpenChange, dismissOnBackdrop: false });

    const backdrop = document.querySelector('[aria-hidden="true"].absolute');
    if (backdrop) await user.click(backdrop);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes on Escape, because every overlay in this product does', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    open({ onOpenChange });

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('where focus lands when it opens', () => {
  it('honours a control that asked for it', async () => {
    /**
     * Prevents: `autoFocus` inside a drawer or dialog doing nothing at all.
     *
     * `MLDialog` moved focus to the FIRST focusable element in the panel, which
     * is the close button in the header, and four callers had already written
     * `autoFocus` expecting otherwise — LED-01's amount field, PTY-05's tag
     * name, and the Cancel button in both archive dialogs, which is there so a
     * destructive confirmation opens on the safe choice.
     *
     * None of them worked, and nothing failed. On the ledger drawer it cost two
     * things at once: the numeric keypad did not come up on a phone, on the
     * screen whose whole target is eight seconds from tap to saved; and the
     * blur that followed marked the amount TOUCHED, so `mode: 'onTouched'` ran
     * the resolver against an empty field and the drawer opened with
     * "Enter an amount." already under it, in error red, before the merchant
     * had done anything.
     *
     * jsdom does not reproduce it — this test does, because it asserts where
     * focus IS rather than what the markup asks for. A screenshot from a real
     * browser is what found it.
     */
    render(
      <UbDrawer
        open
        onOpenChange={jest.fn()}
        title="Add entry"
        closeLabel="Close"
        footer={<button type="button">Save</button>}
      >
        <input aria-label="Amount" autoFocus />
      </UbDrawer>
    );

    expect(screen.getByLabelText('Amount')).toHaveFocus();
  });

  it('falls back to the first focusable when nothing asked', () => {
    /** The behaviour every other dialog in the product relies on, unchanged. */
    open();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});

it('keeps an opted-in drawer footer inside the visual viewport and restores it on keyboard close', async () => {
  /** Counter Mode defect: a layout-viewport sheet left Save underneath the phone keyboard. */
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 400, offsetTop: 12, scale: 1 });
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  try {
    const { unmount } = open({ keyboardAware: true });
    const panel = screen.getByRole('dialog');
    expect(panel.parentElement).toHaveStyle({ height: '400px', top: '12px' });
    expect(panel).toHaveStyle({ maxHeight: '392px' });
    Object.assign(viewport, { height: window.innerHeight });
    await act(async () => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(panel.style.maxHeight).toBe('');
    expect(panel.parentElement?.style.height).toBe('');
    unmount();
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
    if (previous) Object.defineProperty(window, 'visualViewport', previous);
    else Reflect.deleteProperty(window, 'visualViewport');
  }
});

describe('design §A5: one spacing scale for drawers and sheets', () => {
  const open = (footer: React.ReactNode) =>
    render(
      <UbDrawer
        open
        onOpenChange={() => undefined}
        title="Edit customer"
        closeLabel="Close"
        footer={footer}
      >
        <p>Body</p>
      </UbDrawer>
    );

  /** Prevents the drawer drifting back to its old 520 px / 12 px look (`.drawer`, `.sheet`). */
  it('is a 480 px drawer on desktop and an 18 px-cornered sheet with a grab handle on a phone', () => {
    open(<button type="button">Save</button>);
    const panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('lg:w-[480px]', 'rounded-t-[18px]');
    const grab = panel.querySelector('[data-ub-grab]');
    expect(grab).toHaveClass('h-[4px]', 'w-[36px]', 'lg:hidden');
  });

  /** Prevents the stacked phone footer: Cancel and the wider Save side by side (`.sfoot`). */
  it('puts two actions side by side, the second twice as wide, and a note on a row of its own', () => {
    open(
      <>
        <span>1 item · ₹0</span>
        <button type="button">Cancel</button>
        <button type="button">Save</button>
      </>
    );
    const footer = screen.getByRole('button', { name: 'Save' }).parentElement as HTMLElement;
    expect(footer).toHaveClass('grid', 'grid-cols-[1fr_2fr]', '[&>:not(button)]:col-span-full');
    expect(footer).toHaveClass('[&>button]:h-[46px]', 'lg:[&>button]:h-10', 'lg:justify-end');
  });

  /** Prevents a header that packs 24 px all round instead of the design's row (`.shead`). */
  it('has a 56 px header on a phone and 60 px on desktop, and a 40 px close button', () => {
    open(null);
    const header = screen.getByRole('dialog').querySelector('[data-ub-dialog-header]');
    expect(header).toHaveClass(
      'min-h-[56px]',
      'pl-4',
      'pr-2',
      'lg:min-h-[60px]',
      'lg:pl-6',
      'lg:pr-3'
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      'h-10',
      'w-10',
      'rounded-[10px]'
    );
  });
});
