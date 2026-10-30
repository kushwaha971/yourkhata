// B3 — Settings › Shop features, on the live stack, read back.
//
// As the kirana test owner (e2e/fixtures/b2_kind_owners.py): open the page,
// turn "I also sell wholesale" on, and prove from the SERVER and the MENU that
// the business now says Retailers / Companies and has Sales orders; turn it
// off and prove the kirana words come back (orders stay on: the switch left
// them as they were). Then turn orders off and back on. Restores the start.
// Screens at 1280 and 390, EN and HI.
//
//   node e2e/b3-features.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/b3';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'b2-kirana@yourkhata.test');
await page.fill('input[type=password]', 'B2-Kinds-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
const me = async () => (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
const csrf = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' });
const open = (await me()).active_tenant;
check('the open business is the kirana test shop before any write', open?.name === 'Shree Ganesh Kirana', open?.name);
if (open?.name !== 'Shree Ganesh Kirana') process.exit(1);
const sidebar = () => page.evaluate(() => document.querySelector('nav[aria-label]')?.innerText ?? '');
const sw = (name) => page.getByRole('switch', { name });
const settle = async () => {
  await sleep(1500);
  await page.waitForLoadState('networkidle');
};

try {
  await page.goto(`${base}/settings/shop-features`, { waitUntil: 'networkidle' });
  check('page shows the kind', (await page.locator('main').innerText()).includes('Kirana'));
  check('only built switches (2)', (await page.getByRole('switch').count()) === 2, String(await page.getByRole('switch').count()));
  await page.screenshot({ path: `${dir}/1280-en-off.png` });

  // wholesale ON
  await sw(/I also sell wholesale/).click();
  await settle();
  let m = await me();
  check('server: wholesale on', (m.active_tenant.features ?? []).includes('wholesale') !== skew, JSON.stringify(m.active_tenant.features));
  check('server: orders on with it', (m.active_tenant.features ?? []).includes('orders') !== skew);
  check('server: words Retailers / Companies', m.active_tenant.words?.en?.['nav.parties'] === (skew ? 'XX' : 'Retailers') && m.active_tenant.words?.en?.['nav.suppliers'] === 'Companies', JSON.stringify(m.active_tenant.words?.en));
  let nav = await sidebar();
  check('menu follows without a reload: Retailers and Sales orders', nav.includes(skew ? 'XX' : 'Retailers') && nav.includes('Sales orders'));
  await page.screenshot({ path: `${dir}/1280-en-wholesale.png` });

  // wholesale OFF
  await sw(/I also sell wholesale/).click();
  await settle();
  m = await me();
  check('server: kirana words back', m.active_tenant.words?.en?.['nav.parties'] === (skew ? 'XX' : undefined), JSON.stringify(m.active_tenant.words?.en));
  check('server: orders left as they were (on)', (m.active_tenant.features ?? []).includes('orders') !== skew);

  // orders OFF then ON
  await sw(/Sales orders and challans/).click();
  await settle();
  nav = await sidebar();
  check('orders off: the menu loses Sales orders', !nav.includes('Sales orders') !== skew);
  await sw(/Sales orders and challans/).click();
  await settle();
  nav = await sidebar();
  check('orders on again: Sales orders back', nav.includes('Sales orders') !== skew);

  // Look: phone + Hindi
  for (const [w, h, loc] of [[390, 844, 'en'], [320, 700, 'hi'], [1280, 900, 'hi']]) {
    await ctx.addCookies([{ name: 'ub_locale', value: loc, domain: new URL(base).hostname, path: '/' }]);
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/settings/shop-features`, { waitUntil: 'networkidle' });
    const look = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cut: [...document.querySelectorAll('main [role=switch], main label, main h1, main h2, main p')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length,
      small: [...document.querySelectorAll('main [role=switch]')].map((e) => Math.round(e.getBoundingClientRect().height)).filter((x) => x < 24),
    }));
    check(`@${w} ${loc}: no overflow, nothing cut`, look.overflow <= 0 && look.cut === 0, JSON.stringify(look));
    await page.screenshot({ path: `${dir}/${w}-${loc}.png`, fullPage: true });
  }
} finally {
  // Restore the kirana test shop: wholesale off, orders off (its kind's start).
  await ctx.request.put(`${base}/api/v1/tenants/current/settings`, {
    data: { values: { 'shop.wholesale': { value: false }, 'shop.features.orders': { value: false } } },
    headers: await csrf(),
  });
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
