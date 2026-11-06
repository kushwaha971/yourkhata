import reducer, { hideSnackbar, showSnackbar } from 'src/redux/slice/snackbarSlice';

describe('context change feedback', () => {
  it.each(['auth.session.changed', 'tenant.switcher.staleTab'])(
    'keeps %s visible when a rejected old form also reports failure',
    (id) => {
      // BP-13 browser defect: the form rejection replaced the account-change
      // warning with a generic save error before the automatic reload.
      const warning = reducer(undefined, showSnackbar({ severity: 'warning', id }));
      const after = reducer(
        warning,
        showSnackbar({ severity: 'error', id: 'parties.form.error.title' })
      );
      expect(after.id).toBe(id);
      const dismissed = reducer(after, hideSnackbar());
      expect(
        reducer(dismissed, showSnackbar({ severity: 'success', id: 'parties.form.saved' })).id
      ).toBe('parties.form.saved');
    }
  );
});
