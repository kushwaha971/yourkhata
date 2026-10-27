import { COMPACT_OVERLAY_CLASSNAME } from './CompactOverlays';

/** Prevents a second "compact" spacing scale returning: it padded every panel child 16 px, the grab handle too (design §A5). */
it('adds no spacing of its own; the one standard lives in the dialog primitives', () => {
  expect(COMPACT_OVERLAY_CLASSNAME).toBe('');
});
