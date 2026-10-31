// D P2 — sizes and colours on the live stack (design D3 / D2, clothes).
//
// With `shop.features.variants` on for the run (back to its old value after):
//   form   "SIZES AND COLOURS": switch on, sizes S M L XL, colours Blue
//          White → "This makes 8 items…"; Save → API: one product, 8 items
//   bill   a phone bill: pick "· Blue · M" → the line reads "Size M · Blue"
//          with S M L XL chips (each with its stock); tap L → the line is the
//          Blue · L item (read from the saved draft)
//   stock  Paid cash on desktop for Blue · L: only that item's stock falls
//
//   node e2e/d2-variants.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/d2-variants';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D2 shirt ${tag}`;

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
    data: { values: { 'shop.features.variants': { value: on } } },
    headers: await headers(ctx),
  });
const api = async (ctx, path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json());

const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(desk);
try {
  await setFeature(desk, true);
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click();
  await page.getByRole('dialog').getByLabel('Item name').fill(NAME);
  await page.getByRole('dialog').getByLabel('Selling price').first().fill('599').catch(() => {});
  const group = page.getByTestId('item-variants');
  check('form: "SIZES AND COLOURS" shows for a clothes shop', await group.isVisible().catch(() => false));
  await group.getByRole('switch').click();
  for (const size of ['S', 'M', 'L', 'XL']) {
    await page.getByTestId('item-size-add').click();
    await page.getByTestId('item-size-input').fill(size);
    await page.getByTestId('item-size-input').press('Enter');
  }
  for (const colour of ['Blue', 'White']) {
    await page.getByTestId('item-colour-add').click();
    await page.getByTestId('item-colour-input').fill(colour);
    await page.getByTestId('item-colour-input').press('Enter');
  }
  const count = await page.getByTestId('item-variants-count').innerText().catch(() => '');
  check('form: "This makes 8 items: S, M, L, XL in Blue and White."', count === 'This makes 8 items: S, M, L, XL in Blue and White.', count);
  await page.screenshot({ path: `${dir}/1280-form.png` });
  await page.getByRole('button', { name: /^Save( item)?$/ }).last().click();
  await sleep(3000);
  const made = (await api(desk, `/items?q=${encodeURIComponent(NAME)}&page_size=50`)).data ?? [];
  check('API: 8 items of one product', made.length === (skew ? 99 : 8) && new Set(made.map((r) => r.product?.id)).size === 1, `${made.length}`);
  const blueM = made.find((r) => r.attributes?.size === 'M' && r.attributes?.colour === 'Blue');
  const blueL = made.find((r) => r.attributes?.size === 'L' && r.attributes?.colour === 'Blue');
  if (!blueM || !blueL) throw new Error('variants missing');
  // Stock for two sizes, so the chips have something to say.
  for (const [item, qty] of [[blueM, '2'], [blueL, '7']]) {
    await desk.request.post(`${base}/api/v1/stock-adjustments`, {
      headers: await headers(desk, { 'Idempotency-Key': randomUUID() }),
      data: { reason: 'count', lines: [{ item_id: item.id, qty, unit_cost: '300' }] },
    });
  }

  // ── phone: pick Blue · M, then tap L ──
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await signIn(phone);
  await p2.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  await p2.getByRole('combobox').first().fill(`${NAME} · Blue · M`);
  await p2.getByRole('option', { name: new RegExp(`${NAME} · Blue · M`) }).first().click({ timeout: 10000 });
  await sleep(1500);
  const note = p2.getByTestId('line-variant').first();
  const text = await note.innerText().catch(() => '');
  check('phone: the line reads "Size M · Blue" with the four sizes', text.includes(skew ? 'XX' : 'Size M · Blue') && ['S', 'M', 'L', 'XL'].every((s) => text.includes(s)), text.replace(/\n/g, ' / '));
  check('phone: each size shows its stock (M 2, L 7)', /M\s*2/.test(text) && /L\s*7/.test(text), text.replace(/\n/g, ' / '));
  await p2.screenshot({ path: `${dir}/390-line.png` });
  await note.getByRole('button', { name: /^L/ }).first().click();
  await sleep(1200);
  const text2 = await p2.getByTestId('line-variant').first().innerText().catch(() => '');
  check('phone: tapping L makes the line Blue · L', text2.includes('Size L · Blue'), text2.replace(/\n/g, ' / '));
  const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('phone: no overflow', over <= 0, String(over));
  await phone.close();

  // ── desktop: sell Blue · L, read back ──
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: 'Search items to add' });
  await search.fill(`${NAME} · Blue · L`);
  await page.getByRole('option', { name: new RegExp(`${NAME} · Blue · L`) }).first().click({ timeout: 10000 });
  await sleep(3500);
  await page.getByRole('button', { name: /^Paid cash/ }).last().click();
  await sleep(800);
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm|Save/ });
  if (await confirm.count()) await confirm.last().click();
  await sleep(3500);
  const after = (await api(desk, `/items?q=${encodeURIComponent(NAME)}&page_size=50`)).data ?? [];
  const at = (id) => Number(after.find((r) => r.id === id)?.on_hand);
  check('API: Blue · L 7 → 6, Blue · M still 2', at(blueL.id) === (skew ? 99 : 6) && at(blueM.id) === 2, `${at(blueL.id)} / ${at(blueM.id)}`);
} finally {
  await setFeature(desk, false);
  await desk.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
