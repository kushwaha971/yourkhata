// D P5 — the e-way bill file on the live stack (design D10, phone + desktop).
//
//   An issued bill of ₹64,000 to a Karnataka customer (API set-up). Its page
//   shows "Make an e-way bill?"; vehicle "mh 14 gu 2290" and 840 km typed;
//   "Make file for GST portal" downloads a JSON whose billLists[0] carries the
//   bill number, MH14GU2290, 840 and state 29. A small local bill has no card.
//
//   node e2e/d5-eway.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d5-eway';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);

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
const post = async (ctx, path, data, key = false) =>
  (await (await ctx.request.post(`${base}/api/v1${path}`, {
    headers: await headers(ctx, key ? { 'Idempotency-Key': randomUUID() } : {}),
    data,
  })).json()).data;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await signIn(ctx);
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const tile = await post(ctx, '/items', { name: `D5 tile ${tag}`, unit_id: nos.id, selling_price: '800', tax_code: 'GST18', hsn_sac: '6907', opening_stock: { qty: '200', unit_cost: '500' } }, true);
const party = await post(ctx, '/parties', { name: `D5 Patil Kirana ${tag}`, type: 'customer', state_code: '29', mobile: `98${tag}11`.slice(0, 10) }, true);
const issueBill = async (partyId, qty) => {
  const made = await post(ctx, '/sales/invoices', { party_id: partyId, lines: [{ item_id: tile.id, qty }] });
  return post(ctx, `/sales/invoices/${made.id}/issue`, { version: made.version }, true);
};
const big = await issueBill(party.id, '80');
check('set-up: an issued inter-state bill over ₹50,000', Number(big?.grand_total) > 50000, String(big?.grand_total));

await page.goto(`${base}/sales/invoices/${big.id}`, { waitUntil: 'networkidle' });
await sleep(1500);
const card = page.getByTestId('eway-card');
check('bill page: "Make an e-way bill?" is offered', await card.isVisible().catch(() => false));
await page.getByTestId('eway-vehicle').fill('mh 14 gu 2290');
await page.getByTestId('eway-distance').fill('840');
await page.screenshot({ path: `${dir}/1280.png` });
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('eway-make').click()]);
const file = JSON.parse(readFileSync(await download.path(), 'utf8'));
const bill = file?.billLists?.[0] ?? {};
check('file: bill no., MH14GU2290, 840 km, state 29, IGST', bill.docNo === big.number && bill.vehicleNo === 'MH14GU2290' && bill.transDistance === '840' && bill.toStateCode === 29 && bill.igstValue > 0, JSON.stringify({ n: bill.docNo, v: bill.vehicleNo, d: bill.transDistance, s: bill.toStateCode, i: bill.igstValue }));

const small = await issueBill(party.id, '1');
await page.goto(`${base}/sales/invoices/${small.id}`, { waitUntil: 'networkidle' });
await sleep(1500);
check('a bill under ₹50,000 has no card', !(await page.getByTestId('eway-card').isVisible().catch(() => false)));

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/sales/invoices/${big.id}`, { waitUntil: 'networkidle' });
await sleep(1500);
await p2.getByTestId('eway-card').scrollIntoViewIfNeeded().catch(() => {});
await p2.screenshot({ path: `${dir}/390.png` });
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: the card fits', (await p2.getByTestId('eway-card').isVisible().catch(() => false)) && over <= 0, String(over));
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
