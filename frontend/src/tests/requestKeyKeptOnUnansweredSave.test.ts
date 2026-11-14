/**
 * @jest-environment node
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * L-R1 (docs/revamp/07-screens/13) — no write rotates its idempotency key
 * unconditionally straight after the request.
 *
 * Lending's Collect, Collect-from-borrower and New loan, and Library's manual
 * charge, all did `await dispatch(...)` and then `rotate()` whatever came back.
 * After a timeout the merchant's "Try again" went out under a fresh key, so a
 * first request that had in fact landed was recorded a second time. A rotate
 * must sit behind success or `mayHaveBeenSaved()`; this check finds the bare
 * pattern wherever it reappears.
 */
const ROOT = join(process.cwd(), 'src');

const sources = (dir: string): readonly string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });

const files = sources(ROOT).filter((file) => /useIdempotencyKey/.test(readFileSync(file, 'utf8')));

const bareRotateAfterRequest = (source: string): number[] => {
  const lines = source.split('\n');
  const hits: number[] = [];
  lines.forEach((line, index) => {
    if (!/^\s*(\w+\.)?rotate\(\);/.test(line)) return;
    // Walk back over the request statement to the line that opened it.
    for (let back = index - 1; back >= Math.max(0, index - 12); back -= 1) {
      const previous = lines[back] ?? '';
      if (/^\s*\/\//.test(previous)) continue;
      if (/await (dispatch|onSubmit)\(/.test(previous)) {
        // `.unwrap()` throws on failure, so a rotate after it runs on success only.
        const request = lines.slice(back, index).join('\n');
        if (!/\.unwrap\(\)/.test(request)) hits.push(index + 1);
        break;
      }
      // Stop at the statement before the request, or at the block it opens.
      if (/;\s*$/.test(previous) && !/^\s*[)}\]]/.test(previous)) break;
      if (/(\b(try|else|if)\b.*|=>\s*)\{\s*$/.test(previous)) break;
    }
  });
  return hits;
};

it('finds the files that hold an idempotency key', () => {
  expect(files.length).toBeGreaterThan(10);
});

it.each(files.map((file) => [relative(ROOT, file), file]))(
  '%s does not rotate its key after a save that may have landed',
  (_name, file) => {
    expect(bareRotateAfterRequest(readFileSync(file, 'utf8'))).toEqual([]);
  }
);
