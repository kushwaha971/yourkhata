import type { ApiErrorShape } from 'src/types/api.types';
import { fieldErrorEntries } from 'src/utils/apiError';


/**
 * The server's own reason for a refused save or issue (owner, 27 Oct 2026):
 * a 400 says "Please check the highlighted fields." and puts the real reason
 * in `details` — "Quantity must be a whole number for NOS." — so that is what
 * the merchant reads, with the line it is on. `null` when there is no error.
 */
export const serverReason = (
  error: ApiErrorShape | null | undefined,
  t: (id: string, values?: Record<string, string | number>) => string
): string | null => {
  if (!error) return null;
  const first = fieldErrorEntries(error)[0];
  if (!first) return error.message || null;
  const line = /^lines\.(\d+)\./.exec(first.field);
  return line
    ? t('sales.dock.lineReason', { n: Number(line[1]) + 1, reason: first.message })
    : first.message;
};
