// B2 — edge cases for menus and words per business (edge-case catalogue).
//   E17  an owner-typed long word ("Wholesale buyer", 20 chars) for the people:
//        sidebar, tab bar and list title show it whole — nothing cut, no overflow
//   E3   a hidden row's address typed by hand (/sales/orders on a medical
//        store): the menu still has no row for it and the page does not 500
//   E16  the owner's word survives a reload (read back from the session)
// Restores the medical store's labels at the end.
//
//   node e2e/b2-edges.mjs   (E2E_BASE, PW_CHROME)
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const LONG = 'Wholesale buyer';

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'b2-medical@yourkhata.test');
await page.fill('input[type=password]', 'B2-Kinds-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
// This owner has TWO businesses (medical, and hardware for S9); sign-in opens
// the last one used. Switch to the medical store and PROVE it is the open one
// before writing anything — an earlier run wrote the medical words onto the
// hardware shop because it never asked which business was open.
const csrf = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' });
const setLabels = async (customer, supplier) => {
  const r = await ctx.request.put(`${base}/api/v1/tenants/current/settings`, {
    data: { values: { 'parties.labels': { customer, supplier } } },
    headers: await csrf(),
  });
  return r.status();
};

const me0 = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
const medical = (me0.tenants ?? []).find((t) => t.name === 'Sai Medical Store');
if (me0.active_tenant_id !== medical?.id) {
  await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { data: { tenant_id: medical?.id }, headers: await csrf() });
}
const open = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data.active_tenant;
check('the open business is the medical store before any write', open?.name === 'Sai Medical Store', open?.name);
if (open?.name !== 'Sai Medical Store') {
  await browser.close();
  process.exit(1);
}
await page.reload({ waitUntil: 'networkidle' });
try {
  // E17 + E16
  const st = await setLabels(LONG, 'Distributor');
  check('E17 owner word saved', st === 200, String(st));
  await page.reload({ waitUntil: 'networkidle' });
  const me = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
  check('E16 the word is read back after a reload', me.active_tenant.words?.en?.['nav.parties'] === `${LONG}s`, me.active_tenant.words?.en?.['nav.parties']);
  for (const [w, h] of [[1280, 900], [390, 844], [320, 700]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/customers`, { waitUntil: 'networkidle' });
    const m = await page.evaluate((word) => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      shown: document.body.innerText.includes(word),
      cut: [...document.querySelectorAll('nav a span, nav button span, h1, [data-ub-tab] span')]
        .filter((e) => e.textContent.includes(word) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible')
        .map((e) => e.textContent.trim()),
    }), `${LONG}s`);
    check(`E17 @${w}: "${LONG}s" shown, nothing cut, no overflow`, m.shown && m.cut.length === 0 && m.overflow <= 0, JSON.stringify(m));
    await page.screenshot({ path: `/tmp/e2e-shots/b2/edge-long-${w}.png` });
  }
  // E3
  await page.setViewportSize({ width: 1280, height: 900 });
  const resp = await page.goto(`${base}/sales/orders`, { waitUntil: 'networkidle' });
  const nav = await page.evaluate(() => document.querySelector('nav[aria-label]')?.innerText ?? '');
  check('E3 typed address of a hidden row: no server error', (resp?.status() ?? 500) < 500, String(resp?.status()));
  check('E3 the menu still has no Sales orders row', !nav.includes('Sales orders'));
} finally {
  const back = await setLabels('Customer', 'Distributor');
  check('restored the medical store labels', back === 200, String(back));
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
