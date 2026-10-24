/**
 * BP-17 (R-DEC-26) — counting the Shop's drawer from Home, on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/cash-count.mjs [--shots=/tmp/e2e-shots/cash-count]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi: Home's cash figure
 *    carries the last count (or "Not counted yet") and Count cash, with no
 *    sideways scroll, no cut text, and a 44 px target on a phone;
 *  * the drawer shows the server's records figure; typing ₹50 less says
 *    "Short by ₹50.00" before saving;
 *  * a double tap on Save records ONE count, compared with the server's figure
 *    at the save; Home's line then says it; the records' cash figure is the
 *    same after the count as before it (a count posts nothing);
 *  * the drawer fits a 320 px phone in both languages.
 *
 * WRITES to the local QA database only: one or two cash counts, which are
 * observations and move no money. Refuses any host but localhost.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const inr = (v) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const measure = (scope) => {
  const root = document.querySelector(scope) ?? document.body;
  const cut = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  // A figure must not break across lines ("-" on one line, "₹15,72,421.24" on the next).
  const broken = [];
  for (const el of root.querySelectorAll('.ds-num')) {
    for (const node of el.childNodes) {
      if (node.nodeType !== 3) continue;
      for (const m of node.textContent.matchAll(/[-‑−]?₹[\d,.]+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) broken.push(m[0]);
      }
    }
  }
  return { overflow: document.documentElement.scrollWidth - innerWidth, cut: [...new Set(cut)], broken };
};

/** The control the finger lands on at the centre and ±21 px — the a11y sweep's rule. */
const target = (testId) => {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hits = [y - 21, y, y + 21].map((yy) => el.contains(document.elementFromPoint(x, yy)));
  return { h: Math.round(r.height), w: Math.round(r.width), hits };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const api = (path) =>
    page.evaluate(async (p) => (await fetch(`/api/v1${p}`, { cache: 'no-store' })).json(), path);
  const before = await api('/reports/cash-counts');
  const dashBefore = await api('/reports/dashboard');
  const cashBefore = dashBefore.data.tiles.shop_cash_in_hand?.amount;
  check('the QA Shop has a cash figure the owner may read', cashBefore !== undefined, cashBefore);

  const openHome = async () => {
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.getByTestId('home-cash-count').first().waitFor();
  };

  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await openHome();
      const tag = `${width} ${locale}`;
      const m = await page.evaluate(measure, 'main');
      check(`${tag}: Home has no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut on Home`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: no figure broken across lines on Home`, m.broken.length === 0, m.broken.join(' | '));
      const line = await page.getByTestId('home-cash-count-last').innerText();
      check(`${tag}: the cash figure says when it was last counted`, line.trim().length > 0, line);
      if (width < 1024) {
        const tgt = await page.evaluate(target, 'home-cash-count-open');
        check(
          `${tag}: Count cash is a 44 px target`,
          tgt && tgt.hits.every(Boolean),
          JSON.stringify(tgt)
        );
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-${width}-${locale}.png`, fullPage: true });
      if (width === 320 || width === 1280) {
        await page.getByTestId('home-cash-count-open').click();
        await page.getByTestId('cash-count-records').locator('.ds-num').waitFor();
        await page.waitForTimeout(300);
        const d = await page.evaluate(measure, '[data-testid="cash-count-drawer"]');
        check(`${tag}: the drawer has no sideways scroll`, d.overflow <= 0, `${d.overflow}px`);
        check(`${tag}: no text cut in the drawer`, d.cut.length === 0, d.cut.join(' | '));
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-${width}-${locale}.png` });
        await page.keyboard.press('Escape');
      }
    }
  }

  // Count, on a phone in English.
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await openHome();
  await page.getByTestId('home-cash-count-open').click();
  const records = page.getByTestId('cash-count-records');
  await records.locator('.ds-num').waitFor();
  const listed = await api('/reports/cash-counts');
  const expected = listed.meta.expected_now;
  check(
    "the drawer shows the server's records figure",
    (await records.innerText()).includes(`${Number(expected) < 0 ? '-' : ''}₹${inr(Math.abs(Number(expected)))}`),
    `${await records.innerText()} vs ${expected}`
  );
  // A drawer cannot hold less than nothing: when the records' figure is below
  // ₹50 (the QA book's is negative, an acceptance case), count ₹500 instead.
  const short = Number(expected) >= 50;
  const counted = (short ? Number(expected) - 50 : 500).toFixed(2);
  const words = short ? 'Short by ₹50.00' : `Extra ₹${inr(500 - Number(expected))}`;
  await page.getByLabel(/Cash you counted/).fill(counted);
  const preview = await page.getByTestId('cash-count-preview').innerText();
  check(`typing ${counted} says "${words}" before saving`, preview.includes(words), preview);
  await page.getByLabel(/Note/).fill('e2e count');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/typed-390.png` });
  await page.getByTestId('cash-count-save').dblclick();
  const result = page.getByTestId('cash-count-result');
  await result.waitFor({ timeout: 15000 });
  const after = await api('/reports/cash-counts');
  check(
    'a double tap on Save records one count',
    after.data.length === Math.min(before.data.length + 1, 30),
    `${before.data.length} → ${after.data.length}`
  );
  const newest = after.data[0];
  check(
    "the result is the server's comparison at the save",
    (await result.innerText()).includes(inr(Math.abs(Number(newest.expected_amount)))) &&
      newest.counted_amount === counted &&
      newest.note === 'e2e count',
    `${(await result.innerText()).replace(/\n/g, ' ')} · server ${newest.expected_amount}/${newest.variance}`
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/saved-390.png` });
  await page.getByTestId('cash-count-done').click();
  const dashAfter = await api('/reports/dashboard');
  check(
    "the records' cash figure is unchanged by a count",
    dashAfter.data.tiles.shop_cash_in_hand.amount === cashBefore,
    `${cashBefore} → ${dashAfter.data.tiles.shop_cash_in_hand.amount}`
  );
  await page.waitForTimeout(800);
  const line = await page.getByTestId('home-cash-count-last').innerText();
  const want = Number(newest.variance) === 0 ? 'Matches' : Number(newest.variance) < 0 ? 'Short by' : 'Extra';
  check("Home's line says the new count", /Counted at \d\d:\d\d/.test(line) && line.includes(want), line);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-after-390.png`, fullPage: true });

  // The history, and what moved since, in a fresh drawer.
  await page.getByTestId('home-cash-count-open').click();
  await page.getByTestId('cash-count-history').waitFor();
  const first = await page.getByTestId('cash-count-row').first().innerText();
  check('the drawer lists the count just saved first, with the note', first.includes('e2e count') && first.includes(`₹${inr(counted)}`), first.replace(/\n/g, ' '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/history-390.png` });
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
