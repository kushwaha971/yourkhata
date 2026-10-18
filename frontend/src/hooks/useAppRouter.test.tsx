import { useRouter } from 'next/navigation';

import { renderHook } from '@testing-library/react';

import { clearNavigationPending, getNavigationPending } from 'src/utils/navigationPending';

import { useAppRouter } from './useAppRouter';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));

/**
 * Revamp F2 — `push` is the router's own push plus the announcement the
 * progress line needs; `replace` (filters written to the address bar) stays
 * silent, and the object keeps its identity across renders so effects that
 * depend on it do not re-run.
 */
describe('useAppRouter', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(router);
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/customers');
    clearNavigationPending();
  });

  it('push navigates with the arguments it was given and marks the navigation pending', () => {
    const { result } = renderHook(() => useAppRouter());
    result.current.push('/parties/7', { scroll: false });
    expect(router.push).toHaveBeenLastCalledWith('/parties/7', { scroll: false });
    expect(getNavigationPending()).toBe('/parties/7');
    // No options in, no options out: 28 tests assert the router's own call shape.
    result.current.push('/parties/8');
    expect(router.push.mock.lastCall).toEqual(['/parties/8']);
  });

  it('replace navigates without a progress line', () => {
    const { result } = renderHook(() => useAppRouter());
    result.current.replace('/customers?q=ram');
    expect(router.replace).toHaveBeenCalledWith('/customers?q=ram');
    expect(getNavigationPending()).toBeNull();
  });

  it('keeps the same object while the router is the same', () => {
    const { result, rerender } = renderHook(() => useAppRouter());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
