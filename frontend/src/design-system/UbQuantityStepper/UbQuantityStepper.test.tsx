import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbQuantityStepper } from './UbQuantityStepper';

const base = {
  label: 'Quantity of Atta',
  decreaseLabel: 'One less Atta',
  increaseLabel: 'One more Atta',
};

describe('UbQuantityStepper at one', () => {
  /** Prevents (owner, 27 Oct 2026): a beginner tapped − on a wrong item at 1 and nothing happened. */
  it('turns − into a bin that removes the line when the caller can remove it', async () => {
    const onRemove = jest.fn();
    const onChange = jest.fn();
    render(
      <UbQuantityStepper
        {...base}
        value="1"
        onChange={onChange}
        onRemove={onRemove}
        removeLabel="Remove Atta"
      />
    );
    expect(screen.queryByRole('button', { name: 'One less Atta' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Atta' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps − above one, and a plain stop at one when nothing can be removed', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <UbQuantityStepper
        {...base}
        value="3"
        onChange={onChange}
        onRemove={jest.fn()}
        removeLabel="Remove Atta"
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'One less Atta' }));
    expect(onChange).toHaveBeenCalledWith('2');
    rerender(<UbQuantityStepper {...base} value="1" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'One less Atta' })).toBeDisabled();
  });
});
