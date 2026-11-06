// Part C end to end — one item's day, through every C screen, on the live stack.
//
//   1. a new item with a barcode and 10 in stock (API set-up)
//   2. desktop bill: the scanner types its code twice → one line, qty 2;
//      Paid cash → the bill is issued; read back: the bill holds 2 and the
//      item's stock is 8
//   3. phone Items: the camera reads its code → THAT item's page opens, and
//      it says 8 in stock without a refresh
//   4. phone stock count: the camera reads it 7 times → "In books 8 ·
//      Counted 7", −1; Save count → the item's stock is 7, its movements end
//      with one stocktake_out of −1, and Stock summary agrees
//
//   node e2e/c-journey.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/c-journey';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-7);
const CODE = `8908${tag}12`.slice(0, 13);
const NAME = `C journey soap ${tag}`;

const STUBS = () => {
  window.BarcodeDetector = class {
    async detect() {
      const code = window.__seeCode;
      window.__seeCode = null;
      return code ? [{ rawValue: code }] : [];
    }
  };
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    c.getContext('2d').fillRect(0, 0, 320, 240);
    return c.captureStream(5);
  };
};

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
const item = async (ctx, id) => (await (await ctx.request.get(`${base}/api/v1/items/${id}`)).json()).data;
const onHand = (data) => Number(data?.stock?.on_hand ?? data?.on_hand);

// ── 1. set-up ──
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let page = await signIn(desk);
{
  const open = (await (await desk.request.post(`${base}/api/v1/stock-counts/open`, { headers: await headers(desk), data: {} })).json()).data;
  if (open?.counted > 0) await desk.request.post(`${base}/api/v1/stock-counts/${open.id}/save`, { headers: await headers(desk), data: {} });
}
const nos = (await (await desk.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const made = await desk.request.post(`${base}/api/v1/items`, {
  headers: await headers(desk, { 'Idempotency-Key': randomUUID() }),
  data: { name: NAME, unit_id: nos.id, barcode: CODE, sale_price: '30', opening_stock: { qty: '10', unit_cost: '20' } },
});
const A = (await made.json()).data;
check('1. item made: barcode, 10 in stock', made.ok() && onHand(await item(desk, A.id)) === 10, `${made.status()} ${A?.id}`);

// ── 2. desktop bill: scan twice, Paid cash ──
await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
const search = page.getByRole('combobox', { name: 'Search items to add' });
await search.click();
for (let n = 0; n < 2; n += 1) {
  for (const ch of CODE) await page.keyboard.press(ch, { delay: 0 });
  await page.keyboard.press('Enter');
  await sleep(1400);
}
const qty = await page.locator('[id="lines.0.qty"]').inputValue().catch(() => '');
check('2. bill: two scans are one line at qty 2', qty === '2', qty);
await sleep(3500); // past the editor's autosave
const issues = [];
page.on('request', (r) => { if (r.method() === 'POST' && /issue/.test(r.url())) issues.push(r.url()); });
await page.getByRole('button', { name: /^Paid cash/ }).last().click();
await sleep(800);
const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm|Save/ });
if (await confirm.count()) await confirm.last().click();
await sleep(3500);
await page.screenshot({ path: `${dir}/1280-paid.png` });
check('2. Paid cash sent one issue', issues.length === 1, String(issues.length));
const billId = /\/sales\/invoices\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? /\/invoices\/([0-9a-f-]{36})/.exec(issues[0] ?? '')?.[1];
const bill = billId ? (await (await desk.request.get(`${base}/api/v1/sales/invoices/${billId}`)).json()).data : null;
const billLine = (bill?.lines ?? []).find((l) => (l.item_id ?? l.item?.id) === A.id || l.description === NAME);
check('2. API: the bill is issued and holds 2 of the item', bill && bill.status !== 'draft' && Number(billLine?.qty) === 2, `${bill?.status} ${billLine?.qty}`);
const afterSale = onHand(await item(desk, A.id));
check('2. API: stock 10 → 8 after the sale', afterSale === (skew ? 99 : 8), String(afterSale));
await desk.close();

// ── 3. phone Items: camera finds it ──
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phone.addInitScript(STUBS);
page = await signIn(phone);
await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
await page.getByTestId('open-camera-scan').first().click();
await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
await sleep(600);
await page.evaluate((c) => { window.__seeCode = c; }, CODE);
await page.waitForURL(new RegExp(`/items/${A.id}`), { timeout: 10000 }).catch(() => {});
check('3. Items: the camera opens THAT item', page.url().includes(`/items/${A.id}`), page.url());
await sleep(1200);
const itemText = await page.locator('main').innerText();
check('3. the item page shows 8 in stock without a refresh', /\b8\b/.test(itemText) && itemText.includes(NAME), itemText.slice(0, 200).replace(/\n/g, ' / '));
await page.screenshot({ path: `${dir}/390-item.png` });

// ── 4. phone stock count: 7 scans, Save ──
await page.goto(`${base}/stock/count`, { waitUntil: 'networkidle' });
await page.getByTestId('open-camera-scan').click();
await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
await sleep(600);
for (let n = 0; n < 7; n += 1) {
  await page.evaluate((c) => { window.__seeCode = c; }, CODE);
  await sleep(1700);
}
await page.getByRole('button', { name: 'Done' }).click();
await sleep(1500);
const countText = await page.locator('main').innerText();
check('4. count: "In books 8 · Counted 7" and −1', countText.includes('In books 8 · Counted 7') && countText.includes('−1'), countText.slice(0, 260).replace(/\n/g, ' / '));
await page.screenshot({ path: `${dir}/390-count.png` });
await page.getByTestId('count-dock').getByRole('button', { name: 'Save count' }).click();
await page.getByTestId('count-save-confirm').click();
await page.waitForURL(/\/items$/, { timeout: 10000 }).catch(() => {});
await sleep(1500);
const finalStock = onHand(await item(phone, A.id));
check('4. API: stock 8 → 7 after the count', finalStock === (skew ? 99 : 7), String(finalStock));
const moves = (await (await phone.request.get(`${base}/api/v1/items/${A.id}/movements`)).json()).data ?? [];
const kinds = moves.map((m) => `${m.movement_type ?? m.type}:${Number(m.qty)}`);
check('4. API: movements are opening +10, sale −2, stock take −1', ['opening:10', 'sale_out:-2', 'stocktake_out:-1'].every((k) => kinds.includes(k)), kinds.join(' '));
const summary = (await (await phone.request.get(`${base}/api/v1/stock/summary?q=${encodeURIComponent(NAME)}`)).json()).data ?? [];
const row = summary.find((r) => (r.item?.id ?? r.item_id) === A.id);
check('4. API: Stock summary agrees (7)', Number(row?.on_hand) === (skew ? 99 : 7), JSON.stringify(row?.on_hand));
// The Items list on screen, opened after the save, without a refresh.
await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('Name, code or barcode').fill(NAME);
await sleep(1500);
const listText = await page.locator('main').innerText();
check('4. Items list shows the item at 7', listText.includes(NAME) && /\b7\b/.test(listText.slice(listText.indexOf(NAME), listText.indexOf(NAME) + 200)), listText.slice(listText.indexOf(NAME), listText.indexOf(NAME) + 120).replace(/\n/g, ' / '));
await page.screenshot({ path: `${dir}/390-items-after.png` });
await phone.close();

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
