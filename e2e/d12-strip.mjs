// D12 — the business's own figures on Home, on the live stack.
//
//   The scale business keeps batches (d4), IMEIs (d3) and sizes (d2), so
//   /stock/home-strip sends three tiles. Home draws each one with the
//   server's own count (read back; --skew proves the read-back can fail),
//   the expiring tile links to Expiry, and the strip fits a 390 / 320 phone.
//
//   node e2e/d12-strip.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/d12-strip';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
};

for (const [w, h] of [[1280, 900], [390, 844], [320, 700]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 768 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await signIn(ctx);
  const tiles = (await (await ctx.request.get(`${base}/api/v1/stock/home-strip`)).json()).data ?? [];
  if (w === 1280) check('API: three tiles for a business with batches, IMEIs and sizes', tiles.length === 3, JSON.stringify(tiles));
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  await sleep(1500);
  const strip = page.getByTestId('home-strip');
  check(`${w}: the strip is on Home`, await strip.isVisible().catch(() => false));
  for (const tile of tiles) {
    const text = (await page.getByTestId(`home-strip-${tile.key}`).innerText().catch(() => '')).replace(/\n/g, ' / ');
    const want = skew ? tile.count + 1 : tile.count;
    check(`${w}: ${tile.key} shows the server's ${want}`, new RegExp(`(^|\\D)${want}(\\D|$)`).test(text), text);
  }
  const clipped = await strip.evaluate((el) =>
    [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.scrollWidth > n.clientWidth + 1).length
  ).catch(() => -1);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${w}: fits (no overflow, no clipped text)`, over <= 0 && clipped === 0, `${over} · ${clipped}`);
  await strip.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${dir}/${w}.png` });
  if (w === 1280) {
    await page.getByTestId('home-strip-expiring').click();
    await page.waitForURL(/\/stock\/expiry/, { timeout: 10000 }).catch(() => {});
    check('the expiring tile opens Expiry', page.url().includes('/stock/expiry'), page.url());
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
