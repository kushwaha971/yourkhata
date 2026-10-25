import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { PartyDetailPageContent } from './PartyDetailPageContent';
import { PersonalUdhaarPage } from './PersonalUdhaarPage';

jest.mock('../api/partyService');
jest.mock('../api/tagService');
jest.mock('modules/DigiKhaato/features/ledger/api/ledgerService');
jest.mock('modules/DigiKhaato/features/reminders/api/reminderService');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  usePathname: () => '/parties/p1',
  useSearchParams: () => new URLSearchParams(),
}));
const parties = jest.requireMock('../api/partyService') as { getParty: jest.Mock };
const ledger = jest.requireMock('modules/DigiKhaato/features/ledger/api/ledgerService') as {
  listPartyEntries: jest.Mock;
};
const reminders = jest.requireMock('modules/DigiKhaato/features/reminders/api/reminderService') as {
  previewReminder: jest.Mock;
  sendReminder: jest.Mock;
};
const tags = jest.requireMock('../api/tagService') as { listTags: jest.Mock };
const person = {
  id: 'p1',
  name: 'Ravi Kumar',
  mobile: '+919794620535',
  balance: '500.00',
  displayCode: 'C-1',
  status: 'active',
  isCustomer: true,
  isSupplier: false,
  tags: [],
  lastActivityAt: null,
  creditLimit: '1000.00',
  creditDays: 7,
  collectionDate: null,
  notes: 'Old business note',
  email: 'old@test.local',
  gstin: '27AAPFU0939F1ZV',
  stateCode: '27',
  altPhone: null,
  billingAddress: { line1: 'Old address' },
  openingAmount: null,
  openingDirection: null,
  openingAsOf: null,
  createdAt: '2026-01-01T00:00:00Z',
  smsOptIn: true,
  consentSource: null,
};
const permissions: PermissionCode[] = [
  'parties.party.read',
  'parties.party.write',
  'ledger.entry.read',
  'ledger.entry.write',
  'ledger.reminder.write',
];
const signIn = (rights: PermissionCode[] = permissions) =>
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Owner',
        email: 'qa@test.local',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Personal book', timezone: 'Asia/Kolkata', role: 'owner' },
      tenants: [{ id: 't1', name: 'Personal book', timezone: 'Asia/Kolkata' }],
      permissions: rights,
      enabledModules: ['parties', 'ledger', 'khata'],
      activeApp: 'khata',
      version: 1,
    })
  );
beforeEach(() => {
  store.dispatch(resetAllFeatureState());
  jest.clearAllMocks();
  signIn();
  parties.getParty.mockResolvedValue({
    party: person,
    summary: { balance: '500.00' },
    credit: null,
  });
  ledger.listPartyEntries.mockResolvedValue({
    rows: [],
    hasMore: false,
    nextCursor: null,
    summary: { totalDebit: '0.00', totalCredit: '0.00', entryCount: 0 },
  });
  reminders.previewReminder.mockResolvedValue({
    partyId: 'p1',
    balance: '500.00',
    text: 'Ravi, ₹500 is due.',
    smsText: 'Ravi, ₹500 is due.',
    hasMobile: true,
    hasUpi: false,
    warnings: [],
  });
  tags.listTags.mockResolvedValue([]);
});

it('shows only identity, money, history and useful actions for personal Udhaar', async () => {
  /** Removed business details must not reappear merely because the shared contact stores them. */
  renderWithProviders(<PartyDetailPageContent id="p1" />);
  await screen.findByRole('heading', { name: 'Ravi Kumar' });
  expect(screen.getByText('₹500.00')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Report' })).toHaveAttribute(
    'href',
    '/parties/p1/statement'
  );
  expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+919794620535');
  expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'SMS' })).toBeInTheDocument();
  for (const text of [
    'Details',
    'GSTIN',
    'Credit limit',
    'Old business note',
    'old@test.local',
    '27AAPFU0939F1ZV',
    'Not reminded yet',
  ])
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Entry history' })).toHaveAttribute('tabindex', '0');
});

it('opens an editable reminder without sending anything', async () => {
  const user = userEvent.setup();
  renderWithProviders(<PersonalUdhaarPage id="p1" />);
  await screen.findByText('Ravi Kumar');
  await user.click(screen.getByRole('button', { name: 'WhatsApp' }));
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toHaveValue('Ravi, ₹500 is due.'));
  await user.clear(message);
  await user.type(message, 'Please return ₹500 tomorrow.');
  expect(message).toHaveValue('Please return ₹500 tomorrow.');
  expect(reminders.sendReminder).not.toHaveBeenCalled();
});

it('SMS opens its own editable text with only the selected channel', async () => {
  /** A tap on SMS must not make the user choose WhatsApp versus SMS a second time. */
  reminders.previewReminder.mockResolvedValue({
    partyId: 'p1',
    balance: '500.00',
    text: 'WhatsApp text',
    smsText: 'SMS text',
    hasMobile: true,
    hasUpi: false,
    warnings: [],
  });
  const user = userEvent.setup();
  renderWithProviders(<PersonalUdhaarPage id="p1" />);
  await screen.findByText('Ravi Kumar');
  await user.click(screen.getByRole('button', { name: 'SMS' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() =>
    expect(within(dialog).getByRole('textbox', { name: 'Message' })).toHaveValue('SMS text')
  );
  expect(within(dialog).getByRole('link', { name: 'SMS' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  expect(reminders.sendReminder).not.toHaveBeenCalled();
});

it('edits only name and mobile, with no hidden opening amount or business fields', async () => {
  const user = userEvent.setup();
  renderWithProviders(<PersonalUdhaarPage id="p1" />);
  await screen.findByText('Ravi Kumar');
  await user.click(screen.getByRole('button', { name: 'Edit person' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Ravi Kumar');
  expect(within(dialog).getByRole('textbox', { name: 'Mobile number' })).toBeInTheDocument();
  expect(within(dialog).queryByLabelText('Amount')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('GSTIN')).not.toBeInTheDocument();
});

it('keeps writing and reminding absent without their permissions', async () => {
  signIn(['parties.party.read', 'ledger.entry.read']);
  renderWithProviders(<PersonalUdhaarPage id="p1" />);
  await screen.findByText('Ravi Kumar');
  expect(screen.queryByRole('button', { name: 'Gave money' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Got money' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'WhatsApp' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit person' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Report' })).toBeInTheDocument();
});
