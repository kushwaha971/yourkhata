import { render } from '@testing-library/react';

import { UbSwitch } from './UbSwitch';

/**
 * A3 monkey testing: inside a form, Radix's hidden input fires a synthetic
 * click from an effect; an open popover closed on it with flushSync mid-effect
 * ("flushSync was called from inside a lifecycle method"). The echo must not
 * reach the document DURING the effect — but must still arrive, a moment
 * later, or a popover would stay open after a tap outside it.
 */
it('moves the hidden input echo out of the effect instead of dropping it', async () => {
  const { container } = render(
    <form>
      <UbSwitch checked={false} onCheckedChange={jest.fn()} label="Round off" />
    </form>
  );
  const seen: EventTarget[] = [];
  const listen = (event: Event) => seen.push(event.target as EventTarget);
  document.addEventListener('click', listen);
  const hidden = container.querySelector('input');
  expect(hidden).not.toBeNull();
  hidden?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(seen).toEqual([]); // not during the effect
  await Promise.resolve();
  document.removeEventListener('click', listen);
  expect(seen).toHaveLength(1); // but it arrives
  expect(seen).not.toContain(hidden);
});

/**
 * The first version replayed the echo from the switch's own `<label>`; a click
 * on a label activates its control, so the switch toggled, echoed and was
 * replayed for ever and the page froze. The replay must never reach the
 * control.
 */
it('never toggles the switch when it replays the echo', async () => {
  const onChange = jest.fn();
  const { container } = render(
    <form>
      <UbSwitch checked={false} onCheckedChange={onChange} label="Round off" />
    </form>
  );
  container.querySelector('input')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onChange).not.toHaveBeenCalled();
});
