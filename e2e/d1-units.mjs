// D P1a — box and piece on the live stack (design D1 / D3, hardware).
//
// On the QA scale shop with `shop.features.alt_units` switched on for the run
// (and back off after):
//   form   the Add item drawer shows "ALSO SOLD AS"; Box · Has 20 PCS · ₹520
//          saves, read back as units [{BOX, 20, 520}]
//   phone  a bill: the item's line reads "Sold in NOS · BOX of 20" with PCS and
//          BOX chips; BOX makes it "1 BOX = 20 NOS" at ₹520; the box's own
//          barcode, typed by the scanner on desktop, adds a BOX line
//   money  Paid cash: the bill holds 1 BOX at ₹520, stock 100 → 80 (not 99)
//   off    with the switch off the form has no ALSO SOLD AS
//
//   node e2e/d1-units.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/d1-units';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D1 switch ${tag}`;
const BOX_CODE = `89071${tag}55`.slice(0, 13);

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
const headers = async (ctx, extra = {}) => ({
  'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '',
  ...extra,
});
const setFeature = async (ctx, on) =>
  ctx.request.put(`${base}/api/v1/tenants/current/settings`, {
    data: { values: { 'shop.features.alt_units': { value: on } } },
    headers: await headers(ctx),
  });

const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let page = await signIn(desk);
try {
  await setFeature(desk, true);
  await page.reload({ waitUntil: 'networkidle' });

  // ── form (desktop drawer) ──
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click().catch(async () => {
    await page.keyboard.press('n');
  });
  await page.getByRole('dialog').getByLabel('Item name').fill(NAME);
  const group = page.getByTestId('item-extra-units');
  check('form: "ALSO SOLD AS" shows when the shop sells in boxes', await group.isVisible().catch(() => false));
  await page.getByTestId('item-add-unit').click();
  await group.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'BOX', exact: true }).click();
  await group.getByLabel('Has').fill('20');
  await group.getByLabel(/BOX price/).fill('520');
  await page.screenshot({ path: `${dir}/1280-form.png` });
  await page.getByRole('button', { name: /^Save( item)?$/ }).last().click();
  await sleep(2500);
  const found = (await (await desk.request.get(`${base}/api/v1/items?q=${encodeURIComponent(NAME)}`)).json()).data?.[0];
  const unit = found?.units?.[0];
  check('API: the item saved with BOX = 20 at ₹520', unit?.code === 'BOX' && Number(unit.factor) === (skew ? 99 : 20) && unit.selling_price === '520.00', JSON.stringify(found?.units));
  if (!found) throw new Error('the item was not saved');

  // stock 100 and a box barcode, through the API (the form's opening is A5's)
  const detail = (await (await desk.request.get(`${base}/api/v1/items/${found.id}`)).json()).data;
  const box = (await (await desk.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'BOX');
  await desk.request.patch(`${base}/api/v1/items/${found.id}`, {
    headers: await headers(desk),
    data: {
      version: detail.version,
      selling_price: '28.00',
      units: [{ unit_id: box.id, factor: '20', selling_price: '520.00', barcode: BOX_CODE }],
    },
  });
  await desk.request.post(`${base}/api/v1/stock-adjustments`, {
    headers: await headers(desk, { 'Idempotency-Key': randomUUID() }),
    data: { reason: 'count', lines: [{ item_id: found.id, qty: '100', unit_cost: '20' }] },
  });
  const onHand = async () => Number((await (await desk.request.get(`${base}/api/v1/items/${found.id}`)).json()).data?.stock?.[0]?.on_hand);
  check('set-up: 100 in stock', (await onHand()) === 100, String(await onHand()));

  // ── desktop bill: the box barcode adds a BOX line ──
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: 'Search items to add' });
  await search.click();
  for (const ch of BOX_CODE) await page.keyboard.press(ch, { delay: 0 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  const deskText = await page.locator('main').innerText();
  check('desktop: the box barcode adds a line "1 BOX = 20 NOS"', deskText.includes(skew ? 'XX' : '1 BOX = 20 NOS'), deskText.slice(0, 300).replace(/\n/g, ' / '));
  const rate = await page.locator('[id="lines.0.unitPrice"]').inputValue().catch(() => '');
  check('desktop: at the box price ₹520', /^520(\.0+)?$/.test(rate.replace(/,/g, '')), rate);
  await page.screenshot({ path: `${dir}/1280-bill.png` });
  await sleep(3500);
  const issues = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /issue/.test(r.url())) issues.push(r.url()); });
  await page.getByRole('button', { name: /^Paid cash/ }).last().click();
  await sleep(800);
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm|Save/ });
  if (await confirm.count()) await confirm.last().click();
  await sleep(3500);
  const billId = /\/invoices\/([0-9a-f-]{36})/.exec(issues[0] ?? page.url())?.[1];
  const bill = billId ? (await (await desk.request.get(`${base}/api/v1/sales/invoices/${billId}`)).json()).data : null;
  const l0 = bill?.lines?.[0];
  check('API: the bill holds 1 BOX (factor 20) at ₹520', l0?.unit_code === 'BOX' && Number(l0?.qty) === 1 && Number(l0?.unit_factor) === 20 && Number(l0?.unit_price) === 520, JSON.stringify(l0 && { u: l0.unit_code, q: l0.qty, f: l0.unit_factor, p: l0.unit_price }));
  check('API: stock 100 → 80 (20 pieces, not 1)', (await onHand()) === (skew ? 99 : 80), String(await onHand()));

  // ── phone bill: caption and chips ──
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await signIn(phone);
  await p2.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const box2 = p2.getByRole('combobox').first();
  await box2.fill(NAME);
  await p2.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
  await sleep(1200);
  const lineUnit = p2.getByTestId('line-unit').first();
  const cap = await lineUnit.innerText().catch(() => '');
  check('phone: the line says "Sold in NOS · BOX of 20" with NOS and BOX chips', cap.includes(skew ? 'XX' : 'Sold in NOS · BOX of 20') && cap.includes('BOX'), cap.replace(/\n/g, ' / '));
  await lineUnit.getByRole('button', { name: 'BOX', exact: true }).or(lineUnit.getByRole('radio', { name: 'BOX' })).first().click();
  await sleep(600);
  const cap2 = await lineUnit.innerText().catch(() => '');
  check('phone: BOX makes it "1 BOX = 20 NOS"', cap2.includes('1 BOX = 20 NOS'), cap2.replace(/\n/g, ' / '));
  await p2.screenshot({ path: `${dir}/390-bill.png` });
  const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('phone: no overflow', over <= 0, String(over));
  await phone.close();

  // ── off: no group ──
  await setFeature(desk, false);
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click().catch(() => {});
  await sleep(800);
  check('off: a shop that does not sell in boxes sees no "ALSO SOLD AS"', !(await page.getByTestId('item-extra-units').isVisible().catch(() => false)));
} finally {
  await setFeature(desk, false);
  await desk.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
