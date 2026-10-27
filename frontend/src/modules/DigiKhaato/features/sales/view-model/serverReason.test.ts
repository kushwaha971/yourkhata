import type { ApiErrorShape } from 'src/types/api.types';

import { serverReason } from './serverReason';


const t = (id: string, v?: Record<string, string | number>) => `${id}|${v?.n}|${v?.reason}`;
const refusal = (details: Record<string, unknown>): ApiErrorShape =>
  ({
    code: 'validation_error',
    message: 'Please check the highlighted fields.',
    details,
    requestId: 'r',
    status: 400,
    warnings: [],
  }) as ApiErrorShape;

describe('serverReason (owner, 27 Oct 2026: the exact reason, not "highlighted fields")', () => {
  it('reads the reason from details and names the line', () => {
    /* Prevents "Couldn't save: Please check the highlighted fields." when the
       server said "Quantity must be a whole number for NOS." for line 1. */
    expect(
      serverReason(refusal({ 'lines.0.qty': ['Quantity must be a whole number for NOS.'] }), t)
    ).toBe('sales.dock.lineReason|1|Quantity must be a whole number for NOS.');
  });

  it('uses a bill-level reason as it is', () => {
    expect(serverReason(refusal({ discount_value: ['Discount cannot exceed 100%.'] }), t)).toBe(
      'Discount cannot exceed 100%.'
    );
  });

  it('falls back to the message when there are no field details, and to nothing with no error', () => {
    expect(serverReason(refusal({}), t)).toBe('Please check the highlighted fields.');
    expect(serverReason(null, t)).toBeNull();
  });
});
