import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OTP_LENGTH, UbOtpInput } from './UbOtpInput';

/**
 * PLT-01 §7 and T-PLT-01-9 — "paste fills four cells and auto-submits".
 *
 * A controlled harness rather than a bare render: the component's whole
 * contract is that the FORM holds one string and the cells are a rendering of
 * it, and an uncontrolled render would test neither half.
 */
function Harness({
  onComplete,
  readOnly,
  initial = '',
  length,
}: Readonly<{
  onComplete?: (value: string) => void;
  readOnly?: boolean;
  initial?: string;
  length?: number;
}>) {
  const [value, setValue] = useState(initial);
  return (
    <UbOtpInput
      length={length}
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      readOnly={readOnly}
      label="Six-digit code"
      cellLabel={(index, total) => `Digit ${index} of ${total}`}
    />
  );
}

const cells = (): HTMLInputElement[] =>
  Array.from({ length: OTP_LENGTH }, (_, index) =>
    screen.getByLabelText(`Digit ${index + 1} of ${OTP_LENGTH}`)
  ) as HTMLInputElement[];

describe('UbOtpInput', () => {
  it('renders one labelled cell per digit inside one group', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Six-digit code' })).toBeInTheDocument();
    expect(cells()).toHaveLength(OTP_LENGTH);
  });

  it('offers the platform one-time code on the FIRST cell only', () => {
    render(<Harness />);
    const [first, second] = cells();
    expect(first).toHaveAttribute('autocomplete', 'one-time-code');
    // Four one-time-code fields make the platform offer the code four times.
    expect(second).toHaveAttribute('autocomplete', 'off');
  });

  it('fills all six cells from one paste and fires onComplete once', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    render(<Harness onComplete={onComplete} />);

    const [first] = cells();
    if (!first) throw new Error('no cells rendered');
    first.focus();
    await user.paste('123456');

    expect(cells().map((cell) => cell.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('strips the spaces an SMS copy brings with it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const [first] = cells();
    if (!first) throw new Error('no cells rendered');
    first.focus();
    await user.paste('12 34 56');

    expect(
      cells()
        .map((cell) => cell.value)
        .join('')
    ).toBe('123456');
  });

  it('advances as digits are typed and auto-submits on the sixth', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    render(<Harness onComplete={onComplete} />);

    await user.type(cells()[0] as HTMLInputElement, '123456');

    expect(
      cells()
        .map((cell) => cell.value)
        .join('')
    ).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('rejects a non-digit rather than showing it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(cells()[0] as HTMLInputElement, 'a');
    expect(cells()[0]).toHaveValue('');
  });

  it('moves back and clears on Backspace in an empty cell', async () => {
    const user = userEvent.setup();
    render(<Harness initial="12" />);

    const third = cells()[2];
    if (!third) throw new Error('no cells rendered');
    third.focus();
    await user.keyboard('{Backspace}');

    expect(
      cells()
        .map((cell) => cell.value)
        .join('')
    ).toBe('1');
  });

  it('is read-only, not disabled, while verifying — focus must survive', () => {
    render(<Harness readOnly initial="1234" />);
    cells().forEach((cell) => {
      expect(cell).toHaveAttribute('readonly');
      expect(cell).not.toBeDisabled();
    });
  });

  it('does not accept input while read-only', async () => {
    const user = userEvent.setup();
    render(<Harness readOnly initial="12" />);
    await user.type(cells()[2] as HTMLInputElement, '9');
    expect(
      cells()
        .map((cell) => cell.value)
        .join('')
    ).toBe('12');
  });
});

it('pastes all six authentication digits and submits once without truncation', async () => {
  const user = userEvent.setup();
  const complete = jest.fn();
  render(<Harness length={6} onComplete={complete} />);
  screen.getByLabelText('Digit 1 of 6').focus();
  await user.paste('932234');
  expect(screen.getAllByRole('textbox')).toHaveLength(6);
  expect(screen.getAllByRole('textbox').map((cell) => (cell as HTMLInputElement).value)).toEqual([
    '9',
    '3',
    '2',
    '2',
    '3',
    '4',
  ]);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledWith('932234');
});

/**
 * Owner, 12 Nov 2026: "not able to copy paste" on the login code. On a phone the
 * code usually arrives WITHOUT a paste event — the keyboard's clipboard chip or
 * the SMS autofill inserts "1234" into the first cell — and `maxLength={1}` had
 * the browser cut it to "1" before the change handler saw it (reproduced on the
 * live login page with Playwright's insertText). jsdom does not enforce
 * maxLength, so the first assertion pins the attribute itself.
 */
it('lets a whole code put into the first cell (keyboard chip, SMS autofill) fill every cell', () => {
  const onComplete = jest.fn();
  render(<Harness onComplete={onComplete} />);
  expect(cells()[0]).not.toHaveAttribute('maxlength');
  fireEvent.change(cells()[0] as HTMLInputElement, { target: { value: '123456' } });
  expect(cells().map((cell) => cell.value)).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(onComplete).toHaveBeenCalledWith('123456');
});

it('typing beside a filled digit replaces it rather than spilling', () => {
  render(<Harness initial="123456" />);
  fireEvent.change(cells()[1] as HTMLInputElement, { target: { value: '29' } });
  expect(cells().map((cell) => cell.value)).toEqual(['1', '9', '3', '4', '5', '6']);
});

/**
 * Owner, 14 Nov 2026: "not able to paste otp directly". A pasted MESSAGE carries
 * other numbers — "Valid for 10 minutes", the phone number — and the cells took
 * the first digits they found, so a wrong code was sent and refused
 * (reproduced on the live sign-in page: "Valid for 10 minutes. Your code is
 * 4821" sent "1048"). The cells now take the run of digits that IS a code.
 */
describe('a pasted message gives the code, not its other numbers', () => {
  const six = (): string[] => screen.getAllByRole('textbox').map((cell) => (cell as HTMLInputElement).value);

  it.each([
    ['code last', 'Valid for 10 minutes. Your YourKhata code is 482193'],
    ['the phone number first', 'Code for +91 98111 22255 is 482193'],
    ['code first', '482193 is your code. Valid 10 min. Do not share.'],
    ['grouped with a space', '482 193'],
  ])('paste with %s', async (_name, text) => {
    const user = userEvent.setup();
    const complete = jest.fn();
    render(<Harness length={6} onComplete={complete} />);
    screen.getByLabelText('Digit 1 of 6').focus();
    await user.paste(text);
    expect(six().join('')).toBe('482193');
    expect(complete).toHaveBeenCalledWith('482193');
  });

  it('a whole message put into the first cell (iOS autofill, keyboard chip) gives the code', () => {
    const complete = jest.fn();
    render(<Harness length={6} onComplete={complete} />);
    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: 'Valid for 10 minutes. Your code is 482193' },
    });
    expect(six().join('')).toBe('482193');
    expect(complete).toHaveBeenCalledWith('482193');
  });
});
