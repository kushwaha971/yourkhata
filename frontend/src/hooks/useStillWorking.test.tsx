import { act, renderHook } from '@testing-library/react';

import { STILL_WORKING_MS, useStillWorking } from './useStillWorking';

/**
 * 05 §3 / 07-screens/09 §0.2 — a write that has not answered in three seconds
 * says so ("Still issuing… it won't be issued twice"). Without it a merchant on
 * a slow counter connection taps Issue again, or walks away believing the bill
 * failed. The line must go away the moment the write settles, and must not
 * carry over into the next write's first three seconds.
 */
describe('useStillWorking', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('turns on only after the write has been busy for three seconds', () => {
    const { result } = renderHook(({ busy }) => useStillWorking(busy), {
      initialProps: { busy: true },
    });
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(STILL_WORKING_MS - 1));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('clears when the write settles and starts the clock again for the next one', () => {
    const { result, rerender } = renderHook(({ busy }) => useStillWorking(busy), {
      initialProps: { busy: true },
    });
    act(() => jest.advanceTimersByTime(STILL_WORKING_MS));
    expect(result.current).toBe(true);
    rerender({ busy: false });
    expect(result.current).toBe(false);
    rerender({ busy: true });
    expect(result.current).toBe(false);
  });
});
