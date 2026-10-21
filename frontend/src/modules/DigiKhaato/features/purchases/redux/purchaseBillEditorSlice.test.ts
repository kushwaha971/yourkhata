import { resetAllFeatureState } from 'src/redux/actions';

import { purchaseBillEditorReducer } from './purchaseBillEditorSlice';
import { recordPurchaseBill } from './purchaseBillThunk';

import type { PurchaseBillEnvelope } from '../types/purchase.types';

const attempt = { id: 'old-business-bill', version: 4, idempotencyKey: 'original-record' };

it('ignores a late Record success after actor/business state was reset', () => {
  // Defect: Record lacked the request fence used by loads/saves and could reseed the next actor.
  const pending = purchaseBillEditorReducer(undefined, recordPurchaseBill.pending('old', attempt));
  const reset = purchaseBillEditorReducer(pending, resetAllFeatureState());
  const late = {
    bill: { id: attempt.id, version: 5 },
    warnings: [],
  } as unknown as PurchaseBillEnvelope;
  const result = purchaseBillEditorReducer(
    reset,
    recordPurchaseBill.fulfilled(late, 'old', attempt)
  );
  expect(result.document).toBeNull();
  expect(result.recorded).toBeNull();
});

it('ignores a late Record refusal after actor/business state was reset', () => {
  // Defect: the previous actor's refusal must not paint the next editor's recovery surface.
  const pending = purchaseBillEditorReducer(undefined, recordPurchaseBill.pending('old', attempt));
  const reset = purchaseBillEditorReducer(pending, resetAllFeatureState());
  const result = purchaseBillEditorReducer(
    reset,
    recordPurchaseBill.rejected(null, 'old', attempt, {
      code: 'permission_denied',
      message: 'Old actor',
      details: { payment: ['Refused'] },
      requestId: null,
      status: 403,
      warnings: [],
    })
  );
  expect(result.error).toBeNull();
});
