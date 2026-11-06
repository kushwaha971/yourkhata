// G3b — karigars (design G3 dJOrders): add one, give gold through the form, read
// "Gold with karigars" and the order's "With …" from the API, take it back, and
// read the wastage against the limit.
//   K1 add karigar; I1 issue 37.400 g for an order; R1 refused heavier than given;
//   R2 36.880 g back = 1.4% within 1.5% (--skew expects 1.5: must fail); R3 over
//   the limit is shown, not refused; L list and dialogs at 390, 320, 1280.
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g3b';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
let errs = 0;
const watch = (p) => p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) { errs += 1; console.log(m.text().slice(0, 160)); } });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
watch(page);
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-jeweller@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
const hdr = async (x = {}) => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', ...x });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
const post = async (p, data) => (await (await ctx.request.post(`${api}${p}`, { headers: await hdr({ 'Idempotency-Key': randomUUID() }), data })).json()).data;
// Tidy earlier runs' lots so the panel's fold is open and this run's rows are read.
for (const old of (await get('/sales/karigars')).open_lots) await post(`/sales/karigar-lots/${old.id}/receive`, { received_g: '0' });
const party = await post('/parties', { name: `G3b Asha ${run}`, type: 'customer', is_customer: true });
const what = `Earrings ${run}`;
const order = await post('/sales/custom-orders', { client_key: randomUUID(), party_id: party.id, what, purity: 'gold_22k', deliver_on: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) });
const name = `Raju ${run}`;
const me = async () => (await get('/sales/karigars')).rows.find((r) => r.name === name);

await page.goto(`${base}/sales/custom-orders`);
await page.getByTestId('karigar-add').click();
let d = page.getByRole('dialog');
await d.getByLabel('Name').fill(name);
await d.getByLabel('Wastage allowed').fill('1.5');
await page.screenshot({ path: `${dir}/add-1280.png` });
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(800);
const k = await me();
check('K1: the karigar is saved with the limit', k?.wastage_limit_pct === '1.50', k?.wastage_limit_pct);

const before = Number((await get('/sales/karigars')).gold_with_karigars);
await page.getByTestId('karigar-issue').click();
d = page.getByRole('dialog');
await d.getByLabel('Weight').waitFor({ timeout: 10000 });
await d.getByLabel('Karigar').click();
await page.getByRole('option', { name }).click();
await d.getByLabel('Weight').fill('37.400');
await d.getByLabel('For order').click();
await page.getByRole('option', { name: new RegExp(order.number) }).click();
await page.getByTestId('karigar-save').dblclick();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
const list = await get('/sales/karigars');
check('I1: a double-tapped Issue is one lot of 37.400 g', (await me())?.issued_g === '37.400', (await me())?.issued_g);
check('I1: Gold with karigars rises by it', Math.abs(Number(list.gold_with_karigars) - before - 37.4) < 0.0005, list.gold_with_karigars);
const line = (await page.getByTestId('custom-order-count').innerText()).replace(/\s+/g, ' ');
check('I1: the count line says the API figure', line.includes(`Gold with karigars ${list.gold_with_karigars} g`), line);
const row = (await get(`/sales/custom-orders?q=${encodeURIComponent(what)}`)).rows[0];
check('I1: the order says who has its gold', row?.with_karigar?.name === name && row.with_karigar.issued_g === '37.400');
check('I1: …on screen', (await page.getByText(`With ${name} · 37.4 g issued`).count()) >= 1);
await page.screenshot({ path: `${dir}/list-1280.png`, fullPage: true });

const lotRow = page.getByTestId('karigar-lot').filter({ hasText: name });
await lotRow.getByRole('button', { name: 'Receive back' }).click();
d = page.getByRole('dialog');
await d.getByLabel('Weight received').fill('40');
await page.getByTestId('karigar-save').click();
await page.getByText('More than the 37.400 g given').first().waitFor({ timeout: 8000 }).catch(() => undefined);
check('R1: heavier than given is said in the dialog', (await page.getByText('More than the 37.400 g given').count()) >= 1);
await d.getByLabel('Weight received').fill('36.880');
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
const back = await me();
const want = skew ? '1.5' : '1.4';
check(`R2: wastage ${want}%`, back?.wastage_pct === want, back?.wastage_pct);
check('R2: within the limit, on screen', (await page.getByTestId('karigars').locator('tr, [data-testid=karigar-row]').filter({ hasText: name }).getByText('1.4% · within 1.5%').count()) === 1);
check('R2: nothing left with the karigar', back?.with_g === '0.000', back?.with_g);

const lot = await post(`/sales/karigars/${k.id}/issue`, { weight_g: '10', purity: 'gold_22k', client_key: randomUUID() });
await page.reload();
await page.getByTestId('karigar-lot').filter({ hasText: name }).getByRole('button', { name: 'Receive back' }).click();
d = page.getByRole('dialog');
await d.getByLabel('Weight received').fill('1');
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
check('R3: over the limit is saved and said', (await me())?.over_limit === true && (await page.getByTestId('karigars').locator('tr, [data-testid=karigar-row]').filter({ hasText: name }).getByText(/over 1\.5%/).count()) === 1, lot.id);

const host = new URL(base).hostname;
const state = await ctx.storageState();
await post(`/sales/karigars/${k.id}/issue`, { weight_g: '18.2', purity: 'gold_22k', order_id: order.id, client_key: randomUUID() });
for (const [width, theme, locale] of [[390, 'light', 'en'], [320, 'dark', 'en'], [320, 'light', 'hi'], [1280, 'dark', 'hi']]) {
  const c = await browser.newContext({ storageState: state, viewport: { width, height: 800 } });
  await c.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }, { name: 'ub_locale', value: locale, domain: host, path: '/' }]);
  const p = await c.newPage();
  watch(p);
  await p.goto(`${base}/sales/custom-orders`);
  await p.getByTestId('karigars').waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
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
  check(`L ${width} ${theme} ${locale}: page fits, no text cut`, m.overflow <= 0 && !m.cut.length, `${m.overflow}px ${m.cut.slice(0, 3).join(' | ')}`);
  await p.getByTestId('karigars').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${dir}/panel-${width}-${theme}-${locale}.png` });
  await p.getByTestId('karigar-issue').click();
  await p.getByRole('dialog').waitFor({ timeout: 10000 });
  await p.waitForTimeout(500);
  m = await measure();
  check(`L ${width} ${theme} ${locale}: issue dialog fits, no text cut`, m.overflow <= 0 && !m.cut.length, `${m.overflow}px ${m.cut.slice(0, 3).join(' | ')}`);
  await p.screenshot({ path: `${dir}/issue-${width}-${theme}-${locale}.png` });
  await c.close();
}
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${errs} console errors${skew ? ' (SKEWED)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || errs ? 1 : 0;
