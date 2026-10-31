// D P3 — IMEI numbers on the live stack (plan §P3, design D8 / D1 mobile).
//
//   buy    a phone tracked by IMEI (12 months warranty); a purchase of 2 with
//          their IMEIs typed into the line ("2 of 2 entered") → recorded;
//          API: both IMEIs in stock
//   sell   a desktop bill: the phone line asks for its IMEI ("0 of 1"); one
//          typed → Paid cash → API: that IMEI sold with a warranty date
//   twice  the same IMEI on a second bill is refused and nothing posts
//
//   node e2e/d3-imei.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d3-imei';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-7);
const NAME = `D3 Redmi ${tag}`;
const IMEI = [`35${tag}0001`, `35${tag}0002`];

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
const serial = async (ctx, code) => (await (await ctx.request.get(`${base}/api/v1/serials/${code}`)).json()).data;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(ctx);
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const item = (await (await ctx.request.post(`${base}/api/v1/items`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { name: NAME, unit_id: nos.id, selling_price: '9999', purchase_price: '8000', tracking: 'serial', warranty_months: 12 },
})).json()).data;
check('set-up: a phone tracked by IMEI', item?.tracking === 'serial', String(item?.tracking));
const supplier = (await (await ctx.request.get(`${base}/api/v1/parties?type=supplier&page_size=1`)).json()).data?.[0];

// ── buy 2 with their IMEIs, through the purchase screen ──
await page.goto(`${base}/purchases/bills/new`, { waitUntil: 'networkidle' });
await page.getByRole('combobox').first().fill(supplier.name);
await page.getByRole('option', { name: new RegExp(supplier.name.slice(0, 12)) }).first().click({ timeout: 10000 });
const q = page.getByPlaceholder(/Add item/).first();
await q.fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(800);
await page.locator('[data-line-cell][data-row="0"][data-col="1"] input').first().fill('2');
for (const code of IMEI) {
  await page.getByTestId('line-serial-add').first().click();
  await page.getByTestId('line-serial-input').fill(code);
  await page.getByTestId('line-serial-input').press('Enter');
}
const count = await page.getByTestId('line-serials-count').first().innerText().catch(() => '');
check('purchase: "2 of 2 entered"', count === '2 of 2 entered', count);
await page.screenshot({ path: `${dir}/1280-purchase.png` });
await page.getByTestId('purchase-dock').getByRole('button', { name: 'Record', exact: true }).click();
await page.getByTestId('purchase-paid-now-confirm').waitFor({ timeout: 10000 }).catch(() => {});
const later = page.getByRole('dialog').getByRole('button', { name: /Pay later|Not paid|Record without/ });
if (await later.count()) await later.first().click();
else await page.getByTestId('purchase-paid-now-confirm').click().catch(() => {});
await sleep(3500);
const s1 = await serial(ctx, IMEI[0]);
const s2 = await serial(ctx, IMEI[1]);
check('API: both IMEIs in stock after the purchase', s1?.status === 'in_stock' && s2?.status === 'in_stock', `${s1?.status} / ${s2?.status}`);

// ── sell one on a desktop bill ──
await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
const search = page.getByRole('combobox', { name: 'Search items to add' });
await search.fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(1000);
const asks = await page.getByTestId('line-serials-count').first().innerText().catch(() => '');
check('bill: the phone line asks for its IMEI ("0 of 1 entered")', asks === '0 of 1 entered', asks);
await page.getByTestId('line-serial-add').first().click();
await page.getByTestId('line-serial-input').fill(IMEI[0]);
await page.getByTestId('line-serial-input').press('Enter');
await sleep(3500);
await page.getByRole('button', { name: /^Paid cash/ }).last().click();
await sleep(800);
const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm|Save/ });
if (await confirm.count()) await confirm.last().click();
await sleep(3500);
await page.screenshot({ path: `${dir}/1280-sold.png` });
const sold = await serial(ctx, IMEI[0]);
check('API: that IMEI is sold, with a warranty date', sold?.status === 'sold' && Boolean(sold?.warranty_until), JSON.stringify(sold && { s: sold.status, w: sold.warranty_until }));

// ── Find by IMEI (D8) ──
await page.goto(`${base}/items/imei`, { waitUntil: 'networkidle' });
await page.getByTestId('find-imei-input').fill(IMEI[0]);
await page.getByTestId('find-imei-input').press('Enter');
await sleep(1500);
const card = await page.getByTestId('find-imei-result').innerText().catch(() => '');
check('find: the phone, Sold, the bill and the warranty', card.includes(NAME) && card.includes('Sold') && card.includes('Bill') && /Till .* left/.test(card), card.replace(/\n/g, ' / '));
await page.screenshot({ path: `${dir}/1280-find.png` });
await page.getByTestId('find-imei-input').fill('000000000000000');
await page.getByTestId('find-imei-input').press('Enter');
await sleep(1200);
check('find: an unknown IMEI says so', (await page.locator('main').innerText()).includes('No phone with 000000000000000'));

// ── the same IMEI again: refused ──
const party = (await (await ctx.request.get(`${base}/api/v1/parties?type=customer&page_size=1`)).json()).data?.[0];
const made = (await (await ctx.request.post(`${base}/api/v1/sales/invoices`, {
  headers: await headers(ctx),
  data: { party_id: party.id, lines: [{ item_id: item.id, qty: '1', serials: [IMEI[0]] }] },
})).json()).data;
const again = await ctx.request.post(`${base}/api/v1/sales/invoices/${made.id}/issue`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { version: made.version },
});
check('API: selling the same IMEI twice is refused (409)', again.status() === 409, String(again.status()));
const still = await serial(ctx, IMEI[1]);
check('API: the other phone is still in stock', still?.status === 'in_stock', still?.status);
// Back to the supplier: the debit note takes the bill's phone still on the
// shelf (the first build refused every phone return with "Enter 1 IMEI").
const back = await ctx.request.post(`${base}/api/v1/purchases/debit-notes`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { against_id: still?.purchase?.id, reason: 'goods_returned', lines: [{ bill_line_no: 1, qty: '1' }] },
});
check('return: a phone goes back to the supplier (201)', back.status() === 201, `${back.status()} ${(await back.text()).slice(0, 160)}`);
const gone = await serial(ctx, IMEI[1]);
check('return: that IMEI is no longer in stock', gone?.status !== 'in_stock', JSON.stringify(gone && gone.status));

// Design D8 phone: a camera button beside the IMEI box, and the box and it fit.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/items/imei`, { waitUntil: 'networkidle' });
await sleep(800);
const scan = p2.getByRole('button', { name: 'Scan with camera' });
const sb = await scan.boundingBox().catch(() => null);
const ib = await p2.getByTestId('find-imei-input').boundingBox().catch(() => null);
check('phone: "Scan with camera" sits beside the IMEI box', !!sb && !!ib && Math.abs(sb.y + sb.height / 2 - (ib.y + ib.height / 2)) < 6 && sb.x > ib.x, JSON.stringify({ sb, ib }));
await p2.screenshot({ path: `${dir}/390-find.png` });
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
