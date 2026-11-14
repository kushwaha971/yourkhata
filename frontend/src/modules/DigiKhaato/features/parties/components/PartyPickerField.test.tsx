import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { PartyPickerField } from './PartyPickerField';

jest.mock('../hooks/usePartySearch', () => ({
  usePartySearch: () => ({
    canSearch: true,
    query: 'Verma',
    setQuery: jest.fn(),
    activate: jest.fn(),
    active: true,
    pending: false,
    status: 'succeeded',
    hasMore: false,
    loadMore: jest.fn(),
    clear: jest.fn(),
    results: [{ id: 'p1', name: 'Verma & Sons 21', mobile: '+919000000021' }],
  }),
}));

/**
 * A3 manual pass: the picker listed "9000000021" while the customer box a tap
 * later said "+91 90000 00021" — the same number written two ways on one
 * screen. The picker groups it with the shared formatter, like every list.
 */
it('shows the mobile grouped the way the rest of the product prints it', () => {
  renderWithProviders(
    <PartyPickerField
      field={
        { id: 'f', name: 'partyId', value: '', onChange: jest.fn(), onBlur: jest.fn() } as never
      }
      pickedName=""
      onPick={jest.fn()}
      labels={{ clear: () => '', noAccess: '', results: 'Results', noMatch: '' }}
      t={((id: string) => id) as never}
    />
  );
  fireEvent.focus(screen.getByRole('combobox'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Verma' } });
  expect(screen.getByText('+91 90000 00021')).toBeInTheDocument();
  expect(screen.queryByText('9000000021')).not.toBeInTheDocument();
});
