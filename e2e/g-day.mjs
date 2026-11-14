/**
 * Part G module round (P0 §9) — whole-day journeys on the LOCAL QA stack:
 * each step is done once and READ BACK on every screen that shows it.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/g-day.mjs [--shots=/tmp/e2e-shots/g-day]
 *
 *  Kirana: a phone order → its bill on udhaar → the customer's balance on the
 *  API, the customer's page and Customers → out for delivery → delivered →
 *  the money collected next visit → balance back to zero on the same screens.
 *  Café: an advance order for tomorrow shows in Home's Follow-ups → its bill
 *  applies the advance → it leaves Follow-ups and the Advance orders board.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '/tmp/e2e-shots/g-day');
mkdirSync(SHOTS, { recursive: true });
const shops = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const inr = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const open = async (shop, width = 1280) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', shop.email);
  await page.fill('input[type=password]', shop.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const api = async (method, path, data) =>
    (
      await ctx.request.fetch(`${base}/api/v1${path}`, {
        method,
        data,
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      })
    ).json();
  return { ctx, page, api };
};
const text = async (page, path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return page.locator('main').innerText();
};

try {
  // ── Kirana ───────────────────────────────────────────────────────────────
  {
    const { ctx, page, api } = await open(shops.kirana);
    const stamp = Date.now().toString(36).slice(-5);
    const units = (await api('GET', '/units')).data;
    const kg = units.find((u) => u.code === 'KGS').id;
    const atta = (await api('POST', '/items', { name: `QAD Atta ${stamp}`, unit_id: kg, selling_price: '52', purchase_price: '40', tax_code: 'GST0', opening_stock: { qty: '50', unit_cost: '40' } })).data;
    const item = atta.item ?? atta;
    const name = `QAD Sunita ${stamp}`;
    const party = (await api('POST', '/parties', { name, mobile: `91${String(Date.now()).slice(-8)}`, type: 'customer' })).data;
    const balance = async () => Number((await api('GET', `/parties/${party.id}?book=shop`)).data.shop.customer_balance);
    const order = (await api('POST', '/sales/phone-orders', { client_key: crypto.randomUUID(), party_id: party.id, lines: [{ item_id: item.id, qty: '5' }], fulfil: 'home', pay: 'udhaar' })).data;
    check('kirana: the phone order is to pack', order.status === 'to_pack' && order.total === '260.00');
    const bill = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: item.id, qty: '5' }], phone_order_id: order.id })).data;
    const issued = (await api('POST', `/sales/invoices/${bill.id}/issue`, { version: bill.version })).data;
    check('kirana: its bill went on udhaar', Number(issued.amount_due) === 260);
    check('kirana: the customer owes ₹260 (API)', (await balance()) === 260, String(await balance()));
    const custPage = await text(page, `/parties/${party.id}`);
    await page.screenshot({ path: `${SHOTS}/kirana-customer-owes.png` });
    check("kirana: the customer's page shows ₹260", custPage.includes(inr(260)), `${page.url().replace(base, '')} · ${custPage.replace(/\n/g, ' | ').slice(0, 220)}`);
    const list = await text(page, `/customers?q=${encodeURIComponent(name)}`);
    check('kirana: Customers shows them owing ₹260', list.includes(name) && list.includes(inr(260)));
    const board = await text(page, '/sales/phone-orders');
    check('kirana: the order left To pack', !board.includes(order.number));
    await api('POST', `/sales/phone-orders/${order.id}/status`, { status: 'delivered' });
    const delivered = (await api('GET', '/sales/phone-orders?stage=delivered')).data;
    check('kirana: it is in Delivered today', delivered.some((o) => o.id === order.id));

    // The next visit: the money comes in against the bill.
    await api('POST', '/payments', {
      direction: 'in',
      party_id: party.id,
      mode_breakup: [{ mode: 'cash', amount: '260.00' }],
      allocations: [{ document_type: 'sales_document', document_id: bill.id, amount: '260.00' }],
    });
    check('kirana: after paying the balance is zero (API)', (await balance()) === 0, String(await balance()));
    const after = await text(page, `/parties/${party.id}`);
    // Positive and negative: ₹0.00 is on the page, and the ₹260 to collect is not (a 404 passes neither).
    check(
      "kirana: the customer's page shows ₹0.00 and no ₹260 to collect",
      after.includes(`₹${inr(0)}`) && !after.includes(`To collect, ₹${inr(260)}`),
      after.replace(/\n/g, ' | ').slice(0, 200)
    );
    const billNow = (await api('GET', `/sales/invoices/${bill.id}`)).data;
    check('kirana: the bill is paid', Number(billNow.amount_due ?? billNow.document?.amount_due) === 0);
    await page.screenshot({ path: `${SHOTS}/kirana-customer.png` });
    await ctx.close();
  }

  // ── Café ─────────────────────────────────────────────────────────────────
  {
    const { ctx, page, api } = await open(shops.cafe);
    const stamp = Date.now().toString(36).slice(-5);
    const units = (await api('GET', '/units')).data;
    const nos = units.find((u) => u.code === 'NOS').id;
    const made = (await api('POST', '/items', { name: `QAD Box ${stamp}`, unit_id: nos, selling_price: '720', purchase_price: '400', tax_code: 'GST0', opening_stock: { qty: '20', unit_cost: '400' } })).data;
    const box = made.item ?? made;
    const party = (await api('POST', '/parties', { name: `QAD Kavya ${stamp}`, mobile: `90${String(Date.now()).slice(-8)}`, type: 'customer' })).data;
    const tomorrow = new Date(Date.now() + 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    const order = (await api('POST', '/sales/cafe-orders', { client_key: crypto.randomUUID(), kind: 'advance', party_id: party.id, ready_at: `${tomorrow}T11:00`, advance: '500', advance_mode: 'cash', lines: [{ item_id: box.id, qty: '2' }] })).data;
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    const follow = page.getByTestId('home-followups');
    await follow.getByText(order.number, { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => undefined);
    check("café: Home's Follow-ups lists the advance order", (await follow.innerText()).includes(order.number));
    await page.screenshot({ path: `${SHOTS}/cafe-home.png` });
    const bill = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: box.id, qty: '2' }], cafe_order_id: order.id })).data;
    const issued = (await api('POST', `/sales/invoices/${bill.id}/issue`, { version: bill.version })).data;
    check('café: the bill applies the ₹500 advance', Number(issued.amount_paid) === 500 && Number(issued.amount_due) === 940);
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    check("café: it left Home's Follow-ups", !(await page.getByTestId('home-followups').innerText()).includes(order.number));
    const advance = (await api('GET', '/sales/cafe-orders?scope=advance')).data;
    check('café: it left the Advance orders board', !advance.some((o) => o.id === order.id));
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
