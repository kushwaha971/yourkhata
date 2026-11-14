import { useState } from 'react';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  capDecimals,
  groupIndian,
  padDecimals,
  sanitiseAmount,
  UbMoneyInput,
} from './UbMoneyInput';

/**
 * Controlled, because that is the only way the form ever uses it — React Hook
 * Form owns the value. A test that renders it with a fixed `value` is testing a
 * component nobody has.
 */
function Harness({
  onValue,
  initial = '',
}: {
  readonly onValue: (value: string) => void;
  readonly initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <UbMoneyInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
      aria-label="Amount"
    />
  );
}

describe('the value never becomes a number', () => {
  it('groups the Indian way, which is 2,2,3 and not 3,3,3', () => {
    // ₹12,34,567.89 is what a merchant reads. ₹1,234,567.89 is what a library
    // that assumes en-US produces, and it is wrong in a way that makes a figure
    // harder to check against a paper book.
    expect(groupIndian('1234567.5', 2)).toBe('12,34,567.50');
    expect(groupIndian('999', 2)).toBe('999.00');
    expect(groupIndian('100000', 2)).toBe('1,00,000.00');
  });

  it('pads and truncates by string surgery rather than through a double', () => {
    expect(padDecimals('2300', 2)).toBe('2300.00');
    expect(padDecimals('2300.', 2)).toBe('2300.00');
    // Truncates rather than rounds: this runs while someone is still typing,
    // and rounding up a number they had not finished entering changes it.
    expect(padDecimals('2300.567', 2)).toBe('2300.56');
    // The case the one-liner gets wrong. A double cannot hold this exactly.
    expect(padDecimals('9007199254740993.75', 2)).toBe('9007199254740993.75');
  });

  it('keeps a typed minus so the form can refuse it in words (QA B14)', () => {
    // Direction is two buttons — "they owe me" and "I will give" — so a minus is
    // never right. Dropping it silently turned a typed "−50" into a saved ₹50
    // with a success toast; kept, it reaches the validators, which say so.
    expect(sanitiseAmount('-500')).toBe('-500');
    expect(sanitiseAmount('−50')).toBe('-50');
    expect(groupIndian('-125000', 2)).toBe('-1,25,000.00');
    expect(padDecimals('-50', 2)).toBe('-50.00');
    expect(sanitiseAmount('1a2b3')).toBe('123');
    expect(sanitiseAmount('1.2.3')).toBe('1.23');
  });
});

describe('what the merchant sees while typing', () => {
  it('keeps a selection over the same digits when focus removes grouping', async () => {
    render(<Harness onValue={jest.fn()} initial="1680.00" />);
    const field = screen.getByLabelText<HTMLInputElement>('Amount');
    await act(async () => {
      field.setSelectionRange(2, 5);
      field.focus();
    });
    expect(field).toHaveValue('1680.00');
    expect(field.selectionStart).toBe(1);
    expect(field.selectionEnd).toBe(4);
  });

  it('shows what was typed while focused and groups it on the way out', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    const field = screen.getByLabelText('Amount');
    await user.type(field, '1234567');
    // Formatting while someone types fights them: the caret jumps every time a
    // separator is inserted, and backspacing over a comma does nothing visible.
    expect(onValue).toHaveBeenLastCalledWith('1234567');
    expect(field).toHaveValue('1234567');

    await user.tab();
    expect(field).toHaveValue('12,34,567.00');
  });

  it('QA S-D2: focus-and-select-all then typing REPLACES a prefilled amount', async () => {
    // "1,392.00" was swapped for "1392.00" on focus, which collapsed the
    // selection a tab-in / select-all / Playwright `fill` had just made, so
    // "500" was appended: "1392.00500".
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Harness onValue={onValue} initial="1392.00" />);
    const field = screen.getByLabelText<HTMLInputElement>('Amount');
    expect(field).toHaveValue('1,392.00');
    act(() => {
      field.focus();
      field.select();
    });
    await user.keyboard('500');
    expect(onValue).toHaveBeenLastCalledWith('500');
    expect(field).toHaveValue('500');
    await user.tab();
    expect(field).toHaveValue('500.00');
  });

  it('keeps stored trailing-zero precision from stranding digits during select-all clear', async () => {
    // Browser purchase QA: 42.0000 expanded after selection and clear left 00, accidentally saving zero.
    const onValue = jest.fn();
    render(<Harness onValue={onValue} initial="42.0000" />);
    const field = screen.getByLabelText<HTMLInputElement>('Amount');
    await userEvent.click(field);
    expect(field).toHaveValue('42.00');
    expect(onValue).not.toHaveBeenCalled();
    act(() => field.select());
    await userEvent.keyboard('{Backspace}');
    expect(onValue).toHaveBeenLastCalledWith('');
    expect(field).toHaveValue('');
  });

  it('shows a value that arrives while the field is focused, raw (Record payment prefill)', async () => {
    // Regression from the first S-D2 fix: the entry drawer autofocuses the
    // amount and the amount owed lands a render later; the focused field must
    // show it as "2300.00", editable, not keep its stale text.
    function Prefill() {
      const [value, setValue] = useState('');
      return (
        <>
          <UbMoneyInput value={value} onChange={setValue} aria-label="Amount" />
          <button type="button" onClick={() => setValue('2300.00')}>
            Prefill
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Prefill />);
    const field = screen.getByLabelText('Amount');
    await act(async () => field.focus());
    act(() => screen.getByRole('button', { name: 'Prefill' }).click());
    expect(field).toHaveFocus();
    expect(field).toHaveValue('2300.00');
    await user.clear(field);
    await user.type(field, '500');
    expect(field).toHaveValue('500');
  });

  it('QA S-D2: pasting over a selected amount replaces it and parses a grouped paste', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Harness onValue={onValue} initial="1365.00" />);
    const field = screen.getByLabelText<HTMLInputElement>('Amount');
    act(() => {
      field.focus();
      field.select();
    });
    await user.paste('₹1,500.50');
    expect(onValue).toHaveBeenLastCalledWith('1500.50');
  });

  it('QA S-D2: never holds more than two decimals, so the label and the record agree', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    await user.type(screen.getByLabelText('Amount'), '12.3456');
    expect(onValue).toHaveBeenLastCalledWith('12.34');
    expect(capDecimals('12.345', 2)).toBe('12.34');
    expect(capDecimals('12.5', 0)).toBe('12');
  });

  it('asks a phone for the decimal keypad without asking for spinners', () => {
    render(<UbMoneyInput value="" onChange={jest.fn()} aria-label="Amount" />);
    const field = screen.getByLabelText('Amount');
    // `type="number"` would give the right keypad and also scroll-wheel
    // increments and a browser-localised decimal separator.
    expect(field).toHaveAttribute('inputmode', 'decimal');
    expect(field).toHaveAttribute('type', 'text');
  });
});

