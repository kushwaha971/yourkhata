// D13 — estimates and delivery challans for the business, on the live stack.
//
//   estimate  a medicine tracked by batch on a new estimate: no batch caption on
//             the line, and the note "No stock moves and no batch or IMEI is
//             taken until the estimate becomes a bill. Batch / IMEI is picked
//             when you convert."
//   challan   a challan draft (API) opened in the editor: the Transport fields
//             Vehicle no., Driver / person, Deliver to; typed and saved, read
//             back from the API; the stock note is shown
//   print     the issued challan's A4 sheet carries Driver and Deliver to
//   phone     the challan editor fits a 390 phone
//
//   node e2e/d13-docs.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d13-docs';
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
const discardRestore = async (page) => {
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' });
  if (await discard.isVisible({ timeout: 2000 }).catch(() => false)) await discard.click();
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(ctx);
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const med = (await (await ctx.request.post(`${base}/api/v1/items`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { name: `D13 Pan 40 ${tag}`, unit_id: nos.id, selling_price: '90', tracking: 'batch' },
})).json()).data;
const plain = (await (await ctx.request.post(`${base}/api/v1/items`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { name: `D13 cement ${tag}`, unit_id: nos.id, selling_price: '400', opening_stock: { qty: '50', unit_cost: '300' } },
})).json()).data;
const party = (await (await ctx.request.get(`${base}/api/v1/parties?type=customer&page_size=1`)).json()).data[0];

// estimate
await page.goto(`${base}/sales/estimates/new`, { waitUntil: 'networkidle' });
await discardRestore(page);
const search = page.getByRole('combobox', { name: 'Search items to add' });
await search.fill(med.name);
await page.getByRole('option', { name: new RegExp(med.name) }).first().click({ timeout: 10000 });
await sleep(1500);
const note = await page.getByTestId('lines-stock-note').innerText().catch(() => '');
check('estimate: the note says nothing is taken until the bill', note === 'No stock moves and no batch or IMEI is taken until the estimate becomes a bill. Batch / IMEI is picked when you convert.', note);
check('estimate: no batch caption on the line', (await page.getByTestId('line-batch').count()) === 0);
const info = await page.getByTestId('line-stock-info').first().innerText().catch(() => '');
check('estimate: a short item says "0 NOS in stock" in grey, not a red warning', /^0 NOS in stock$/.test(info) && (await page.getByTestId('line-stock-short').count()) === 0, info);
await page.screenshot({ path: `${dir}/1280-estimate.png` });

// challan
const draft = (await (await ctx.request.post(`${base}/api/v1/sales/delivery-challans`, {
  headers: await headers(ctx),
  data: { party_id: party.id, lines: [{ item_id: plain.id, qty: '5' }] },
})).json()).data;
check('set-up: a challan draft', !!draft?.id, JSON.stringify(draft).slice(0, 200));
await page.goto(`${base}/sales/challans/${draft.id}/edit`, { waitUntil: 'networkidle' });
await discardRestore(page);
await sleep(1000);
const box = page.getByTestId('challan-details');
check('challan: Transport shows Vehicle no., Driver / person, Deliver to', /Vehicle no\..*Driver \/ person.*Deliver to/s.test(await box.innerText()));
await box.getByLabel('Vehicle no.').fill('mh 14 gu 2290');
await box.getByLabel('Driver / person').fill('Santosh');
await box.getByLabel('Deliver to').fill('Patil Bungalow, Sector 4');
check('challan: "Stock goes out now…" is said', (await page.getByTestId('challan-stock-note').innerText()).startsWith('Stock goes out now'));
await page.screenshot({ path: `${dir}/1280-challan.png` });
await page.getByRole('button', { name: /^Save draft$/ }).first().click();
await sleep(3000);
const back = (await (await ctx.request.get(`${base}/api/v1/sales/delivery-challans/${draft.id}`)).json()).data;
const c = back?.links?.challan ?? {};
check('API: vehicle, driver and deliver-to kept', c.vehicle_number === 'MH 14 GU 2290' && c.driver === 'Santosh' && c.deliver_to === 'Patil Bungalow, Sector 4', JSON.stringify(c));

const issued = await ctx.request.post(`${base}/api/v1/sales/delivery-challans/${draft.id}/issue`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { version: back.version },
});
check('set-up: the challan is issued', issued.ok(), `${issued.status()} ${(await issued.text()).slice(0, 200)}`);
await page.goto(`${base}/sales/challans/${draft.id}`, { waitUntil: 'networkidle' });
await sleep(1500);
await page.evaluate(() => { window.__opened = []; window.open = (url) => { window.__opened.push(String(url)); return null; }; });
await page.getByRole('button', { name: /^Share$/ }).first().click().catch(() => {});
await sleep(1500);
const sent = decodeURIComponent((await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').first().getAttribute('href').catch(() => '')) || '');
await page.screenshot({ path: `${dir}/1280-share.png` });
check('share: the WhatsApp text names the vehicle (D15 goods dispatched)', sent.includes('Vehicle MH 14 GU 2290.'), sent.slice(-160) || 'no link');
await page.keyboard.press('Escape').catch(() => {});
await page.emulateMedia({ media: 'print' });
const sheet = await page.locator('body').innerText();
await page.screenshot({ path: `${dir}/1280-challan-print.png`, fullPage: true });
await page.emulateMedia({ media: 'screen' });
check('print: Driver / person and Deliver to on the challan', sheet.includes('Santosh') && sheet.includes('Patil Bungalow, Sector 4'));
check('print: "Vehicle no." appears once on a challan', sheet.split('Vehicle no.').length === 2, String(sheet.split('Vehicle no.').length - 1));

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/sales/challans/new`, { waitUntil: 'networkidle' });
await discardRestore(p2);
await sleep(1000);
await p2.getByText('More details').first().click().catch(() => {});
await sleep(500);
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: the challan editor fits', over <= 0, String(over));
await p2.screenshot({ path: `${dir}/390-challan.png`, fullPage: true });
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
