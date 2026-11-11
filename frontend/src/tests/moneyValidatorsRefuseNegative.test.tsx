import { useEffect } from 'react';

import { useValidationSchemas, type ValidationSchemas } from 'src/hooks/useValidationSchemas';
import { renderWithProviders } from 'src/tests/renderWithProviders';

/**
 * QA B14 — "Staff may waive up to" took −50 and saved ₹50.00 with a success toast:
 * the money input dropped the minus without a word. It now keeps it, and both money
 * validators every form shares refuse it as "Enter 0 or more." before any format
 * check could word it as a typo.
 */
function Probe({ onReady }: Readonly<{ onReady: (v: ValidationSchemas) => void }>): null {
  const schemas = useValidationSchemas();
  useEffect(() => onReady(schemas), [onReady, schemas]);
  return null;
}

const messageOf = (run: () => unknown): string => {
  try {
    run();
    return '';
  } catch (error) {
    return (error as Error).message;
  }
};

it('refuses a negative amount in words, in the required and the optional validator', () => {
  let v = null as unknown as ValidationSchemas;
  renderWithProviders(
    <Probe
      onReady={(schemas) => {
        v = schemas;
      }}
    />
  );
  expect(messageOf(() => v.amountValidation({ allowZero: true }).validateSync('-50'))).toBe(
    'Enter 0 or more.'
  );
  expect(messageOf(() => v.optionalAmountValidation().validateSync('-50'))).toBe(
    'Enter 0 or more.'
  );
  expect(messageOf(() => v.optionalAmountValidation().validateSync('50'))).toBe('');
});

it('calls an extra zero too large, not a decimals mistake (E7)', () => {
  /* Money Book round (11 Nov 2026): 99999999999 — 99999999999 for 9999999999 —
     was told "Use up to two decimals, like 500.00.", because the format pattern
     also caps the digits and ran first. Size is now judged before shape. */
  let v = null as unknown as ValidationSchemas;
  renderWithProviders(
    <Probe
      onReady={(schemas) => {
        v = schemas;
      }}
    />
  );
  expect(
    messageOf(() => v.amountValidation({ max: '9999999999.99' }).validateSync('99999999999'))
  ).toBe('That amount is too large.');
  // A real decimals mistake still says so.
  expect(messageOf(() => v.amountValidation().validateSync('50.123'))).toBe(
    'Use up to two decimals, like 500.00.'
  );
  expect(messageOf(() => v.amountValidation().validateSync('500'))).toBe('');
});
