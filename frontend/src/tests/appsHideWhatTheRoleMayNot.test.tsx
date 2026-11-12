import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { RoutesPageContent } from 'modules/DigiKhaato/features/lending/components/RoutesPageContent';
import { SettingsPageContent as LendingSettings } from 'modules/DigiKhaato/features/lending/components/SettingsPageContent';
import { ExpensesPageContent } from 'modules/DigiKhaato/features/library/components/ExpensesPageContent';
import { SettingsPageContent as LibrarySettings } from 'modules/DigiKhaato/features/library/components/SettingsPageContent';

/**
 * QA audit, 12 Nov 2026. A staff member and an accountant signed in to Lending
 * and the Library and saw every button the owner sees: add a route, change the
 * settings, add and remove an expense. The server refused each one, so the
 * member tapped, typed and was then told no. R-SEC-2: a control the server
 * would refuse is hidden. Each test names what that role must not be offered.
 */
jest.mock('modules/DigiKhaato/features/lending/api/lendingService');
jest.mock('modules/DigiKhaato/features/library/api/libraryService');

let granted: readonly string[] = [];
jest.mock('src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: (code: string) => granted.includes(code),
    canAll: (codes: readonly string[]) => codes.every((c) => granted.includes(c)),
    hasModule: () => true,
    permissions: granted,
  }),
}));

const lending = jest.requireMock('modules/DigiKhaato/features/lending/api/lendingService') as {
  listRoutes: jest.Mock;
  getSettings: jest.Mock;
};
const library = jest.requireMock('modules/DigiKhaato/features/library/api/libraryService') as {
  listExpenses: jest.Mock;
  getSettings: jest.Mock;
  listShifts: jest.Mock;
};

const STAFF_LENDING = ['lending.loan.read', 'lending.collection.create'];
const STAFF_LIBRARY = ['library.member.read', 'library.member.write', 'library.fee.create'];
const OWNER = [...STAFF_LENDING, 'lending.loan.create', 'lending.settings.manage', ...STAFF_LIBRARY, 'library.settings.manage'];
const EXPENSE = { id: 'e1', spentOn: '2026-11-10', head: 'electricity', amount: '1200.00', note: 'October', status: 'live', reason: '' };

beforeEach(() => {
  lending.listRoutes.mockResolvedValue([{ id: 'r1', name: 'Camp road', active: true }]);
  lending.getSettings.mockResolvedValue({ signAs: 'Gyan Finance', name: 'Gyan Finance', upiId: '' });
  library.listExpenses.mockResolvedValue([EXPENSE]);
  library.getSettings.mockResolvedValue({ signAs: 'Gyan Library', name: 'Gyan Library', upiId: '', dueSoonDays: 3, seats: 20 });
  library.listShifts.mockResolvedValue([]);
});

describe('Lending shows a member only what their role may do', () => {
  it('staff read the routes but are not offered the add form', async () => {
    granted = STAFF_LENDING;
    renderWithProviders(<RoutesPageContent />);
    expect(await screen.findByText('Camp road')).toBeInTheDocument();
    expect(screen.queryByTestId('lending-route-add')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Route name')).not.toBeInTheDocument();
  });

  it('the owner keeps the add form', async () => {
    granted = OWNER;
    renderWithProviders(<RoutesPageContent />);
    expect(await screen.findByTestId('lending-route-add')).toBeInTheDocument();
  });

  it('staff opening Settings are told it is the owner’s, with no form to fill', async () => {
    granted = STAFF_LENDING;
    renderWithProviders(<LendingSettings />);
    expect(await screen.findByText('Only the owner can do this')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('The Library shows a member only what their role may do', () => {
  it('staff see the expenses but cannot add one or open one to remove it', async () => {
    granted = STAFF_LIBRARY;
    renderWithProviders(<ExpensesPageContent />);
    expect(await screen.findByText('Light bill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
    expect(screen.getByText('Light bill').closest('button')).toBeDisabled();
  });

  it('the owner keeps Add expense', async () => {
    granted = OWNER;
    renderWithProviders(<ExpensesPageContent />);
    expect((await screen.findAllByRole('button', { name: 'Add expense' })).length).toBeGreaterThan(0);
    expect(screen.getByText('Light bill').closest('button')).toBeEnabled();
  });

  it('staff opening Settings are told it is the owner’s, with no fee or seat to change', async () => {
    granted = STAFF_LIBRARY;
    renderWithProviders(<LibrarySettings />);
    expect(await screen.findByText('Only the owner can do this')).toBeInTheDocument();
    expect(screen.queryByTestId('library-settings-seats')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
