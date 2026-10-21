import { useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sanitiseQuantity, UbQuantityInput } from './UbQuantityInput';

/** Quantity text keeps invalid fractions/signs for validation, never1.5→15 or-5→5. */
describe('sanitiseQuantity', () => {
  it('keeps at most three decimals for a decimal unit', () => {
    expect(sanitiseQuantity('1.23456', 3, false)).toBe('1.234');
    expect(sanitiseQuantity('1.2.3', 3, false)).toBe('1.23');
  });

  it('keeps an invalid fraction so whole-number validation can refuse it', () => {
    expect(sanitiseQuantity('1.5', 0, false)).toBe('1.5');
  });

  it('preserves a leading minus instead of turning an invalid negative into positive stock', () => {
    expect(sanitiseQuantity('-3', 0, true)).toBe('-3');
    expect(sanitiseQuantity('-3', 0, false)).toBe('-3');
    expect(sanitiseQuantity('3-', 0, true)).toBe('3');
  });
});

function Harness({ decimals }: Readonly<{ decimals: number }>) {
  const [value, setValue] = useState('');
  return (
    <UbQuantityInput
      aria-label="Qty"
      value={value}
      onChange={setValue}
      decimals={decimals}
      unit="NOS"
    />
  );
}

describe('UbQuantityInput', () => {
  it('keeps the typed value a string and shows the unit beside it', async () => {
    const user = userEvent.setup();
    render(<Harness decimals={0} />);
    await user.type(screen.getByLabelText('Qty'), '12.5');
    expect(screen.getByLabelText('Qty')).toHaveValue('12.5');
    expect(screen.getByText('NOS')).toBeInTheDocument();
  });
});
