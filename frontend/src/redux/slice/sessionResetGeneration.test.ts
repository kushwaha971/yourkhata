import { resetAllFeatureState } from 'src/redux/actions';
import { selectResetGeneration } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';

it('counts every wipe of the features, so the signed-in page can remount after one (A8 P5)', () => {
  /**
   * The defect it prevents: opening a Shop page from the Library app switched
   * the app, which wiped every feature's state — including the rows the new
   * page had just asked for — and nothing asked again, so Suppliers sat on its
   * loading bars (8 of 8 trips, e2e/a8-first-tap.mjs P5).
   */
  const before = selectResetGeneration(store.getState());
  store.dispatch(resetAllFeatureState());
  expect(selectResetGeneration(store.getState())).toBe(before + 1);
});
