// D14 — the bill print carries the business's own column and header.
//
//   Finds issued bills the earlier harnesses made (d4: a batch medicine, d3: a
//   phone with IMEIs, d1: a parts bill with a vehicle) and prints each in A4
//   and 80 mm: "Batch · Exp" with the batch the line took, "IMEI" with the
//   numbers, "Vehicle no." in the header — each read against the API's own line.
//
//   node e2e/d14-print.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d14-print';
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
await page.fill('input[type=email]', 'scale@digikhaato.test');
await page.fill('input[type=password]', 'Scale-Run-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

// A parts bill with a vehicle, issued here (d1 keeps its draft).
const hdr = async (extra = {}) => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', ...extra });
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const part = (await (await ctx.request.post(`${base}/api/v1/items`, { headers: await hdr({ 'Idempotency-Key': randomUUID() }), data: { name: `D14 spark plug ${Date.now() % 1e6}`, unit_id: nos.id, selling_price: '150', opening_stock: { qty: '5', unit_cost: '90' } } })).json()).data;
const made = (await (await ctx.request.post(`${base}/api/v1/sales/invoices`, { headers: await hdr(), data: { vehicle_number: 'MH 12 KT 4471', mechanic: 'Raju Garage', lines: [{ item_id: part.id, qty: '1' }] } })).json()).data;
await ctx.request.post(`${base}/api/v1/sales/invoices/${made.id}/issue`, { headers: await hdr({ 'Idempotency-Key': randomUUID() }), data: { version: made.version, payment: { mode_breakup: [{ mode: 'cash', amount: made.grand_total }] } } });
const list = (await (await ctx.request.get(`${base}/api/v1/sales/invoices?page_size=100&status=paid,unpaid,partially_paid`)).json()).data ?? [];
const found = {};
for (const row of list) {
  if (found.batch && found.imei && found.vehicle) break;
  const doc = (await (await ctx.request.get(`${base}/api/v1/sales/invoices/${row.id}`)).json()).data;
  if (!doc || doc.status === 'draft' || doc.status === 'void') continue;
  if (!found.batch && doc.lines.some((l) => l.batches?.length)) found.batch = doc;
  if (!found.imei && doc.lines.some((l) => l.serials?.length)) found.imei = doc;
  if (!found.vehicle && doc.vehicle?.number) found.vehicle = doc;
}
check('set-up: issued bills with a batch, an IMEI and a vehicle', !!(found.batch && found.imei && found.vehicle), Object.keys(found).join(','));

const printed = async (doc, name) => {
  await page.goto(`${base}/sales/invoices/${doc.id}`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.emulateMedia({ media: 'print' });
  const text = await page.locator('body').innerText();
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  return text;
};
if (found.batch) {
  const b = found.batch.lines.find((l) => l.batches?.length).batches[0];
  const want = `${b.batch_no} · ${b.expiry.slice(5, 7)}/${b.expiry.slice(2, 4)}`;
  const text = await printed(found.batch, 'a4-batch');
  check(`A4: "Batch · Exp" column with ${want}`, text.includes('Batch · Exp') && text.includes(want));
}
if (found.imei) {
  const imei = found.imei.lines.find((l) => l.serials?.length).serials[0];
  const text = await printed(found.imei, 'a4-imei');
  check(`A4: "IMEI" column with ${imei}`, text.includes('IMEI') && text.includes(imei));
}
if (found.vehicle) {
  const text = await printed(found.vehicle, 'a4-vehicle');
  check(`A4: "Vehicle no." ${found.vehicle.vehicle.number} in the header`, text.includes('Vehicle no.') && text.includes(found.vehicle.vehicle.number));
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
