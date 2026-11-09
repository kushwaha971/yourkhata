/**
 * G6 — exchange at the counter on the LOCAL QA stack, as the clothes kind shop.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/exchange.mjs [--shots=/tmp/e2e-shots/exchange]
 *
 * A paid bill for two pieces; from the bill, Exchange; tick one back, scan a
 * cheaper item out; the dock's figures equal what Done then makes (self-tested),
 * stock moves both ways and the rest stays as credit, never cash.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).garments;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const api = async (method, path, data) =>
      (await ctx.request.fetch(`${base}/api/v1${path}`, {
        method, data, headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      })).json();
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const units = (await api('GET', '/units')).data;
    const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
    const item = async (name, price) => {
      const body = await api('POST', '/items', { name, unit_id: nos, selling_price: price, purchase_price: '10', tax_code: 'GST5', opening_stock: { qty: '10', unit_cost: '10' } });
      return body.data.item ?? body.data;
    };
    const shirt = await item(`QA96 Shirt M ${stamp}`, '599');
    const socks = await item(`QA96 Socks ${stamp}`, '99');
    const party = (await api('POST', '/parties', { name: `QA96 Customer ${stamp}`, mobile: `97${String(Date.now()).slice(-8)}`, type: 'customer' })).data;
    const draft = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: shirt.id, qty: '2' }] })).data;
    const bill = (await api('POST', `/sales/invoices/${draft.id}/issue`, { version: draft.version, payment: { mode_breakup: [{ mode: 'cash', amount: draft.grand_total }] } })).data;
    check(`${width}: the paid bill was made`, bill?.status === 'paid' || Number(bill?.amount_due) === 0, bill?.number);

    await page.goto(`${base}/sales/invoices/${bill.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'More actions' }).first().click();
    const link = page.getByRole('dialog').last().getByText('Exchange', { exact: true });
    check(`${width}: the bill offers Exchange`, (await link.count()) > 0);
    await page.goto(`${base}/sales/exchange?against=${bill.id}`, { waitUntil: 'networkidle' });
    const done = page.getByTestId('exchange-done');
    check(`${width}: Done waits until something is chosen`, await done.isDisabled());
    await page.getByTestId('exchange-back').getByRole('checkbox').first().click();
    const box = page.getByRole('combobox', { name: 'Scan or search' });
    await box.click();
    await page.keyboard.type(`QA96 Socks ${stamp}`);
    await page.getByRole('option', { name: new RegExp(`Socks ${stamp}`) }).first().click();
    await page.waitForFunction(() => !document.querySelector('[data-testid=exchange-done]').disabled, null, { timeout: 10000 });
    const dock = await page.getByTestId('exchange-dock').innerText();
    const totals = await page.getByTestId('exchange-totals').innerText();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/exchange-${width}.png`, fullPage: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: no sideways scroll`, over <= 0, `${over}px`);
    check(`${width}: no raw message key`, !/\b(common|sales)\.[a-zA-Z.]+/.test(await page.locator('main').innerText()));
    const stockOf = async (id) => Number((await api('GET', `/items/${id}`)).data.stock?.on_hand ?? (await api('GET', `/items/${id}`)).data.on_hand);
    const [s0, k0] = [await stockOf(shirt.id), await stockOf(socks.id)];
    await done.dblclick();
    await page.waitForURL(/\/sales\/invoices\/[0-9a-f-]{36}$/, { timeout: 15000 });
    const newId = page.url().split('/').pop();
    const made = (await api('GET', `/sales/invoices/${newId}`)).data;
    check(`${width}: the new bill is a different, issued bill`, newId !== bill.id && !!made.number, made.number);
    check(`${width}: nothing is left to pay`, Number(made.amount_due) === 0 && /Nothing to pay/.test(dock), dock.replace(/\n/g, ' '));
    const notes = (await api('GET', `/sales/credit-notes?party=${party.id}&page_size=50`)).data.filter((n) => n.against_id === bill.id || n.against?.id === bill.id);
    check(`${width}: a double tap made one credit note`, notes.length === 1, String(notes.length));
    const expected = Number(bill.grand_total) / 2 - Number(made.grand_total);
    const left = Number(notes[0]?.amount_due ?? -1);
    check(`${width}: the rest stays as credit`, Math.abs(left - expected) <= 1, `${left} vs ${expected}`);
    check(`${width}: self-test — ₹50 more would fail`, Math.abs(left + 50 - expected) > 1);
    check(`${width}: the screen said the same credit`, totals.replace(/,/g, '').includes(String(Math.round(left))) , totals.split('\n').join(' ').slice(0, 90));
    check(`${width}: the shirt came back and the socks went out`, (await stockOf(shirt.id)) === s0 + 1 && (await stockOf(socks.id)) === k0 - 1);
    check(`${width}: no page errors`, errors.length === 0, errors[0] ?? '');
    await ctx.close();
  }
} catch (error) {
  check('harness ran to the end', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
