// G3c — receiving from a karigar makes tags (design D6 jewel purLines).
//   T1 gold back shows as "to tag"; T2 Make tag through the form: the tag is in
//   stock, cost = metal + labour (--skew expects a rupee more: must fail);
//   T3 the same tag no. is refused under its box; T4 the lot counts the piece and
//   offers Print labels for its item; T5 No more tags clears it; L 390, 320.
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g3c';
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
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
// Tidy earlier runs' lots, so this run's row and the item list are the ones read.
for (const old of (await get('/sales/karigars')).to_tag) await post(`/sales/karigar-lots/${old.id}/tags-done`, {});
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const itemName = `AA G3c chain ${run}`;
const item = await post('/items', { name: itemName, unit_id: nos.id, selling_price: '0', tracking: 'serial' });
const name = `Imran ${run}`;
const k = await post('/sales/karigars', { name, wastage_limit_pct: '1.5' });
const lot = await post(`/sales/karigars/${k.id}/issue`, { weight_g: '37.4', purity: 'gold_22k', client_key: randomUUID() });
await post(`/sales/karigar-lots/${lot.id}/receive`, { received_g: '36.88' });
await page.goto(`${base}/sales/custom-orders`);
const row = page.getByTestId('karigar-to-tag').filter({ hasText: name });
await row.waitFor({ timeout: 15000 });
check('T1: gold back shows as to tag', (await row.innerText()).includes('36.880 g'));
const fillTag = async (no) => {
  await row.getByTestId('karigar-make-tag').click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Tag no.').waitFor({ timeout: 10000 });
  await d.getByLabel('Item', { exact: true }).click();
  await page.getByRole('option', { name: itemName }).click();
  await d.getByLabel('Tag no.').fill(no);
  await d.getByLabel('Gross').fill('12');
  await d.getByLabel('Labour').fill('350');
  return d;
};
const tag = `KG-${run}`;
let d = await fillTag(tag);
await page.screenshot({ path: `${dir}/dialog-1280.png` });
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
const found = await (await ctx.request.get(`${api}/jewel-tags/lookup?tag=${tag}`));
check('T2: the tag is in stock', found.ok(), String(found.status()));
const full = await get(`/items/${item.id}`);
const want = skew ? 144001 : 144000;
check(`T2: the piece cost ₹${want} (metal + labour)`, Math.abs(Number(full.stock?.[0]?.avg_cost ?? full.avg_cost) - want) < 0.005, String(full.stock?.[0]?.avg_cost ?? full.avg_cost));
check('T4: the lot counts the piece', (await row.innerText()).includes('12.000 g') && (await row.innerText()).includes('Pieces 1'), await row.innerText());
check('T4: Print labels goes to its item', (await row.getByTestId('karigar-labels').getAttribute('href'))?.includes(item.id));
d = await fillTag(tag);
await page.getByTestId('karigar-save').click();
await page.getByText('This tag no. is already used.').first().waitFor({ timeout: 8000 }).catch(() => undefined);
check('T3: the same tag no. is refused in the dialog', (await page.getByText('This tag no. is already used.').count()) >= 1);
await page.keyboard.press('Escape');
await d.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
const state = await ctx.storageState();
const host = new URL(base).hostname;
for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
  const c = await browser.newContext({ storageState: state, viewport: { width, height: 800 } });
  await c.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }]);
  const p = await c.newPage();
  watch(p);
  await p.goto(`${base}/sales/custom-orders`);
  const r = p.getByTestId('karigar-to-tag').filter({ hasText: name });
  await r.waitFor({ timeout: 15000 });
  await r.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${dir}/row-${width}-${theme}.png` });
  await r.getByTestId('karigar-make-tag').click();
  await p.getByRole('dialog').getByLabel('Tag no.').waitFor({ timeout: 10000 });
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - innerWidth, cut: [] };
    for (const el of document.querySelectorAll('[role=dialog] *')) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const s = getComputedStyle(el);
      if (el.getBoundingClientRect().width <= 1 || s.display === 'none') continue;
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible') out.cut.push(el.textContent.trim().slice(0, 30));
    }
    return out;
  });
  const makingW = await p.evaluate(() => document.getElementById('tag.makingValue')?.getBoundingClientRect().width ?? 0);
  check(`L ${width} ${theme}: the Making box is wide enough to type in`, makingW >= 90, `${Math.round(makingW)}px`);
  check(`L ${width} ${theme}: dialog fits, no text cut`, m.overflow <= 0 && !m.cut.length, `${m.overflow}px ${m.cut.slice(0, 3).join(' | ')}`);
  await p.screenshot({ path: `${dir}/dialog-${width}-${theme}.png` });
  await c.close();
}
await row.getByRole('button', { name: 'No more tags' }).click();
await page.waitForTimeout(1000);
check('T5: No more tags clears the lot', !(await get('/sales/karigars')).to_tag.some((x) => x.id === lot.id));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${errs} console errors${skew ? ' (SKEWED)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || errs ? 1 : 0;
