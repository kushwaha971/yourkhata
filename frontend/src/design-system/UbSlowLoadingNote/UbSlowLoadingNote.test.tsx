import { act, screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { SLOW_LOADING_MS, UbSlowLoadingNote } from './UbSlowLoadingNote';

describe('UbSlowLoadingNote (A8 P4)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('says nothing on a normal load, then explains and offers Try again', () => {
    /**
     * The defect it prevents: a chunk that never arrived left a skeleton or a
     * loading drawer on screen for ever, with no word and no way out.
     */
    renderWithProviders(<UbSlowLoadingNote />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(SLOW_LOADING_MS - 1);
    });
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
