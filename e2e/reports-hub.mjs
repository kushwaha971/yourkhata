/**
 * Revamp 09 §10.1 — the Reports hub on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/reports-hub.mjs [--shots=/tmp/e2e-shots/reports-hub]
 *
 *  * at 390, 320, 1024 and 1280 in English and Hindi: no sideways scroll, no
 *    text cut, every row is one target of at least 44 px, one column below
 *    1024 and two from 1024;
 *  * the groups are Money · People · Stock · Sales and tax, each row titled by
 *    its question with the report's name under it;
 *  * every row opens a screen that is not a "not found" page.
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

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const hub = document.querySelector('[data-testid="reports-hub"]');
  const rows = [...hub.querySelectorAll('a')].map((a) => {
    const card = a.closest('[class*="relative"]').getBoundingClientRect();
    return { h: Math.round(card.height), left: Math.round(card.left) };
  });
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    rows,
    columns: new Set(rows.map((r) => r.left)).size,
    groups: [...hub.querySelectorAll('section')].map((s) => s.getAttribute('aria-label')),
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const GROUPS = { en: ['Money', 'People', 'Stock', 'Sales and tax'], hi: ['पैसा', 'लोग', 'स्टॉक', 'बिक्री और टैक्स'] };
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await page.goto(`${base}/reports`, { waitUntil: 'networkidle' });
      await page.getByTestId('reports-hub').waitFor();
      const tag = `${width} ${locale}`;
      const m = await page.evaluate(measure);
      check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: every row is a target of 44 px or more`, m.rows.length > 0 && m.rows.every((r) => r.h >= 44), JSON.stringify(m.rows.map((r) => r.h)));
      check(`${tag}: ${width >= 1024 ? 'two columns' : 'one column'}`, m.columns === (width >= 1024 ? 2 : 1), String(m.columns));
      check(`${tag}: the four groups in order`, JSON.stringify(m.groups) === JSON.stringify(GROUPS[locale]), JSON.stringify(m.groups));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/hub-${width}-${locale}.png`, fullPage: true });
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/reports`, { waitUntil: 'networkidle' });
  const first = page.getByTestId('reports-hub').getByRole('link').first();
  check('a row reads its question and the report name', (await first.getAttribute('aria-label')) === 'What happened today? · Day book', await first.getAttribute('aria-label'));
  const hrefs = await page.getByTestId('reports-hub').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const href of hrefs) {
    await page.goto(`${base}${href}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const text = await page.locator('main').innerText();
    check(`${href} opens a screen`, !/not found|404/i.test(text) && text.trim().length > 20, text.slice(0, 40).replace(/\n/g, ' '));
  }
  // Tap the CARD, not the words: the whole card is the target.
  await page.goto(`${base}/reports`, { waitUntil: 'networkidle' });
  const card = await page.getByTestId('reports-hub').locator('a').nth(1).evaluate((a) => {
    const r = a.closest('[class*="relative"]').getBoundingClientRect();
    return { x: r.right - 30, y: r.top + r.height / 2 };
  });
  await page.mouse.click(card.x, card.y);
  await page.waitForURL((u) => u.pathname !== '/reports', { timeout: 10000 }).catch(() => undefined);
  check('a tap at the card edge opens the report', new URL(page.url()).pathname !== '/reports', page.url());
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
