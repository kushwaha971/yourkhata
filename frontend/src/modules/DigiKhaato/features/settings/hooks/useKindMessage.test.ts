import { renderHook } from '@testing-library/react';

import { useKindMessage } from './useKindMessage';

jest.mock('src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (id: string) => id, locale: 'hi-IN' }),
}));
jest.mock('src/hooks/useAppStore', () => ({
  useAppSelector: () => ({ messages: { order_ready: { en: 'English', hi: 'हिंदी' } } }),
}));

/**
 * The app's locale carries a region ("hi-IN"), and the saved words are keyed by
 * language: an exact match found nothing, so a shop's saved words were ignored
 * and Settings previewed the English ones to a Hindi user.
 */
it("uses the saved words of the locale's language", () => {
  const { result } = renderHook(() => useKindMessage('order_ready'));
  expect(result.current('standard', {})).toBe('हिंदी');
});
