import { act, render } from '@testing-library/react';

import { UbViewportPageShell } from './UbViewportPageShell';
it('sizes an opted-in register from its measured header and visual viewport', async () => {
  /** Defect: page-growing registers hid pagination below rows instead of fitting the available viewport. */
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 520, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 112,
    left: 0,
    width: 390,
    height: 0,
    bottom: 112,
    right: 390,
    x: 0,
    y: 112,
    toJSON: () => ({}),
  });
  const { container, unmount } = render(<UbViewportPageShell>Register</UbViewportPageShell>);
  const frame = container.firstElementChild as HTMLElement;
  expect(frame.style.getPropertyValue('--ub-page-top')).toBe('112px');
  expect(frame.style.getPropertyValue('--ub-page-viewport')).toBe('520px');
  Object.assign(viewport, { height: 380, offsetTop: 8 });
  await act(() => viewport.dispatchEvent(new Event('resize')));
  expect(frame.style.getPropertyValue('--ub-page-top')).toBe('104px');
  expect(frame.style.getPropertyValue('--ub-page-viewport')).toBe('380px');
  unmount();
  rect.mockRestore();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});
