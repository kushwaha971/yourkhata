import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import * as service from '../api/lendingService';

import { CollectDialog } from './CollectDialog';

jest.mock('../api/lendingService', () => ({
  ...jest.requireActual('../api/lendingService'),
  previewCollection: jest.fn(),
  collect: jest.fn(),
}));

it('shows the overpayment refusal once after preview and Save both refuse it (QA B15)', async () => {
  // The preview warning and the server field error used to repeat the same refusal.
  store.dispatch(resetAllFeatureState());
  const error = {
    code: 'collection_over_payoff',
    message: 'Only ₹1,200.00 is left to collect.',
    details: {},
    requestId: 'test-collection',
    status: 409,
  };
  jest.mocked(service.previewCollection).mockRejectedValue(error);
  jest.mocked(service.collect).mockRejectedValue(error);
  const user = userEvent.setup();
  renderWithProviders(
    <CollectDialog
      loanId="loan1"
      name="Borrower"
      number="LN-0001"
      suggested=""
      onClose={jest.fn()}
    />
  );
  await user.type(screen.getByRole('textbox', { name: 'Amount received' }), '5000');
  expect(await screen.findByText(error.message)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save collection' }));
  await waitFor(() => expect(service.collect).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByText(error.message)).toHaveLength(1));
});

/**
 * L-R1 (07-screens/13) — the money write a collector retries after losing
 * signal. `save` used to call `rotate()` after EVERY result, so "Try again"
 * after a timeout sent a NEW key: if the first request had reached the server,
 * the collection was recorded twice. The key now survives a save that ended
 * without an answer, and only a real answer mints a new one.
 */
describe('Collect request key', () => {
  const renderCollect = () =>
    renderWithProviders(
      <CollectDialog
        loanId="loan1"
        name="Borrower"
        number="LN-0001"
        suggested="500"
        onClose={jest.fn()}
      />
    );
  const keyOf = (call: number) => jest.mocked(service.collect).mock.calls[call]?.[2];

  beforeEach(() => {
    store.dispatch(resetAllFeatureState());
    jest.mocked(service.collect).mockReset();
    jest.mocked(service.collect).mockResolvedValue({
      amount: '500.00',
      receiptNumber: 'R-0001',
      loanStatus: 'active',
    } as Awaited<ReturnType<typeof service.collect>>);
    jest.mocked(service.previewCollection).mockReturnValue(new Promise(() => undefined));
  });

  it('retries a timed-out save under the SAME key', async () => {
    jest.mocked(service.collect).mockRejectedValueOnce({
      code: 'timeout',
      message: 'Could not reach the server.',
      details: {},
      requestId: null,
      status: null,
      warnings: [],
    });
    const user = userEvent.setup();
    renderCollect();
    const save = screen.getByRole('button', { name: 'Save collection' });
    await user.click(save);
    await waitFor(() => expect(service.collect).toHaveBeenCalledTimes(1));
    await user.click(save);
    await waitFor(() => expect(service.collect).toHaveBeenCalledTimes(2));
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it('mints a new key after a refusal the server answered', async () => {
    jest.mocked(service.collect).mockRejectedValueOnce({
      code: 'loan_not_active',
      message: 'This loan is not running.',
      details: {},
      requestId: null,
      status: 409,
      warnings: [],
    });
    const user = userEvent.setup();
    renderCollect();
    const save = screen.getByRole('button', { name: 'Save collection' });
    await user.click(save);
    await waitFor(() => expect(service.collect).toHaveBeenCalledTimes(1));
    await user.click(save);
    await waitFor(() => expect(service.collect).toHaveBeenCalledTimes(2));
    expect(keyOf(1)).not.toBe(keyOf(0));
  });
});

/**
 * Found by the F3 double-tap run on a 1280 px screen: typing "1" and clicking
 * Save collection did nothing. The click's mousedown blurred the amount, the
 * blur padded it to "1.00", that cleared the preview card, the dialog's footer
 * moved up, and the mouseup landed on empty sheet. Padding is the same amount,
 * so the card must stay.
 */
it('keeps the preview card when leaving the amount only pads it', async () => {
  store.dispatch(resetAllFeatureState());
  jest
    .mocked(service.previewCollection)
    .mockResolvedValue({ amount: '1.00', remainingAfter: '999.00', clears: [] } as Awaited<
      ReturnType<typeof service.previewCollection>
    >);
  const user = userEvent.setup();
  renderWithProviders(
    <CollectDialog
      loanId="loan1"
      name="Borrower"
      number="LN-0001"
      suggested=""
      onClose={jest.fn()}
    />
  );
  await user.type(screen.getByRole('textbox', { name: 'Amount received' }), '1');
  expect(await screen.findByTestId('lending-collect-clears')).toBeInTheDocument();
  await user.tab();
  expect(screen.getByRole('textbox', { name: 'Amount received' })).toHaveValue('1.00');
  expect(screen.getByTestId('lending-collect-clears')).toBeInTheDocument();
});
