import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { UbDialogLoading } from '../UbDialog/UbDialogLoading';

import { UbDrawerLoading } from './UbDrawerLoading';

describe('the loading shapes of lazily loaded overlays (A8)', () => {
  it('UbDrawerLoading is an open drawer frame with a busy body', () => {
    /** The press is answered at once by the frame the real drawer will fill. */
    renderWithProviders(<UbDrawerLoading />);
    const dialog = screen.getByRole('dialog', { name: 'Loading…' });
    expect(dialog.querySelector('[data-ub-drawer-loading][aria-busy=true]')).not.toBeNull();
  });

  it('UbDialogLoading is an open dialog frame with a busy body', () => {
    renderWithProviders(<UbDialogLoading />);
    const dialog = screen.getByRole('dialog', { name: 'Loading…' });
    expect(dialog.querySelector('[data-ub-dialog-loading][aria-busy=true]')).not.toBeNull();
  });
});
