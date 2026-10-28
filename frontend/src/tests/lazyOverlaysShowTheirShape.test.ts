/**
 * @jest-environment node
 *
 * A8 (design §A8): "the button shows it was pressed at once, the page stays,
 * and the drawer slides in with its own loading shape".
 *
 * `dynamicImportsHaveTheirOwnBoundary` already stops a first tap blanking the
 * page, but `ssr: false` alone draws NOTHING while the chunk downloads: on a
 * held network a first tap on "Add customer" showed no change at all for the
 * 1.3 s the chunk took (e2e/a8-first-tap.mjs, before), and a merchant at a
 * counter taps again. So every lazily loaded drawer, dialog or sheet names
 * what it shows meanwhile — `UbDrawerLoading` or `UbDialogLoading`, the real
 * frame in its own place with a loading body.
 *
 * The one exception is an overlay that is ALWAYS mounted: `next/dynamic` gives
 * a `loading` view no props, so it cannot know the overlay is closed and would
 * draw on every page load. Those are listed by name, with why.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();

/** Always mounted, so a loading view would draw while it is closed. */
const NOT_AN_OPENER = new Set([
  // Always mounted: a seat's panel stays beside the seat map and opens in place.
  'src/modules/DigiKhaato/features/library/components/SeatsPageContent.tsx:SeatPanelLazy',
  // Page content that happens to contain dialogs; not opened by a tap.
  'src/modules/DigiKhaato/features/imports/components/ImportPageContent.tsx:ImportWizard',
  'src/modules/DigiKhaato/features/parties/components/PartyDetailPageContent.tsx:PersonalUdhaarPage',
  // It lazy-loads the drawer primitive ITSELF; a drawer-shaped loading view
  // would put that primitive back in every page's shell (A1's to decide).
  'src/components/layout/MobileQuickSearch.tsx:UbDrawer',
]);

const OVERLAY = /<(UbDrawer|CompactDrawer|UbDialog|UbConfirmDialog|CompactDialog|MLDialog|UbActionSheet|UbShareSheet)\b/;

const sources = (dir: string): readonly string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : sources(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });

const resolve = (caller: string, spec: string): string | null => {
  const base = spec.startsWith('.')
    ? normalize(join(dirname(caller), spec))
    : spec.startsWith('modules/')
      ? join(ROOT, 'src', spec)
      : spec.startsWith('src/')
        ? join(ROOT, spec)
        : null;
  if (!base) return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    try {
      if (statSync(base + ext).isFile()) return base + ext;
    } catch {
      /* not this one */
    }
  }
  return null;
};

/**
 * Does this module draw an overlay, itself or through the components it
 * imports, up to `depth` hops? One hop was not enough: the Shop's "Remind"
 * reaches `UbShareSheet` through `ShopCustomerReminder` → `PartyReminderSheet`,
 * and a one-file check let it ship with no loading shape (A8, measured).
 */
const drawsOverlay = (file: string, depth: number, seen = new Set<string>()): boolean => {
  if (seen.has(file)) return false;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  if (OVERLAY.test(text)) return true;
  if (depth === 0) return false;
  return [...text.matchAll(/from '((?:\.|modules\/|src\/(?:components|modules)\/)[^']+)'/g)]
    .map((m) => resolve(file, m[1] ?? ''))
    .some((next) => next !== null && /\.tsx$/.test(next) && drawsOverlay(next, depth - 1, seen));
};

describe('lazily loaded overlays', () => {
  const calls = sources(join(ROOT, 'src')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    if (!text.includes("from 'next/dynamic'")) return [];
    return [...text.matchAll(/const (\w+) = dynamic\(/g)].map((match) => {
      let index = (match.index ?? 0) + match[0].length;
      let depth = 1;
      while (depth > 0 && index < text.length) {
        if (text[index] === '(') depth += 1;
        if (text[index] === ')') depth -= 1;
        index += 1;
      }
      const call = text.slice(match.index, index);
      const spec = /import\('([^']+)'\)/.exec(call)?.[1];
      const target = spec ? resolve(file, spec) : null;
      const overlay = target ? drawsOverlay(target, 3) : false;
      return { id: `${relative(ROOT, file)}:${match[1]}`, call, overlay };
    });
  });

  it('finds the drawers and dialogs it is about', () => {
    expect(calls.filter((c) => c.overlay).length).toBeGreaterThan(60);
  });

  it('every lazily loaded drawer, dialog or sheet shows its own shape while loading', () => {
    const silent = calls
      .filter((c) => c.overlay && !NOT_AN_OPENER.has(c.id))
      .filter((c) => !/loading:\s*\(\)\s*=>\s*<Ub(Drawer|Dialog)Loading\b/.test(c.call))
      .map((c) => c.id);
    expect(silent).toEqual([]);
  });
});
