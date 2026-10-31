// D P4 — medicine batches on the live stack (design D6 / D1 / D7).
//
//   buy    a medicine tracked by batch; a purchase line gets Batch no.,
//          Expiry and MRP on screen (D6) → recorded; API: the batch holds 10
//   sell   a desktop bill: the line reads "<batch> · exp MM/YY" (D1), the
//          earliest unexpired batch; Paid cash → API: the bill line took it
//   list   Expiry (D7): the batch shows under its window with "In N days"
//
//   node e2e/d4-batches.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d4-batches';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D4 Dolo ${tag}`;
const BATCH = `DL${tag}`;
// Next month's last day: within the 30-to-60-day lists either way.
const nm = new Date(); nm.setUTCDate(1); nm.setUTCMonth(nm.getUTCMonth() + 1);
const expiry = new Date(Date.UTC(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(ctx);
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const item = (await (await ctx.request.post(`${base}/api/v1/items`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { name: NAME, unit_id: nos.id, selling_price: '32', purchase_price: '24', tracking: 'batch' },
})).json()).data;
check('set-up: a medicine tracked by batch', item?.tracking === 'batch', String(item?.tracking));
const supplier = (await (await ctx.request.get(`${base}/api/v1/parties?type=supplier&page_size=1`)).json()).data?.[0];

await page.goto(`${base}/purchases/bills/new`, { waitUntil: 'networkidle' });
await page.getByRole('combobox').first().fill(supplier.name);
await page.getByRole('option', { name: new RegExp(supplier.name.slice(0, 12)) }).first().click({ timeout: 10000 });
await page.getByPlaceholder(/Add item/).first().fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(800);
await page.locator('[data-line-cell][data-row="0"][data-col="1"] input').first().fill('10');
check('purchase: Batch no., Expiry and MRP on the line (D6)', await page.getByTestId('line-batch-fields').isVisible());
await page.getByTestId('line-batch-no').fill(BATCH);
// The pack says a month; the batch expires on its last day.
await page.getByTestId('line-batch-expiry').fill(`${expiry.slice(5, 7)}/${expiry.slice(0, 4)}`);
await page.getByTestId('line-batch-fields').getByLabel('MRP').fill('32');
await page.screenshot({ path: `${dir}/1280-purchase.png` });
await page.getByTestId('purchase-dock').getByRole('button', { name: 'Record', exact: true }).click();
await page.getByTestId('purchase-paid-now-confirm').waitFor({ timeout: 10000 }).catch(() => {});
const later = page.getByRole('dialog').getByRole('button', { name: /Pay later/ });
if (await later.count()) await later.first().click();
await sleep(3500);
const near = (await (await ctx.request.get(`${base}/api/v1/stock/expiry?within=60`)).json());
const row = (near.data ?? []).find((r) => r.batch_no === BATCH);
check('API: the batch holds 10, expiring at the end of next month', Number(row?.qty) === 10 && row?.expiry === expiry, JSON.stringify(row && { q: row.qty, e: row.expiry }));

await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
const search = page.getByRole('combobox', { name: 'Search items to add' });
await search.fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(1200);
const cap = await page.getByTestId('line-batch').first().innerText().catch(() => '');
const mmYY = `${expiry.slice(5, 7)}/${expiry.slice(2, 4)}`;
check('bill: the line reads "<batch> · exp MM/YY" (D1)', cap === `${BATCH} · exp ${mmYY}`, cap);
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
const bill = billId ? (await (await ctx.request.get(`${base}/api/v1/sales/invoices/${billId}`)).json()).data : null;
const took = bill?.lines?.[0]?.batches ?? [];
check('API: the bill line took that batch', took.length === 1 && took[0].batch_no === BATCH && Number(took[0].qty) === 1, JSON.stringify(took));

await page.goto(`${base}/stock/expiry`, { waitUntil: 'networkidle' });
await sleep(800);
await page.getByRole('button', { name: /^60 days/ }).or(page.getByRole('radio', { name: /^60 days/ })).first().click();
await sleep(1200);
const list = await page.getByTestId('expiry-screen').innerText();
const tableRow = page.getByRole('row').filter({ hasText: BATCH });
const rowText = (await tableRow.innerText().catch(() => '')).replace(/\s+/g, ' ');
check('Expiry (D7) desktop: a table row with the medicine, batch, 9 and "In N days"', rowText.includes(NAME) && /\b9\b/.test(rowText) && /In \d+ days/.test(rowText), rowText);
await page.screenshot({ path: `${dir}/1280-expiry.png` });
await tableRow.getByRole('checkbox').first().check();
await page.getByTestId('expiry-return').click();
await page.waitForURL(/\/purchases\/bills\/[0-9a-f-]{36}\?return=1/, { timeout: 10000 }).catch(() => {});
const drawerOpen = await page.getByTestId('debit-note-lines').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
check('Return to distributor: opens the debit note of the bill the batch came in on', drawerOpen && (await page.getByTestId('debit-note-lines').innerText()).includes(NAME), page.url());
await page.screenshot({ path: `${dir}/1280-return.png` });
// Issue it: 4 back to the distributor. The batch must lose them too (the
// first build moved stock but left the batch, and refused every medicine
// return with "Enter the batch number").
await page.getByTestId('debit-note-lines').getByRole('textbox').first().fill('4');
await page.getByRole('combobox', { name: 'Reason' }).click();
await page.getByRole('option', { name: 'Goods returned' }).click();
await page.getByTestId('debit-note-issue').click();
await sleep(2500);
const afterReturn = ((await (await ctx.request.get(`${base}/api/v1/stock/expiry?within=90`)).json()).data ?? []).find((r) => r.batch_no === BATCH);
check('Return to distributor: the debit note takes 4 out of the batch (9 → 5)', Number(afterReturn?.qty) === 5, JSON.stringify(afterReturn && afterReturn.qty));

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/stock/expiry`, { waitUntil: 'networkidle' });
await sleep(1000);
await p2.getByRole('radio', { name: /^60 days/ }).or(p2.getByRole('button', { name: /^60 days/ })).first().click().catch(() => {});
await sleep(1000);
const phoneList = await p2.getByTestId('expiry-screen').innerText();
check('phone: the list says "9 left", with Return to distributor (debit note)', phoneList.includes(NAME) && phoneList.includes('9 left') && (await p2.getByTestId('expiry-return').innerText()).includes('Return to distributor (debit note)'));
const chips = await p2.getByRole('radiogroup').first().evaluate((el) => el.getBoundingClientRect().height).catch(() => 0);
check('phone: the window chips stay on one line', chips > 0 && chips < 60, String(chips));
await p2.screenshot({ path: `${dir}/390-expiry.png` });
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: Expiry fits', over <= 0, String(over));
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
