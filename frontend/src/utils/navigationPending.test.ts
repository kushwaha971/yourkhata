import {
  clearNavigationPending,
  getNavigationPending,
  markNavigationPending,
  subscribeNavigationPending,
} from './navigationPending';

/**
 * Revamp F2 — the store behind the progress line. The defects it prevents: a
 * line that never switches off (a push to the screen already open, or one that
 * never lands), and a listener left subscribed after its component is gone.
 */
describe('navigationPending', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.history.replaceState(null, '', '/customers?page=1');
    clearNavigationPending();
  });
  afterEach(() => jest.useRealTimers());

  it('is pending from a push to another screen until it is cleared', () => {
    const listener = jest.fn();
    const off = subscribeNavigationPending(listener);
    markNavigationPending('/parties/42');
    expect(getNavigationPending()).toBe('/parties/42');
    expect(listener).toHaveBeenCalledTimes(1);
    clearNavigationPending();
    expect(getNavigationPending()).toBeNull();
    off();
    markNavigationPending('/items');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores a push to the screen already open, which the router will not move for', () => {
    markNavigationPending('/customers?page=1');
    expect(getNavigationPending()).toBeNull();
  });

  it('counts a change of query alone as a navigation', () => {
    markNavigationPending('/customers?page=2');
    expect(getNavigationPending()).toBe('/customers?page=2');
  });

  it('gives up on a navigation that never lands', () => {
    markNavigationPending('/items');
    jest.advanceTimersByTime(15_000);
    expect(getNavigationPending()).toBeNull();
  });
});
