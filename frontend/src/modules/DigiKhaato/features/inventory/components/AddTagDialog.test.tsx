import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { AddTagDialog } from './AddTagDialog';

/**
 * G2a — the item page's Add tag (design D3 "Tag details" on an item already
 * in the shop). Pins that what is typed is what is sent, that making "₹ per g"
 * travels as per_g, and that the server's refusal of a used tag no. lands under
 * the Tag no. box rather than as a loose message.
 */
jest.mock('../api/tagService', () => ({
  ...jest.requireActual('../api/tagService'),
  addTag: jest.fn(),
}));
const service = jest.requireMock('../api/tagService') as { addTag: jest.Mock };

beforeEach(() => jest.clearAllMocks());

it('sends the tag as typed, making by ₹ per g', async () => {
  service.addTag.mockResolvedValue({
    id: 's1',
    tagNo: 'RG-0318',
    status: 'in_stock',
    soldOn: null,
    purity: 'gold_22k',
    netG: '3.850',
    huid: '',
  });
  const onAdded = jest.fn();
  renderWithProviders(<AddTagDialog itemId="i1" onClose={() => undefined} onAdded={onAdded} />);
  await userEvent.type(screen.getByLabelText('Tag no.'), 'RG-0318');
  await userEvent.type(screen.getByLabelText('Gross'), '4.100');
  await userEvent.type(screen.getByLabelText('Stone'), '0.250');
  await userEvent.click(screen.getByRole('button', { name: '₹ per g' }));
  await userEvent.type(screen.getByLabelText('Making amount'), '850');
  await userEvent.click(screen.getByTestId('tag-add-save'));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(service.addTag).toHaveBeenCalledWith(
    'i1',
    expect.objectContaining({
      tagNo: 'RG-0318',
      grossG: '4.100',
      stoneG: '0.250',
      makingType: 'per_g',
      makingValue: '850.00',
    })
  );
});

it('puts a refused tag no. under its own box', async () => {
  service.addTag.mockRejectedValue({
    code: 'validation_error',
    status: 400,
    message: 'Check the tag details.',
    details: { tag_no: ['This tag no. is already used.'] },
  });
  renderWithProviders(
    <AddTagDialog itemId="i1" onClose={() => undefined} onAdded={() => undefined} />
  );
  await userEvent.type(screen.getByLabelText('Tag no.'), 'GC-1042');
  await userEvent.type(screen.getByLabelText('Gross'), '12.900');
  await userEvent.click(screen.getByTestId('tag-add-save'));
  expect(await screen.findByText('This tag no. is already used.')).toBeInTheDocument();
  expect(screen.getByLabelText('Tag no.')).toHaveAttribute('aria-invalid', 'true');
});
