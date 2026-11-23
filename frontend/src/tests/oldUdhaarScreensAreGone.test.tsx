import { render, screen } from '@testing-library/react';

import { ShopBookOnly } from 'modules/DigiKhaato/features/parties/components/ShopBookOnly';

/**
 * Owner, 13 Nov 2026: "Remove them". After the Money Book was rebuilt, the old
 * Udhaar person page and statement had no menu link but still opened by address
 * from a Money Book, Lending or Library session, showing the old shared ledger.
 * They now open only for the Shop's book; anyone else is sent to their app's home.
 */
const replace = jest.fn();
jest.mock('src/hooks/useAppRouter', () => ({ useAppRouter: () => ({ replace }) }));

let open: { book: 'main' | 'shop'; app: string | null } = { book: 'shop', app: 'shop' };
jest.mock('modules/DigiKhaato/features/navigation/useAppWords', () => ({
  useAppWords: () => open,
}));
jest.mock('modules/DigiKhaato/features/navigation/useNavigation', () => ({
  useNavigation: () => ({
    apps: [
      { code: 'shop', href: '/dashboard' },
      { code: 'khata', href: '/money-book' },
    ],
  }),
}));

beforeEach(() => replace.mockClear());

it('the Shop still opens the person page', () => {
  open = { book: 'shop', app: 'shop' };
  render(<ShopBookOnly>person page</ShopBookOnly>);
  expect(screen.getByText('person page')).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it('from the Money Book the old page is not drawn and the visitor goes to the Money Book', () => {
  open = { book: 'main', app: 'khata' };
  render(<ShopBookOnly>person page</ShopBookOnly>);
  expect(screen.queryByText('person page')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/money-book');
});

it('with no app open the visitor goes to the Apps page', () => {
  open = { book: 'main', app: null };
  render(<ShopBookOnly>person page</ShopBookOnly>);
  expect(screen.queryByText('person page')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/apps');
});
