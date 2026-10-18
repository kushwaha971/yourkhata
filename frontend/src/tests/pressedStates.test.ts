/**
 * @jest-environment node
 *
 * Revamp F2 (05 §3 "Finger down") — every control answers a press with a look
 * of its own. The 17 Oct 2026 baseline (H6) found a bottom tab and a desktop
 * table row that did not change at all, four button variants whose press was
 * their hover, and a primary button whose press colour WAS its hover colour
 * (`--cta-press` and `--cta-hover` both `--accent-600`), so under a mouse a
 * press looked like nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mlButtonClasses } from 'src/design-system/primitives';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const token = (css: string, name: string): string | undefined =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

describe('pressed states', () => {
  it.each(['primary', 'secondary', 'outlineNeutral', 'ghost', 'link', 'destructive'] as const)(
    'a %s button squeezes on press, and not under reduced motion',
    (variant) => {
      const classes = mlButtonClasses(variant);
      expect(classes).toContain('active:scale-[0.98]');
      expect(classes).toContain('motion-reduce:active:scale-100');
    }
  );

  it.each(['secondary', 'outlineNeutral', 'ghost'] as const)(
    'a %s button has a press colour that is not its hover colour',
    (variant) => {
      expect(mlButtonClasses(variant)).toContain('active:bg-surface-active');
    }
  );

  it.each(['src/styles/tokens/light.css', 'src/styles/tokens/dark.css'])(
    '%s gives the main action a press colour of its own',
    (file) => {
      const css = read(file);
      expect(token(css, 'cta-press')).toBeDefined();
      expect(token(css, 'cta-press')).not.toBe(token(css, 'cta-hover'));
    }
  );

  it('a bottom tab and a desktop table row change when pressed', () => {
    expect(read('src/design-system/UbBottomNav/UbBottomNav.tsx')).toContain('group-active:bg-surface-active');
    expect(read('src/design-system/UbDataGrid/UbDataGridTable.tsx')).toContain(
      '[&:has(button:active)]:bg-surface-active'
    );
  });
});
