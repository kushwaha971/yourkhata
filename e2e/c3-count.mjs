// C3 — Stock count on the live stack (design pCount / dCount, R-DEC-67).
//
// Makes two test items of its own with a known opening stock (10 and 5, via
// the API), then, as the QA owner:
//   phone 390 — open /stock/count, scan item A three times with the camera
//     stub (+1 each), type 4 for item B in its Count sheet; the rows read
//     "In books 10 · Counted 3" and "−6"; the count line reads back from the
//     server's summary; reload keeps the count (it lives on the server);
//   a SECOND context (another phone) joins the same open count;
//   a sale of 1 of item B after counting (a real issued bill is not needed:
//     a −1 stock adjustment is the same book movement) must NOT become a
//     shortage at save;
//   Save count → confirm → read back: A on hand 3 (stocktake_out −7), B on
//     hand 4 (books moved to 4 by the adjustment, counted 4 → no movement);
//   a double tap on Save posts once.
// Desktop 1280 — Pause and Save count in the header, the table with In books /
// Counted / Difference / Value, a typed count saves on Enter.
//
//   node e2e/c3-count.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
// The build calls the API on :8000 directly; cookies are not port-scoped.
const api = process.env.E2E_API ?? 'http://localhost:8000';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/c3';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const CODE_A = `89070${tag}01`.slice(0, 13);

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
const onHand = async (ctx, id) =>
  (await (await ctx.request.get(`${api}/api/v1/items/${id}`)).json()).data?.stock?.on_hand ??
  (await (await ctx.request.get(`${api}/api/v1/items/${id}`)).json()).data?.on_hand;

const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phoneCtx.addInitScript(STUBS);
const page = await signIn(phoneCtx);

