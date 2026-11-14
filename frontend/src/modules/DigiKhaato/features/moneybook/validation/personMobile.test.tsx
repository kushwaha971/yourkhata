import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';

import { store } from 'src/redux/store';
import { ALL_MESSAGES } from 'src/tests/allMessages';

import { useMoneyBookSchemas } from './moneybookSchemas';

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <IntlProvider locale="en" messages={ALL_MESSAGES.en}>
      {children}
    </IntlProvider>
  </Provider>
);

/**
 * Add person with no mobile spun for ever and sent nothing (found 12 Nov in the
 * Library round, the same line as the Library's Enrol): the mobile rule turns an
 * empty box into null and the save called `.replace` on it. The person form
 * reads it null-safe now; this pins what the rule hands over.
 */
it('an empty mobile comes out of the person rules as null, which the save must accept', async () => {
  const { result } = renderHook(() => useMoneyBookSchemas(), { wrapper });
  const clean = await result.current.personSchema.validate({ name: 'Raju', mobile: '' });
  expect(clean.mobile ?? '').toBe('');
});