describe('G1: a unit after the amount (design "₹ 12,710 / g")', () => {
  it('draws ₹ beside the figure and the unit after it, and still types', async () => {
    const seen = jest.fn();
    function Unit() {
      const [value, setValue] = useState('');
      return (
        <UbMoneyInput
          value={value}
          onChange={(next) => {
            setValue(next);
            seen(next);
          }}
          unit="/ g"
          decimalPlaces={0}
          maxDecimalPlaces={2}
          aria-label="Rate"
        />
      );
    }
    const { container } = render(<Unit />);
    const box = container.querySelector('label');
    expect(box).toHaveTextContent('₹');
    expect(box).toHaveTextContent('/ g');
    await userEvent.type(screen.getByLabelText('Rate'), '12710');
    expect(seen).toHaveBeenLastCalledWith('12710');
  });

  it('an empty unit still puts ₹ beside the figure, with no box inside the box', () => {
    render(<UbMoneyInput value="12710" onChange={() => undefined} unit="" aria-label="Rate" />);
    // Seen on a phone: the input kept its own border and padding and cut "12,710".
    expect(screen.getByLabelText('Rate')).toHaveClass('border-0', 'p-0');
    expect(screen.getByLabelText('Rate').closest('label')).not.toHaveTextContent('/ g');
  });

  it('without a unit the box is drawn as before: no label wrapper', () => {
    const { container } = render(<Harness onValue={() => undefined} />);
    expect(container.querySelector('label')).toBeNull();
  });
});

/**
 * Shop round (11 Nov 2026): Receive payment autofocuses the amount and THEN
 * fills in what is owed, so no focus event fires; the caret sat after "340.00"
 * and typing a part payment of 140 was refused digit by digit.
 */
describe('selectWhenFilled', () => {
  function Prefill({ select }: Readonly<{ select: boolean }>) {
    const [value, setValue] = useState('');
    return (
      <>
        <UbMoneyInput aria-label="Amount" value={value} onChange={setValue} selectWhenFilled={select} autoFocus />
        <button type="button" onClick={() => setValue('340.00')}>
          fill
        </button>
      </>
    );
  }

  it('selects an amount filled in while the field has focus, so typing replaces it', async () => {
    render(<Prefill select />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount' });
    input.focus();
    act(() => screen.getByRole('button', { name: 'fill' }).click());
    input.focus();
    expect(input).toHaveValue('340.00');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 6]);
    await userEvent.keyboard('140', { skipClick: true } as never);
    expect(input).toHaveValue('140');
  });

  it('never selects over what the merchant is typing', async () => {
    render(<Prefill select />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount' });
    await userEvent.type(input, '12');
    expect(input).toHaveValue('12');
    expect(input.selectionStart).toBe(2);
  });
});
