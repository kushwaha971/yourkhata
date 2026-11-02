// G3a — a jeweller's custom orders (design G3 pJOrder, dJOrders).
//   O1  New order through the form with an advance and a fixed rate: the API has
//       it, ₹50,000 by UPI, rate 11650.00 (--skew expects 11651.00: must fail);
//   O2  the count line says the API's open count and advance held;
//   O3  a double-tapped Save makes one order;
//   O4  Mark ready, then Delivered: it leaves the open list, the advance held falls;
//   O5  "Save and give receipt" opens the advance's receipt;
//   K   a kirana has no menu entry and its API is 404;
//   L   list and form at 390, 320 and 1280, light and dark: nothing wider than
//       the screen, no text cut.
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g3a';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
let consoleErrors = 0;
const watch = (p) => p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { consoleErrors += 1; console.log(m.text().slice(0, 160)); } });
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const signIn = async (who) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', `${who}@adcert.test`);
  await page.fill('input[type=password]', 'AdCert-Test-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
};
const { ctx, page } = await signIn('qa-jeweller');
const hdr = async (x = {}) => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', ...x });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
const name = `G3a Meena ${run}`;
const made = await ctx.request.post(`${api}/parties`, { headers: await hdr({ 'Idempotency-Key': randomUUID() }), data: { name, type: 'customer', is_customer: true } });
check('set-up: a customer', made.ok(), String(made.status()));
const fill = async (p, what, advance) => {
  await p.getByTestId('custom-order-new').click();
  const d = p.getByRole('dialog');
  await d.getByLabel('Customer').waitFor({ timeout: 15000 });
  await d.getByLabel('Customer').fill(name);
  await p.getByRole('option', { name: new RegExp(name) }).first().click();
  await d.getByLabel('What to make').fill(what);
  await d.getByLabel('Approx. weight').fill('18');
  await d.getByText('In 7 days').first().click();
  await d.getByRole('textbox', { name: 'Advance' }).fill(advance);
  return d;
};
const find = async (what) => (await get(`/sales/custom-orders?q=${encodeURIComponent(what)}`)).rows;

await page.goto(`${base}/sales/custom-orders`);
const w1 = `Mangalsutra ${run}`;
let d = await fill(page, w1, '50000');
await d.getByLabel('Paid by').click().catch(() => undefined);
await page.getByRole('option', { name: 'UPI' }).first().click().catch(() => undefined);
await d.getByRole('switch', { name: /Fix the rate now/ }).click();
await page.screenshot({ path: `${dir}/form-1280.png` });
const save = d.getByRole('button', { name: 'Save', exact: true });
await save.dblclick();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(800);
let rows = await find(w1);
check('O3: a double-tapped Save makes one order', rows.length === 1, String(rows.length));
const o = rows[0];
const want = skew ? '11651.00' : '11650.00';
check(`O1: rate fixed at ${want}, advance 50000.00`, o?.fixed_rate === want && o?.advance === '50000.00', `${o?.fixed_rate} ${o?.advance}`);
const pay = o?.advance_payment_id ? await get(`/payments/${o.advance_payment_id}`) : null;
check('O1: the advance is a UPI receipt', pay?.primary_mode === 'upi' || pay?.mode_breakup?.[0]?.mode === 'upi', JSON.stringify(pay?.mode_breakup));
const list = await get('/sales/custom-orders');
const line = (await page.getByTestId('custom-order-count').innerText()).replace(/\s+/g, ' ');
const inr = Number(list.advance_held).toLocaleString('en-IN', { minimumFractionDigits: 2 });
check('O2: the count line says the API figures', line.includes(`Open ${list.open}`) && line.includes(inr), line);
await page.getByPlaceholder('Order, customer or item').fill(w1);
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/list-1280.png` });
await page.getByRole('button', { name: 'Mark ready' }).first().click();
await page.getByRole('button', { name: 'Delivered' }).first().waitFor({ timeout: 8000 });
await page.getByRole('button', { name: 'Delivered' }).first().click();
await page.waitForTimeout(1200);
check('O4: delivered leaves the open list', (await find(w1)).length === 0);
const after = await get('/sales/custom-orders');
check('O4: the advance held falls by 50,000', Math.abs(Number(list.advance_held) - 50000 - Number(after.advance_held)) < 0.005, after.advance_held);
await page.getByPlaceholder('Order, customer or item').fill('');
const w2 = `Ring ${run}`;
d = await fill(page, w2, '1000');
await page.getByTestId('custom-order-receipt').click();
await page.waitForURL(/\/payments\//, { timeout: 10000 }).catch(() => undefined);
check('O5: Save and give receipt opens the receipt', /\/payments\/[0-9a-f-]+/.test(page.url()), page.url());

const k = await signIn('qa-owner');
check('K: a kirana has no custom orders API', (await k.ctx.request.get(`${api}/sales/custom-orders`)).status() === 404);
await k.page.goto(`${base}/sales/invoices`);
await k.page.waitForTimeout(1500);
check('K: …and no menu entry', (await k.page.getByRole('link', { name: 'Custom orders' }).count()) === 0);
await k.ctx.close();

const host = new URL(base).hostname;
const state = await ctx.storageState();
for (const [width, theme] of [[390, 'light'], [320, 'dark'], [1280, 'dark']]) {
  const c = await browser.newContext({ storageState: state, viewport: { width, height: 800 } });
  await c.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }]);
  const p = await c.newPage();
  watch(p);
  await p.goto(`${base}/sales/custom-orders`);
  await p.getByTestId('custom-orders').waitFor({ timeout: 15000 });
  await p.waitForTimeout(1200);
  const measure = () => p.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - innerWidth, cut: [] };
    for (const el of document.querySelectorAll('main *, [role=dialog] *')) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const s = getComputedStyle(el);
      if (el.getBoundingClientRect().width <= 1 || s.display === 'none') continue;
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible') out.cut.push(el.textContent.trim().slice(0, 30));
    }
    return out;
  });
  let m = await measure();
  check(`L ${width} ${theme}: list fits, no text cut`, m.overflow <= 0 && !m.cut.length, `${m.overflow}px ${m.cut.slice(0, 3).join(' | ')}`);
  await p.screenshot({ path: `${dir}/list-${width}-${theme}.png` });
  await p.getByTestId('custom-order-new').click();
  await p.getByRole('dialog').getByLabel('What to make').waitFor({ timeout: 10000 });
  m = await measure();
  check(`L ${width} ${theme}: form fits, no text cut`, m.overflow <= 0 && !m.cut.length, `${m.overflow}px ${m.cut.slice(0, 3).join(' | ')}`);
  await p.screenshot({ path: `${dir}/form-${width}-${theme}.png` });
  await c.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${consoleErrors} console errors${skew ? ' (SKEWED)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || consoleErrors ? 1 : 0;
