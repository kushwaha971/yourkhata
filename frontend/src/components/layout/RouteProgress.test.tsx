import { usePathname, useSearchParams } from 'next/navigation';

import { act, render, screen } from '@testing-library/react';

import { clearNavigationPending, markNavigationPending } from 'src/utils/navigationPending';

import { RouteProgress } from './RouteProgress';

jest.mock('next/navigation', () => ({ usePathname: jest.fn(), useSearchParams: jest.fn() }));

/**
 * Revamp F2 — the line is on while a push is on its way and goes off when the
 * address bar reaches the new screen, rather than staying on over it.
 */
describe('RouteProgress', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/customers');
    clearNavigationPending();
    (usePathname as jest.Mock).mockReturnValue('/customers');
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
  });

  it('shows the line from the push until the new screen', () => {
    const { rerender } = render(<RouteProgress />);
    expect(screen.queryByTestId('route-progress')).toBeNull();

    act(() => markNavigationPending('/parties/3'));
    expect(screen.getByTestId('route-progress')).toBeInTheDocument();

    (usePathname as jest.Mock).mockReturnValue('/parties/3');
    rerender(<RouteProgress />);
    expect(screen.queryByTestId('route-progress')).toBeNull();
  });
});
