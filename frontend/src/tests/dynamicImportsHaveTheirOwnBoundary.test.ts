/**
 * @jest-environment node
 *
 * The first tap on Home's "Pay supplier" blanked the whole screen into its
 * loading skeleton before the drawer opened (owner, 25 Oct 2026: "the 1st it
 * reload entier page"). Nothing reloaded: the drawer is a `dynamic()` chunk,
 * and `next/dynamic` wraps a component in its own Suspense boundary ONLY when
 * it is given `ssr: false` or a `loading` view. Without either, the chunk's
 * first download suspends up to the nearest boundary there is — the route's
 * `loading.tsx` — and React hides the page behind it until the chunk lands.
 * The second tap was fine because the chunk was cached, which is why it looked
 * like an occasional reload rather than a rule.
 *
 * Thirty-two calls had neither. This test is the rule: every `dynamic()` in
 * the app says how it waits. The public front page is the one exception — it
 * is server-rendered on purpose and never mounts its sections after a tap.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const EXEMPT = new Set(['src/modules/DigiKhaato/features/landing/components/LandingPage.tsx']);

const sources = (dir: string): readonly string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : sources(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

/** Each `dynamic(...)` call's full text, found by balancing parentheses. */
const dynamicCalls = (text: string): readonly string[] => {
  const calls: string[] = [];
  for (const match of text.matchAll(/\bdynamic\(/g)) {
    let index = (match.index ?? 0) + match[0].length;
    let depth = 1;
    while (depth > 0 && index < text.length) {
      const char = text[index];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      index += 1;
    }
    calls.push(text.slice(match.index, index));
  }
  return calls;
};

describe('lazily loaded components', () => {
  const files = [...sources(join(ROOT, 'src')), ...sources(join(ROOT, 'app'))]
    .map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, 'utf8') }))
    .filter(({ text }) => text.includes("from 'next/dynamic'"));

  it('finds them', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('give every dynamic() its own boundary, so a first tap never blanks the page', () => {
    const unbounded = files
      .filter(({ file }) => !EXEMPT.has(file))
      .flatMap(({ file, text }) =>
        dynamicCalls(text)
          .filter((call) => !/ssr:\s*false/.test(call) && !/\bloading\s*:/.test(call))
          .map((call) => `${file}: ${call.slice(0, 80)}`)
      );
    expect(unbounded).toEqual([]);
  });
});