// A count left open by an earlier run would carry its lines in: save it first.
{
  const open = (await (await phoneCtx.request.post(`${api}/api/v1/stock-counts/open`, { headers: await headers(phoneCtx), data: {} })).json()).data;
  if (open?.counted > 0) {
    await phoneCtx.request.post(`${api}/api/v1/stock-counts/${open.id}/save`, { headers: await headers(phoneCtx), data: {} });
  }
}
// Two items of our own: A (barcode, 10 in stock) and B (5 in stock).
const nos = (await (await phoneCtx.request.get(`${api}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const make = async (name, qty, barcode) =>
  (await (await phoneCtx.request.post(`${api}/api/v1/items`, {
    headers: await headers(phoneCtx, { 'Idempotency-Key': randomUUID() }),
    data: { name, unit_id: nos.id, ...(barcode ? { barcode } : {}), opening_stock: { qty, unit_cost: '20' } },
  })).json()).data;
const A = await make(`C3 count A ${tag}`, '10', CODE_A);
const B = await make(`C3 count B ${tag}`, '5');
check('test items made with opening stock', Boolean(A?.id && B?.id), `${A?.id} ${B?.id}`);

await page.goto(`${base}/stock/count`, { waitUntil: 'networkidle' });
const main = () => page.locator('main').innerText();
check('phone: "Stock count" with "Started … · all items"', /Stock count[\s\S]*Started \d{1,2}:\d{2} (am|pm) · all items/.test(await main()));
await page.screenshot({ path: `${dir}/390-start.png` });

// scan A three times with the camera (the C1 sheet, continuous)
await page.getByTestId('open-camera-scan').click();
await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
await sleep(600);
for (let n = 0; n < 3; n += 1) {
  await page.evaluate((c) => { window.__seeCode = c; }, CODE_A);
  await sleep(1700); // past the 1.5 s repeat window: each is a separate scan
}
await page.screenshot({ path: `${dir}/390-camera.png` });
await page.getByRole('button', { name: 'Done' }).click();
await sleep(800);
// find A's row via the search
const box = page.getByRole('combobox').first();
const rowsText = await main();
check('phone: A reads "In books 10 · Counted 3"', rowsText.includes(skew ? 'XX' : 'In books 10 · Counted 3'), rowsText.slice(0, 300).replace(/\n/g, ' / '));
check('phone: A shows −7', rowsText.includes('−7'));

// type 4 for B in its Count sheet (B is "Not counted yet")
// B is not on the first page of a 400-item shop: the merchant types its name.
await box.fill(`C3 count B ${tag}`);
await page.getByRole('option', { name: new RegExp(`C3 count B ${tag}`) }).first().click({ timeout: 10000 });
await page.getByTestId('count-sheet-input').fill('4');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
await sleep(1200);
await page.screenshot({ path: `${dir}/390-counted.png` });

// read back the server's summary
const summary = (await (await phoneCtx.request.post(`${api}/api/v1/stock-counts/open`, { headers: await headers(phoneCtx), data: {} })).json()).data;
check('API: 2 counted, 2 differ', summary.counted === (skew ? 99 : 2) && summary.differ === 2, JSON.stringify(summary));
const line = await page.getByTestId('count-line').innerText();
check('phone: the count line agrees with the server', line.includes(`Counted ${summary.counted} items`) && line.includes(`${summary.differ} differ`), line);

// reload: the count lives on the server
await page.reload({ waitUntil: 'networkidle' });
check('phone: reload keeps the count', (await main()).includes('In books 10 · Counted 3'));

// a second phone joins the same count
const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page2 = await signIn(other);
await page2.goto(`${base}/stock/count`, { waitUntil: 'networkidle' });
check('second phone: joins the same open count', (await page2.locator('main').innerText()).includes('In books 10 · Counted 3'));
await other.close();

// B sells one after it was counted (a −1 adjustment is the same book move)
const sold = await phoneCtx.request.post(`${api}/api/v1/stock-adjustments`, {
  headers: await headers(phoneCtx, { 'Idempotency-Key': randomUUID() }),
  data: { reason: 'other', note: 'C3 test sale', lines: [{ item_id: B.id, qty: '-1' }] },
});
check('a book movement on B after counting (books 5 → 4)', sold.ok(), String(sold.status()));

// Save count, with a double tap on confirm
const dock = page.getByTestId('count-dock');
await dock.getByRole('button', { name: 'Save count' }).click();
await page.getByText('Save this count?').waitFor({ timeout: 5000 });
await page.screenshot({ path: `${dir}/390-confirm.png` });
const confirm = page.getByTestId('count-save-confirm');
await Promise.all([confirm.click().catch(() => {}), confirm.click({ delay: 20 }).catch(() => {})]);
await page.waitForURL(/\/items$/, { timeout: 10000 }).catch(() => {});
await sleep(1000);
const aNow = await onHand(phoneCtx, A.id);
const bNow = await onHand(phoneCtx, B.id);
check('API: A on hand 3 after saving', Number(aNow) === (skew ? 99 : 3), String(aNow));
// Shelf had 4 when counted (books 5); one sold since, so the shelf now holds 3.
// Posting counted − books-at-count (−1) gives 3; posting against books now (4) would give 4, wrong.
check('API: B on hand 3 — the sale after counting is kept, not double-counted', Number(bNow) === 3, String(bNow));
const moves = (await (await phoneCtx.request.get(`${api}/api/v1/items/${A.id}/movements`)).json()).data ?? [];
const takes = moves.filter((m) => (m.movement_type ?? m.type) === 'stocktake_out');
check('API: one stocktake_out of −7 for A (a double tap posted once)', takes.length === 1 && Number(takes[0]?.qty) === -7, JSON.stringify(takes.map((m) => m.qty)));

const look = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: no overflow', look <= 0, String(look));
await phoneCtx.close();

// ── desktop ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desk = await signIn(ctx);
  await desk.goto(`${base}/stock/count`, { waitUntil: 'networkidle' });
  const text = await desk.locator('main').innerText();
  check('desktop: Pause and Save count in the header', text.includes('Pause') && text.includes('Save count'));
  check('desktop: the table names In books / Counted / Difference', ['In books', 'Counted', 'Difference'].every((w) => text.includes(w)));
  check('desktop: "Counted 0 of N items" (a fresh count)', /Counted 0 of \d+ items/.test(text), text.slice(0, 200).replace(/\n/g, ' / '));
  // type a count for B on the first page, Enter saves it
  const input = desk.getByTestId('count-input').first();
  if (await input.count()) {
    await input.fill('4');
    await input.press('Enter');
    await sleep(1500);
    const s2 = (await (await ctx.request.post(`${api}/api/v1/stock-counts/open`, { headers: await headers(ctx), data: {} })).json()).data;
    check('desktop: a typed count saves on Enter (read back)', s2.counted === (skew ? 99 : 1), JSON.stringify(s2));
  } else {
    check('desktop: a row to type into', false);
  }
  await desk.screenshot({ path: `${dir}/1280.png` });
  const over = await desk.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('desktop: no overflow', over <= 0, String(over));
  await ctx.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
