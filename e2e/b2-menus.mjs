// B2 — menus and words per business, on the live stack, read back.
//
// One local test owner per kind (e2e/fixtures/b2_kind_owners.py). For each:
// read the session (words, features), then LOOK at the desktop sidebar and the
// phone More page + tab bar, and assert what the design and E2 #6 say:
//   - Medical says Distributors; a wholesaler Retailers and Companies (EN + HI)
//   - Sales orders / Delivery challans / Purchase orders only for hardware and
//     wholesale here (not kirana, medical, jewellery)
//   - "<kind> · Shop" under the business name
//   - no overflow, nothing cut
//
//   node e2e/b2-menus.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/b2';
mkdirSync(dir, { recursive: true });
const PASSWORD = 'B2-Kinds-Test-2026!';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const OWNERS = [
  { id: 'hardware', email: 'b2-hardware@yourkhata.test', kind: 'Hardware', suppliers: 'Suppliers', customers: 'Customers', orders: true },
  { id: 'medical', email: 'b2-medical@yourkhata.test', kind: 'Medical', suppliers: 'Distributors', customers: 'Customers', orders: false, hiSuppliers: 'वितरक' },
  { id: 'kirana', email: 'b2-kirana@yourkhata.test', kind: 'Kirana', suppliers: 'Suppliers', customers: 'Customers', orders: false },
  { id: 'wholesale', email: 'b2-kirana-wholesale@yourkhata.test', kind: 'Kirana', suppliers: 'Companies', customers: 'Retailers', orders: true },
  { id: 'jewellery', email: 'b2-jewellery@yourkhata.test', kind: 'Jewellery', suppliers: 'Suppliers', customers: 'Customers', orders: false },
];
const ORDER_ROWS = ['Sales orders', 'Delivery challans', 'Purchase orders'];

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
for (const o of OWNERS) {
  const want = skew
    ? { ...o, suppliers: 'XX', customers: 'XX', orders: !o.orders, kind: 'XX' }
    : o;
  for (const locale of ['en', 'hi']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{ name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', o.email);
    await page.fill('input[type=password]', PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    const me = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
    const nav = await page.evaluate(() => (document.querySelector('nav[aria-label]')?.innerText ?? ''));
    const tag = `${o.id}-${locale}`;
    if (locale === 'en') {
      check(`${tag}: session features ${o.orders ? 'has' : 'lacks'} orders`, (me.active_tenant.features ?? []).includes('orders') === want.orders, JSON.stringify(me.active_tenant.features));
      check(`${tag}: sidebar says ${want.suppliers}`, nav.includes(want.suppliers), '');
      check(`${tag}: sidebar says ${want.customers}`, nav.includes(want.customers), '');
      check(`${tag}: orders rows ${want.orders ? 'shown' : 'hidden'}`, ORDER_ROWS.every((r) => nav.includes(r) === want.orders), ORDER_ROWS.filter((r) => nav.includes(r)).join(','));
      check(`${tag}: kind under the name ("${want.kind} · …")`, nav.includes(`${want.kind} · `), nav.split('\n').slice(0, 3).join(' / '));
    } else if (o.hiSuppliers) {
      check(`${tag}: Hindi sidebar says ${o.hiSuppliers}`, nav.includes(skew ? 'XX' : o.hiSuppliers));
    }
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cut: [...document.querySelectorAll('nav a span, nav button span')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent.trim()),
    }));
    if (locale === 'en' && o.id === 'medical') {
      await page.goto(`${base}/suppliers`, { waitUntil: 'networkidle' });
      const main = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
      check(`${tag}: Suppliers page is titled ${want.suppliers}`, main.includes(skew ? 'XX' : 'Distributors'), main.slice(0, 80).replace(/\n/g, ' / '));
      check(`${tag}: its button says Add distributor`, main.includes(skew ? 'XX' : 'Add distributor'));
      await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    }
    check(`${tag}: desktop no overflow, nothing cut`, m.overflow <= 0 && m.cut.length === 0, JSON.stringify(m));
    await page.screenshot({ path: `${dir}/${tag}-1280.png` });
    // Phone: tab bar and More.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/more`, { waitUntil: 'networkidle' });
    const phone = await page.evaluate(() => ({ text: document.body.innerText, overflow: document.documentElement.scrollWidth - window.innerWidth }));
    if (locale === 'en') {
      check(`${tag}: phone shows ${want.suppliers}`, phone.text.includes(want.suppliers));
      check(`${tag}: phone orders rows ${want.orders ? 'shown' : 'hidden'}`, ORDER_ROWS.every((r) => phone.text.includes(r) === want.orders));
    }
    check(`${tag}: phone no overflow`, phone.overflow <= 0, String(phone.overflow));
    await page.screenshot({ path: `${dir}/${tag}-390-more.png`, fullPage: true });
    await ctx.close();
  }
}
// S9 / R-DEC-65: switching business swaps the words and rows. One person who
// owns two businesses of different kinds (the fixture adds the membership).
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'b2-medical@yourkhata.test');
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  const me = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
  const other = (me.tenants ?? []).find((t) => t.id !== me.active_tenant_id);
  if (!other) {
    check('S9 switching business: the owner has a second business', false, 'run the fixture');
  } else {
    const before = me.active_tenant.words?.en?.['nav.suppliers'];
    const sw = await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { data: { tenant_id: other.id } });
    const after = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
    check('S9 switch answered', sw.ok(), String(sw.status()));
    check('S9 words swap with the business (Distributors → Suppliers)', before === (skew ? 'XX' : 'Distributors') && after.active_tenant.words?.en?.['nav.suppliers'] === undefined, `${before} → ${after.active_tenant.words?.en?.['nav.suppliers']}`);
    check('S9 features swap (no orders → orders)', (after.active_tenant.features ?? []).includes('orders') !== skew, JSON.stringify(after.active_tenant.features));
    // and back, so the next run starts from the medical store
    await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { data: { tenant_id: me.active_tenant_id } });
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: the read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
