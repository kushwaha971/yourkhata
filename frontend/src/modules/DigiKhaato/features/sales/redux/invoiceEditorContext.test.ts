import { invoiceEditorReducer as reducer } from './invoiceEditorSlice';
import { fetchSalesContext } from './salesThunk';

/**
 * Shop round (11 Nov 2026): when the shop's billing context failed to load,
 * the bill editor stayed a grey skeleton for ever with no word and no retry.
 * A failure is remembered so the editor can say so; leaving the page (an
 * aborted request) is not a failure.
 */
describe('the billing context failing', () => {
  const start = reducer(undefined, { type: '@@init' });

  it('is remembered when the request fails', () => {
    const failed = reducer(start, {
      type: fetchSalesContext.rejected.type,
      meta: { aborted: false, arg: '2026-11-11', requestId: 'r1', requestStatus: 'rejected' },
      error: { message: '500' },
    });
    expect(failed.contextFailed).toBe(true);
    const again = reducer(failed, {
      type: fetchSalesContext.pending.type,
      meta: { arg: '2026-11-11', requestId: 'r2', requestStatus: 'pending' },
    });
    expect(again.contextFailed).toBe(false);
  });

  it('is not a failure when the page was left', () => {
    const left = reducer(start, {
      type: fetchSalesContext.rejected.type,
      meta: { aborted: true, arg: '2026-11-11', requestId: 'r1', requestStatus: 'rejected' },
      error: { message: 'Aborted' },
    });
    expect(left.contextFailed).toBe(false);
  });
});
