import { fireEvent, render, screen } from '@testing-library/react';

import { UbLoadMore } from './UbLoadMore';
it('keeps a failed append manual instead of retrying repeatedly while visible', () => {
  /** R-DEC-33: a visible error sentinel must not automatically retry a failed page. */
  const original = global.IntersectionObserver;
  Object.defineProperty(global, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: jest.fn((callback) => ({
      observe: () => callback([{ isIntersecting: true }]),
      disconnect: jest.fn(),
    })),
  });
  try {
    const load = jest.fn();
    render(
      <UbLoadMore
        onLoadMore={load}
        loading={false}
        automatic={false}
        loadingLabel="Loading"
        moreLabel="Try again"
      />
    );
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(global, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: original,
    });
  }
});

it('requires a new intersection instead of chaining every short page', () => {
  /** R-DEC-33: a stationary sentinel must not fetch all pages after an overlap. */
  const original = global.IntersectionObserver;
  Object.defineProperty(global, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: jest.fn((callback) => ({
      observe: () => callback([{ isIntersecting: true }]),
      disconnect: jest.fn(),
    })),
  });
  try {
    const load = jest.fn();
    const props = {
      onLoadMore: load,
      loadingLabel: 'Loading',
      moreLabel: 'Show more',
      repeatWhileVisible: false,
    };
    const view = render(<UbLoadMore {...props} loading={false} />);
    view.rerender(<UbLoadMore {...props} loading />);
    view.rerender(<UbLoadMore {...props} loading={false} />);
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(load).toHaveBeenCalledTimes(2);
  } finally {
    Object.defineProperty(global, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: original,
    });
  }
});
