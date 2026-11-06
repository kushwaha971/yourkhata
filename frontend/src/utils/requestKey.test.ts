import type { ApiErrorShape } from 'src/types/api.types';
import { mayHaveBeenSaved } from 'src/utils/requestKey';

/**
 * L-R1 — the rule that decides whether "Try again" reuses the key. Getting it
 * wrong in one direction records a collection twice (a timeout treated as an
 * answer); in the other it replays a refused body forever (a 409 treated as
 * silence).
 */
const error = (code: string, status: number | null): ApiErrorShape =>
  ({ code, message: '', details: {}, requestId: null, status, warnings: [] }) as ApiErrorShape;

it.each([
  ['no error at all', undefined, true],
  ['a timeout', error('timeout', null), true],
  ['no network', error('network_error', null), true],
  ['offline', error('offline', null), true],
  ['a 502 from a proxy', error('server_error', 502), true],
  ['a refusal', error('loan_not_active', 409), false],
  ['a validation error', error('validation_error', 400), false],
  ['an expired session', error('unauthenticated', 401), false],
])('%s → may have been saved: %s', (_name, value, expected) => {
  expect(mayHaveBeenSaved(value)).toBe(expected);
});
