/**
 * Edge-case catalogue, the screen side of the Purchases and Payments columns
 * (16 Nov 2026, go-live gate §11), on a fresh business at 390 and 1280:
 *
 *  E20  a double tap on a purchase line's bin removes ONE line, read back by count;
 *  E22  the bin is reachable on a phone: its target measured ≥ 44 px;
 *  E21  Record on an empty purchase sends nothing and leaves no empty bill on the server;
 *  E26  Receive money opens with nothing red, and stays so after a mode is tapped.
 *
 *   node e2e/shop-edges-ppi-ui.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { newOwner, must } from './lib/fixtures.mjs';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const words = JSON.parse(readFileSync(new URL('../frontend/locales/catalogues/purchases.en.json', import.meta.url), 'utf8'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const owner = await newOwner({ shop: 'Edge UI Kirana', prefix: 'qa-edges-ui' });
const T = owner.token;
const unit = (await must('GET', '/units', null, T)).find((u) => u.code === 'NOS');
const items = [];
for (const name of ['Edge Tea', 'Edge Salt']) items.push(await must('POST', '/items', { name, unit_id: unit.id, purchase_price: '10.00', selling_price: '15.00', tax_code: 'GST0', track_stock: true }, T));
await must('POST', '/parties', { name: 'Edge Payer', is_customer: true, state_code: '27' }, T);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const phone = width < 768;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    let billPosts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/purchases/bills') billPosts += 1; });
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', owner.email);
    await page.fill('input[type=password]', owner.password);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));

    // E21 — Record on an empty purchase.
    const before = (await must('GET', '/purchases/bills?page_size=100', null, T)).length;
    await page.goto(`${base}/purchases/bills/new`, { waitUntil: 'networkidle' });
    const record = page.getByTestId('purchase-dock').getByRole('button', { name: words['purchases.editor.record'], exact: true });
    if (await record.isEnabled().catch(() => false)) await record.click().catch(() => {});
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1200);
    const after = (await must('GET', '/purchases/bills?page_size=100', null, T)).length;
    check(`${width} E21: Record and Ctrl+S on an empty purchase leave no bill on the server`, after === before, `${before} → ${after}, ${billPosts} POSTs`);
    check(`${width} E15: and no raw server text (UUID) on screen`, (await page.getByText(/UUID/).count()) === 0);

    // E20 + E22 — two lines, double tap the first bin.
    const search = page.getByRole('combobox', { name: words['purchases.line.quickAdd.label'] });
    for (const it of items) {
      await search.fill(it.name);
      await page.getByRole('option', { selected: true }).first().waitFor();
      await page.keyboard.press('Enter');
    }
    await page.screenshot({ path: `/tmp/e2e-shots/edges-ui-${width}-lines.png` });
    const bins = page.getByRole('button', { name: /^Remove line \d+$/ });
    await bins.first().waitFor();
    // A phone shows only the open line's bin; count lines by the dock's "N items".
    const itemCount = async () => phone
      ? Number((await page.getByTestId('purchase-dock').innerText()).match(/(\d+) items?/)?.[1] ?? NaN)
      : page.getByRole('button', { name: /^Remove line \d+$/ }).count();
    const lines = await itemCount();
    const box = await bins.first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      const a = getComputedStyle(el, '::after');
      const hit = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.height, parseFloat(a.height) || 0) : r.height;
      return { h: Math.round(r.height), w: Math.round(r.width), hit: Math.round(hit) };
    });
    check(`${width} E22: the bin is a real target (${box.w}×${box.h}, hit ${box.hit})`, phone ? box.hit >= 44 : box.h >= 32, JSON.stringify(box));
    await bins.first().dblclick();
    await page.waitForTimeout(800);
    const left = await itemCount();
    check(`${width} E20: a double tap on the bin removes one line, not two`, left === lines - 1, `${lines} → ${left}`);
    const kept = (await page.getByText('Edge Tea').count() > 0) + (await page.getByText('Edge Salt').count() > 0);
    check(`${width} E20: exactly one of the two items is still on the purchase`, kept === 1, `${kept}`);

    // E26 — Receive money opens clean.
    await page.goto(`${base}/payments`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `/tmp/e2e-shots/edges-ui-${width}-payments.png` });
    await page.getByRole('button', { name: /^Receive money$/ }).locator('visible=true').first().click();
    const sheet = page.getByRole('dialog');
    await sheet.waitFor();
    await page.waitForTimeout(500);
    const red = async () => sheet.locator('[aria-invalid="true"], [role="alert"]').count();
    check(`${width} E26: Receive money opens with nothing red`, (await red()) === 0, `${await red()} marked`);
    const mode = sheet.getByRole('radio').first();
    if (await mode.count()) await mode.click();
    await page.waitForTimeout(400);
    const marked = await sheet.locator('[aria-invalid="true"], [role="alert"]').evaluateAll((els) => els.map((e) => `${e.tagName}[${e.getAttribute("name") ?? ""} id=${e.id} ph=${e.getAttribute("placeholder") ?? ""}] ${e.getAttribute('aria-label') ?? ''} ${(e.textContent ?? '').trim().slice(0, 60)}`));
    check(`${width} E26: still nothing red after a mode is tapped`, marked.length === 0, marked.join(' | '));

    check(`${width}: no page error`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
