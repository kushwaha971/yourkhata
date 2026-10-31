// D P1c — Move stock between the shop and a godown, on the live stack (design D10).
//
//   place  a shop with one place is asked to name its second ("Godown")
//   move   From Shop To Godown (via Swap), the item searched, 30 typed, Move
//          stock → read back: shop 70, godown 30; total and value unchanged
//   short  swapped back, 40 typed → "Only 30 in Godown" on the line and Move
//          stock stays off; nothing posted
//   phone  the screen at 390 has no overflow
//
//   node e2e/d1-transfer.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/d1-transfer';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D1 parle ${tag}`;

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
  data: { name: NAME, unit_id: nos.id, opening_stock: { qty: '100', unit_cost: '40' } },
})).json()).data;
check('set-up: an item with 100 at the shop', Boolean(item?.id));

await page.goto(`${base}/stock/transfer`, { waitUntil: 'networkidle' });
if (await page.getByTestId('transfer-add-place').isVisible().catch(() => false)) {
  await page.getByPlaceholder('Godown').fill('Godown');
  await page.getByTestId('transfer-add-place-save').click();
  await sleep(1500);
}
const places = (await (await ctx.request.get(`${base}/api/v1/locations`)).json()).data;
const shop = places.find((p) => p.is_default);
const godown = places.find((p) => !p.is_default);
check('place: the shop now has a second place', Boolean(shop && godown), places.map((p) => p.name).join(', '));

const held = async () => {
  const rows = (await (await ctx.request.get(`${base}/api/v1/stock-transfers/stock?from=${shop.id}&to=${godown.id}&ids=${item.id}`)).json()).data;
  return [Number(rows[0]?.at_from), Number(rows[0]?.at_to)];
};

// D10's default is Godown → Shop; this move goes the other way, through Swap.
await page.getByRole('button', { name: 'Swap From and To' }).click();
const box = page.getByRole('combobox').filter({ hasNotText: /Godown|Shop|Main/ }).last();
await page.getByPlaceholder('Search or scan item').fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(1200);
await page.getByTestId('transfer-qty').first().fill('30');
await page.screenshot({ path: `${dir}/1280-move.png` });
await page.getByTestId('transfer-save').click();
await sleep(2500);
const [atShop, atGodown] = await held();
check('API: shop 100 → 70 and godown 0 → 30', atShop === (skew ? 99 : 70) && atGodown === 30, `${atShop} / ${atGodown}`);
const detail = (await (await ctx.request.get(`${base}/api/v1/items/${item.id}`)).json()).data;
const total = (detail?.stock ?? []).reduce((sum, s) => sum + Number(s.on_hand), 0);
check('API: total stock still 100', total === (skew ? 99 : 100), String(total));

// Back the other way, asking for more than the godown holds.
await page.getByRole('button', { name: 'Swap From and To' }).click();
await page.getByPlaceholder('Search or scan item').fill(NAME);
await page.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(1200);
await page.getByTestId('transfer-qty').first().fill('40');
await sleep(300);
const shortText = await page.getByTestId('transfer-short').first().innerText().catch(() => '');
check('short: "Only 30 in Godown" on the line', shortText === `Only 30 in ${godown.name}`, shortText);
check('short: Move stock stays off', await page.getByTestId('transfer-save').isDisabled());
await page.screenshot({ path: `${dir}/1280-short.png` });
const [s2, g2] = await held();
check('API: nothing moved', s2 === 70 && g2 === 30, `${s2} / ${g2}`);

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/stock/transfer`, { waitUntil: 'networkidle' });
await p2.getByPlaceholder('Search or scan item').fill(NAME);
await p2.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
await sleep(1200);
await p2.screenshot({ path: `${dir}/390.png` });
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: no overflow', over <= 0, String(over));
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
