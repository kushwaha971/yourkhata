import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbDialog } from 'src/design-system/UbDialog';

import { UbCombobox } from './UbCombobox';

const OPTIONS = [
  { value: '27', label: 'Maharashtra' },
  { value: '29', label: 'Karnataka' },
];

describe('UbCombobox inside an overlay', () => {
  /**
   * The same defect `UbTokenInput` had, fixed in the same pass and asserted
   * here because the exposure is not this component's fault and will come back
   * the next time somebody puts it in a dialog.
   *
   * Radix portals the menu out of the overlay's DOM subtree, so the overlay's
   * Escape handler and this one are two listeners on the same document with no
   * knowledge of each other — and the overlay's was registered first. The GST
   * state picker, this component's original caller, sits on a PAGE and was
   * never affected; PTY-05's merge dialog is the first caller inside an
   * overlay, which is how a two-year-old component grew a new bug without
   * changing.
   */
  it('closes its menu and leaves the overlay it is inside alone', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <UbDialog
        open
        onOpenChange={onOpenChange}
        title="Merge tags"
        closeLabel="Close"
        footer={null}
      >
        <UbCombobox
          value={null}
          onChange={jest.fn()}
          options={OPTIONS}
          aria-label="Keep this tag"
          placeholder="Choose a tag"
          searchPlaceholder="Search"
          emptyLabel="Nothing found"
        />
      </UbDialog>
    );

    await user.click(screen.getByRole('combobox', { name: 'Keep this tag' }));
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('still closes on Escape when it is not inside anything', async () => {
    /** The fix must not make the ordinary case — the GST state picker on a
     *  page — stop responding to the key at all. */
    const user = userEvent.setup();
    render(
      <UbCombobox
        value={null}
        onChange={jest.fn()}
        options={OPTIONS}
        aria-label="State"
        searchPlaceholder="Search"
        emptyLabel="Nothing found"
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'State' }));
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  });
});

it('treats searching in the open picker as focus inside the same field', async () => {
  const user = userEvent.setup();
  const blur = jest.fn();
  render(
    <UbCombobox
      aria-label="Plan"
      value=""
      onChange={jest.fn()}
      onBlur={blur}
      options={OPTIONS}
      searchPlaceholder="Search plans"
    />
  );
  await user.click(screen.getByRole('combobox', { name: 'Plan' }));
  await screen.findByPlaceholderText('Search plans');
  expect(blur).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(blur).toHaveBeenCalledTimes(1);
});

it('wraps a long option instead of cutting it with an ellipsis', async () => {
  /* Prevents: "Line 1 · Radhe Krishna Enterprises Copper Ele…" on a phone, the
     half of the name that tells two cables apart cut off (live QA, 20 Oct). */
  const user = userEvent.setup();
  const long = 'Line 1 · Radhe Krishna Enterprises Copper Electrical Cable 2.5 sq mm · 2 NOS';
  render(
    <UbCombobox
      aria-label="Find a line"
      value={null}
      onChange={jest.fn()}
      options={[{ value: '0', label: long }]}
    />
  );
  await user.click(screen.getByRole('combobox', { name: 'Find a line' }));
  const text = await screen.findByText(long);
  expect(text.className).not.toContain('truncate');
  expect(text.className).toContain('break-words');
});
