import type { ApiErrorCode, ApiErrorShape } from 'src/types/api.types';

const UNANSWERED_CODES: ReadonlySet<ApiErrorCode> = new Set([
  'network_error',
  'timeout',
  'offline',
]);

/**
 * 05 §4 / L-R1 — did this failed write end without a real answer from the
 * server, so that it MAY have been saved?
 *
 * The rule an idempotency key follows is built on it: keep the key when the
 * write may have landed (no answer, a timeout, a 5xx), so "Try again" replays
 * the first save instead of recording the money a second time; mint a new one
 * only after success or a refusal the server actually answered. A missing
 * error — a thunk that threw without `rejectWithValue`, an aborted request —
 * is the same unknown and keeps the key too.
 */
export const mayHaveBeenSaved = (error: ApiErrorShape | null | undefined): boolean =>
  !error || UNANSWERED_CODES.has(error.code) || (error.status ?? 0) >= 500;
