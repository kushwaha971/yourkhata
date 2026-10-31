// D P1b — part numbers, rack and fits vehicle on the live stack (design D1 / D3, auto parts).
//
// With `shop.features.part_numbers` switched on for the run (and off after):
//   form   "PART DETAILS": two part numbers added as chips, Fits vehicle and
//          Rack typed; saved and read back from the API
//   search the Items search finds it by a part number's prefix
//   scan   a desktop bill: the scanner types the brand's part number → the
//          line is that item, captioned "Part 06430-… · Rack B-4"
//   phone  the same caption on a phone bill line, no overflow
//
//   node e2e/d1-parts.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/d1-parts';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D1 brake shoe ${tag}`;
const MAKER = `06430-K${tag}`;
const BRAND = `BS-${tag}`;

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
const headers = async (ctx) => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' });
const setFeature = async (ctx, on) =>
  ctx.request.put(`${base}/api/v1/tenants/current/settings`, {
    data: { values: { 'shop.features.part_numbers': { value: on } } },
    headers: await headers(ctx),
  });

const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(desk);
try {
  await setFeature(desk, true);
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click();
  await page.getByRole('dialog').getByLabel('Item name').fill(NAME);
  const group = page.getByTestId('item-part-details');
  check('form: "PART DETAILS" shows for a parts shop', await group.isVisible().catch(() => false));
  for (const code of [MAKER, BRAND]) {
    await page.getByTestId('item-part-add').click();
    await page.getByTestId('item-part-input').fill(code);
    await page.getByTestId('item-part-input').press('Enter');
  }
  await group.getByLabel('Fits vehicle').fill('Splendor, Passion Pro');
  await group.getByLabel('Rack').fill('B-4');
  await page.screenshot({ path: `${dir}/1280-form.png` });
  await page.getByRole('button', { name: /^Save( item)?$/ }).last().click();
  await sleep(2500);
  const found = (await (await desk.request.get(`${base}/api/v1/items?q=${encodeURIComponent(NAME)}`)).json()).data?.[0];
  check('API: saved with both part numbers, rack and vehicles', JSON.stringify(found?.part_numbers) === JSON.stringify(skew ? ['XX'] : [MAKER, BRAND]) && found?.rack === 'B-4' && found?.fits_vehicle === 'Splendor, Passion Pro', JSON.stringify(found && { p: found.part_numbers, r: found.rack, f: found.fits_vehicle }));
  if (!found) throw new Error('not saved');

  const byPart = (await (await desk.request.get(`${base}/api/v1/items?q=${encodeURIComponent(MAKER.slice(0, 8))}`)).json()).data ?? [];
  check('API: search finds it by a part number prefix', byPart.some((row) => row.id === found.id && row.match_field === 'part'), byPart.map((r) => `${r.name}:${r.match_field}`).join(', '));

  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: 'Search items to add' });
  await search.click();
  for (const ch of BRAND) await page.keyboard.press(ch, { delay: 0 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  const part = await page.getByTestId('line-part').first().innerText().catch(() => '');
  check('desktop: the brand number adds the line, captioned "Part … · Rack B-4"', part === (skew ? 'XX' : `Part ${MAKER} · Rack B-4`), part);
  await page.screenshot({ path: `${dir}/1280-bill.png` });

  // D1 auto parts: Vehicle no. and Mechanic in More details, kept on the bill.
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  await sleep(1000);
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' });
  if (await discard.isVisible({ timeout: 2000 }).catch(() => false)) await discard.click();
  const details = page.getByRole('button', { name: /More details/ }).first();
  if (!(await page.getByLabel('Vehicle no.').isVisible().catch(() => false))) await details.click().catch(() => {});
  await page.getByLabel('Vehicle no.').fill('mh 12 kt 4471');
  await page.getByLabel('Mechanic').fill('Raju Garage');
  const s2 = page.getByRole('combobox', { name: 'Search items to add' });
  await s2.fill(NAME);
  await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
  await sleep(4500);
  const draftId = /\/invoices\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  const draft = draftId ? (await (await desk.request.get(`${base}/api/v1/sales/invoices/${draftId}`)).json()).data : null;
  check('bill: Vehicle no. and Mechanic kept (MH12KT4471, Raju Garage)', draft?.vehicle?.number === 'MH12KT4471' && draft?.vehicle?.mechanic === 'Raju Garage', JSON.stringify(draft?.vehicle));
  await page.screenshot({ path: `${dir}/1280-vehicle.png` });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await signIn(phone);
  await p2.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const box = p2.getByRole('combobox').first();
  await box.fill(MAKER.slice(0, 9));
  await p2.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
  await sleep(1000);
  const cap = await p2.getByTestId('line-part').first().innerText().catch(() => '');
  check('phone: the line reads "Part … · Rack B-4"', cap === `Part ${MAKER} · Rack B-4`, cap);
  await p2.screenshot({ path: `${dir}/390-bill.png` });
  const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('phone: no overflow', over <= 0, String(over));
  await phone.close();
} finally {
  await setFeature(desk, false);
  await desk.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
