import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';

import { store } from 'src/redux/store';
import { ALL_MESSAGES } from 'src/tests/allMessages';

import { useLibrarySchemas } from './librarySchemas';

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <IntlProvider locale="en" messages={ALL_MESSAGES.en}>
      {children}
    </IntlProvider>
  </Provider>
);

/**
 * The enrol drawer sent nothing and showed no error (Library round, 12 Nov):
 * a rule refusing a field the drawer does not draw a message for leaves the
 * person at the counter pressing Enrol with no answer. Every field the drawer
 * starts with must pass when the form is filled the way a person fills it.
 */
describe('the enrol form', () => {
  it('accepts a name, a shift, a fee and the defaults, with no mobile and nothing paid now', async () => {
    const { result } = renderHook(() => useLibrarySchemas(), { wrapper });
    const values = {
      name: 'Dbg One',
      mobile: '',
      shiftId: '01a1cd78-70bb-70a3-a1a2-da1e3d237767',
      seat: '',
      monthlyFee: '800',
      joinedOn: '2026-11-12',
      firstPayment: '',
      mode: 'cash',
    };
    const clean = await result.current.enrolSchema.validate(values, { abortEarly: false });
    // The shared mobile rule turns an empty box into null, and the save read
    // `values.mobile.replace(...)`: it threw, nothing was sent and Enrol spun
    // for ever (Library round, 12 Nov). The drawer must read it null-safe.
    expect(clean.mobile ?? '').toBe('');
  });

  it('accepts a mobile as the phone box gives it (+91 and digits)', async () => {
    const { result } = renderHook(() => useLibrarySchemas(), { wrapper });
    const values = {
      name: 'Dbg', mobile: '+919822041178', shiftId: 'x', seat: '3', monthlyFee: '800',
      joinedOn: '2026-11-12', firstPayment: '800', mode: 'upi',
    };
    await expect(result.current.enrolSchema.validate(values, { abortEarly: false })).resolves.toBeTruthy();
  });
});
