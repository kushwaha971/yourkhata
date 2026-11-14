import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';

import { useValidationSchemas } from 'src/hooks/useValidationSchemas';
import { store } from 'src/redux/store';
import { ALL_MESSAGES } from 'src/tests/allMessages';


const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <IntlProvider locale="en" messages={ALL_MESSAGES.en}>
      {children}
    </IntlProvider>
  </Provider>
);

describe('QA B15: format errors explain what to correct before checking digits', () => {
  it.each([false, true])(
    'gives only the length error for a short GSTIN (required=%s)',
    async (required) => {
      // A short GSTIN cannot have a wrong check digit; the merchant needs its length first.
      const { result } = renderHook(() => useValidationSchemas(), { wrapper });
      await expect(
        result.current.gstinValidation(required).validate('ABC123', { abortEarly: false })
      ).rejects.toMatchObject({ errors: ['GSTIN must be 15 characters.'] });
    }
  );

  it('does not blame the checksum for a GSTIN with the wrong layout', async () => {
    // Shape and checksum used to both fail, leaving the checksum as the visible error.
    const { result } = renderHook(() => useValidationSchemas(), { wrapper });
    await expect(
      result.current.gstinValidation().validate('ABCDEFGHIJKLMNO', { abortEarly: false })
    ).rejects.toMatchObject({ errors: ['Check the GSTIN format.'] });
  });

  it('still catches a wrong check digit after the GSTIN layout is valid', async () => {
    // Prioritising format must not let a plausible but incorrect GSTIN through.
    const { result } = renderHook(() => useValidationSchemas(), { wrapper });
    await expect(
      result.current.gstinValidation().validate('27AAPFU0939F1ZU', { abortEarly: false })
    ).rejects.toMatchObject({ errors: ["That GSTIN's check digit is wrong."] });
  });
});
