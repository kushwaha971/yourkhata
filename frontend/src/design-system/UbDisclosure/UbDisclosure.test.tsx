import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbDisclosure } from 'src/design-system';

/**
 * QA B25 — "More details" on Add book drew an empty bordered strip under its header
 * while closed: with `keepMounted` the closed panel is `hidden="until-found"` on
 * Chrome, which hides the content but keeps the box, padding and top rule included.
 * The box takes its padding and rule only while open.
 */
describe('UbDisclosure', () => {
  it('gives a closed, kept-mounted panel no padding or rule of its own', async () => {
    render(
      <UbDisclosure label="More details" keepMounted>
        <span>Publisher</span>
      </UbDisclosure>
    );
    const panel = screen.getByRole('region', { hidden: true });
    expect(panel.className).not.toMatch(/\b(py-4|border-t)\b/);
    await userEvent.click(screen.getByRole('button', { name: 'More details' }));
    expect(panel.className).toMatch(/\bpy-4\b/);
    expect(panel).toBeVisible();
  });

  /**
   * FB-012 — opening a section showed a box inside the box: the header kept
   * its own rounded corners and hover fill, so the fill stopped short of the
   * border and the bottom corners showed a slightly different colour, and the
   * focus ring was drawn on the header where the panel's rule clipped it.
   * The root clips and owns the ring; the header is square.
   */
  it('clips at the root and moves the focus ring off the square header', () => {
    render(
      <UbDisclosure label="Details" defaultOpen>
        <span>Mobile</span>
      </UbDisclosure>
    );
    const trigger = screen.getByRole('button', { name: 'Details' });
    const root = trigger.parentElement as HTMLElement;
    expect(root.className).toMatch(/\boverflow-clip\b/);
    expect(root.className).toContain('has-[>button:focus-visible]:shadow-focus');
    expect(trigger.className).not.toMatch(/\brounded-/);
    expect(trigger.className).not.toContain('focus-visible:shadow-focus');
    expect(trigger.className).toContain('min-h-[52px]');
  });

  /**
   * FB-012 — a panel of rows that draw their own padding must not get the
   * disclosure's as well: that was the second set of padding and margin.
   */
  it('drops the open panel padding and gap when flush', () => {
    render(
      <UbDisclosure label="Details" defaultOpen flush>
        <span>Mobile</span>
      </UbDisclosure>
    );
    const panel = screen.getByRole('region');
    expect(panel.className).not.toMatch(/\b(py-4|px-4|gap-4)\b/);
    expect(panel.className).toMatch(/\bborder-t\b/);
  });

  /**
   * A2 put a summary under every title. Without its own label the summary
   * joined the button's accessible name, so "Details" became "Details
   * Address, GST, terms, notes, record" to a screen reader and to getByRole.
   */
  it('is named by its label and described by its summary', () => {
    render(
      <UbDisclosure label="More details" hint="25/10/2026 · Maharashtra (27)">
        <span>Date</span>
      </UbDisclosure>
    );
    const trigger = screen.getByRole('button', { name: 'More details' });
    expect(trigger).toHaveAccessibleDescription('25/10/2026 · Maharashtra (27)');
  });
});
