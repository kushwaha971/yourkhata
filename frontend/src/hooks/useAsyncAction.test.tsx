import { act, fireEvent, render, screen } from '@testing-library/react';

import { UbButton } from 'src/design-system/UbButton';

/**
 * 05 §3 — an async onClick locks its button until it settles.
 *
 * The defect: `busy` was the caller's to remember, and a button whose caller
 * set it from a slice status painted it a render late. Two taps inside that
 * gap both ran the handler: two POSTs. The lock is a ref inside UbButton, so
 * every button in the product gets it whether or not its caller passes `busy`.
 */
const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('UbButton async lock (useAsyncAction)', () => {
  it('runs an async onClick once for two taps in the same frame', async () => {
    const pending = deferred();
    const onClick = jest.fn(() => pending.promise);
    render(<UbButton onClick={onClick}>Collect</UbButton>);
    const button = screen.getByRole('button', { name: 'Collect' });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(button).not.toHaveAttribute('aria-busy');
    await act(async () => {
      fireEvent.click(button);
    });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('shows busyLabel while an async onClick runs', async () => {
    const pending = deferred();
    render(
      <UbButton onClick={() => pending.promise} busyLabel="Saving…">
        Save
      </UbButton>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('leaves a plain onClick tappable — opening a sheet must not lock', () => {
    const onClick = jest.fn();
    render(<UbButton onClick={onClick}>Open</UbButton>);
    const button = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(button).not.toBeDisabled();
  });

  it('unlocks after a failed save so the merchant can try again', async () => {
    // A thunk dispatch RESOLVES with a rejected action; that is the failure
    // shape every money button meets.
    const onClick = jest.fn(() => Promise.resolve({ error: { code: 'network_error' } }));
    render(<UbButton onClick={onClick}>Collect</UbButton>);
    const button = screen.getByRole('button', { name: 'Collect' });
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
