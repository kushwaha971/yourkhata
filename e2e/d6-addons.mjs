// D P6 — café add-ons on the live stack (design D11).
//
//   form   with `shop.features.addons` on for the run: the item form shows
//          ADD-ONS; Ice cream ₹30 and Less sugar (free) saved, read back
//   phone  a bill: picking Cold coffee opens the add-on sheet; tick Ice cream,
//          How many 2 → "Add · ₹300"; the line reads "+ Ice cream ₹30.00" at
//          ₹150 × 2
//   plain  an item without add-ons opens no sheet (today's taps)
//   money  the saved draft holds the add-on snapshot and ₹300 taxable
//
//   node e2e/d6-addons.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d6-addons';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);
const NAME = `D6 Cold coffee ${tag}`;

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
    data: { values: { 'shop.features.addons': { value: on } } },
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
  const group = page.getByTestId('item-addons');
  check('form: ADD-ONS shows for a café', await group.isVisible().catch(() => false));
  for (const [name, price] of [['Ice cream', '30'], ['Less sugar', '0']]) {
    await page.getByTestId('item-add-addon').click();
    const names = group.getByLabel('Add-on', { exact: true });
    await names.last().fill(name);
    await group.getByLabel('Price', { exact: true }).last().fill(price);
  }
  await page.screenshot({ path: `${dir}/1280-form.png` });
  await page.getByRole('button', { name: /^Save( item)?$/ }).last().click();
  await sleep(2500);
  const found = (await (await desk.request.get(`${base}/api/v1/items?q=${encodeURIComponent(NAME)}`)).json()).data?.[0];
  check('API: saved with Ice cream ₹30 and Less sugar free', JSON.stringify(found?.addons) === JSON.stringify([{ name: 'Ice cream', price: '30.00' }, { name: 'Less sugar', price: '0.00' }]), JSON.stringify(found?.addons));
  if (!found) throw new Error('not saved');
  const det = (await (await desk.request.get(`${base}/api/v1/items/${found.id}`)).json()).data;
  await desk.request.patch(`${base}/api/v1/items/${found.id}`, { headers: await headers(desk), data: { version: det.version, selling_price: '120' } });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await signIn(phone);
  await p2.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  await p2.getByRole('combobox').first().fill(NAME);
  await p2.getByRole('option', { name: new RegExp(NAME) }).first().click({ timeout: 10000 });
  const sheet = p2.getByTestId('addon-sheet');
  check('phone: picking Cold coffee opens the add-on sheet', await sheet.waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await sheet.getByText('Ice cream').click();
  await sheet.getByRole('checkbox', { name: 'Ice cream' }).screenshot({ path: `${dir}/390-tick.png` });
  await p2.getByTestId('addon-qty').fill('2');
  await sleep(400); // past the checkbox's colour transition
  const ticked = await sheet.getByRole('checkbox', { name: 'Ice cream' }).getAttribute('aria-checked').catch(() => null)
    ?? String(await sheet.getByRole('checkbox', { name: 'Ice cream' }).isChecked().catch(() => null));
  const fill = await sheet.getByRole('checkbox', { name: 'Ice cream' }).evaluate((el) => `${el.getAttribute('data-state')} ${getComputedStyle(el).backgroundColor}`);
  check('phone: Ice cream shows ticked (state and fill)', ticked === 'true' && !fill.includes('255, 255, 255'), `${ticked} · ${fill}`);
  const addText = await p2.getByTestId('addon-add').innerText();
  check('phone: "Add · ₹300.00"', addText.includes('₹300.00'), addText);
  await p2.screenshot({ path: `${dir}/390-sheet.png` });
  await p2.getByTestId('addon-add').click();
  await sleep(800);
  const cap = await p2.getByTestId('line-addons').first().innerText().catch(() => '');
  check('phone: the line reads "+ Ice cream ₹30.00"', cap === '+ Ice cream ₹30.00', cap);
  await p2.screenshot({ path: `${dir}/390-line.png` });
  await sleep(4000);
  const draftId = /\/invoices\/([0-9a-f-]{36})/.exec(p2.url())?.[1];
  const doc = draftId ? (await (await phone.request.get(`${base}/api/v1/sales/invoices/${draftId}`)).json()).data : null;
  const l0 = doc?.lines?.[0];
  check('API: the draft holds the add-on snapshot, 2 × ₹150', l0 && Number(l0.qty) === 2 && Number(l0.unit_price) === 150 && l0.addons?.[0]?.name === 'Ice cream', JSON.stringify(l0 && { q: l0.qty, p: l0.unit_price, a: l0.addons }));
  // a plain item opens no sheet
  await p2.getByRole('combobox').first().fill('A5 item');
  await p2.getByRole('option').first().click({ timeout: 10000 });
  await sleep(800);
  check('plain item: no add-on sheet', !(await p2.getByTestId('addon-sheet').isVisible().catch(() => false)));
  const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('phone: no overflow', over <= 0, String(over));
  await phone.close();
} finally {
  await setFeature(desk, false);
  await desk.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
