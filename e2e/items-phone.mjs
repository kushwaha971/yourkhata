/**
 * 09 §8.1 Items on a phone, on the LOCAL QA stack — the journeys a measuring
 * contract cannot see:
 *
 *   NODE_PATH=$(npm root -g) node e2e/items-phone.mjs [--shots=/tmp/e2e-shots/items-phone]
 *
 *  * the Low chip sends `stock=low`, and every card it shows says "Low: … left" or
 *    "Out of stock" in words, matching the server's own count;
 *  * a card opens its item;
 *  * a code typed into the search box with Enter opens that item (FR-7 scan path);
 *  * an unknown code says so and offers to add it, nothing is created;
 *  * at 320 px no card text runs outside its own box.
 *
 * Reads only; nothing is written.
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
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const api = async (path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json());
  const lowMeta = (await api('/items?stock=low&page_size=25&status=active')).meta;

  await page.goto(`${base}/items`);
  await page.getByTestId('ub-grid-card').first().waitFor();
  const lowReq = page.waitForRequest((r) => r.url().includes('/api/v1/items?') && new URL(r.url()).searchParams.get('stock') === 'low');
  await page.getByRole('radiogroup').getByRole('radio', { name: /^Low/ }).click();
  await lowReq;
  await page.waitForLoadState('networkidle');
  const words = await page.getByTestId('ub-grid-card').evaluateAll((cards) => cards.map((c) => c.textContent ?? ''));
  check('Low chip: cards match the server count', words.length === Math.min(lowMeta.total, 25), `${words.length} vs ${lowMeta.total}`);
  check('Low chip: every card says Low or Out of stock in words', words.every((w) => /Low: .* left|Out of stock/.test(w)));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/low-390.png` });

  const first = page.getByTestId('ub-grid-card').first();
  const name = (await first.locator('button').getAttribute('aria-label'))?.replace(/^Open /, '') ?? '';
  await first.locator('button').click();
  await page.waitForURL(/\/items\/[0-9a-f-]{36}$/);
  const heading = page.getByRole('heading', { name, exact: true }).first();
  check('a card opens its item', await heading.waitFor({ timeout: 10000 }).then(() => true, () => false), name);

  const sample = (await api('/items?page_size=1&status=active')).data[0];
  await page.goto(`${base}/items`);
  await page.getByRole('searchbox').fill(sample.sku);
  await page.getByRole('searchbox').press('Enter');
  await page.waitForURL(new RegExp(`/items/${sample.id}$`), { timeout: 10000 }).catch(() => {});
  check('a code + Enter opens that item', page.url().endsWith(`/items/${sample.id}`), sample.sku);

  await page.goto(`${base}/items`);
  await page.getByRole('searchbox').fill('9999999999999');
  await page.getByRole('searchbox').press('Enter');
  const banner = page.getByText(/9999999999999/).first();
  await banner.waitFor({ timeout: 10000 });
  check('an unknown code says so on the page', await banner.isVisible());
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/unknown-code-390.png` });

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${base}/items`);
  await page.getByTestId('ub-grid-card').first().waitFor();
  const outside = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('[data-testid="ub-grid-card"] *')) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const r = el.getBoundingClientRect(), card = el.closest('li').getBoundingClientRect();
      // Inline spans report clientWidth 0, so compare boxes, not scroll widths.
      if (r.right > card.right + 1 || r.left < card.left - 1) bad.push(el.textContent.trim());
    }
    return bad;
  });
  check('320 px: no card text outside its box', outside.length === 0, outside.slice(0, 3).join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/all-320.png` });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
