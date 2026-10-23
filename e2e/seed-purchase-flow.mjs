/**
 * Fills the LOCAL QA tenant's purchase orders and debit notes through the real
 * API, so the purchase registers have more than one page of source-backed rows
 * to sweep (mobile-sales-contract.mjs). `seed_scale` writes purchase bills
 * only; without this the order and debit-note lists are first-use screens.
 *
 *   NODE_PATH=$(npm root -g) node e2e/seed-purchase-flow.mjs [--count=60]
 *
 * Idempotent per kind: a list that already holds `count` rows is left alone.
 * Writes only the local QA tenant; nothing is sent to anybody.
 */
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const COUNT = Number(arg('count', '60'));

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${base}/login/email`);
  await p.fill('input[type=email]', 'scale@digikhaato.test');
  await p.fill('input[type=password]', 'Scale-Run-2026!');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const api = `${base}/api/v1`;
  const get = async (path) => {
    const r = await ctx.request.get(`${api}${path}`);
    if (!r.ok()) throw Error(`GET ${path} ${r.status()}: ${await r.text()}`);
    return r.json();
  };
  const post = async (path, data = {}) => {
    // One key per write, reused on a throttled retry so a write is never doubled.
    const key = crypto.randomUUID();
    for (;;) {
      const r = await ctx.request.post(`${api}${path}`, {
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': key },
        data,
      });
      if (r.status() === 429) {
        const wait = (await r.json()).error?.details?.retry_after ?? 30;
        console.log(`  throttled, waiting ${wait}s`);
        await new Promise((done) => setTimeout(done, (wait + 1) * 1000));
        continue;
      }
      if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
      return (await r.json()).data;
    }
  };
  const all = '&date_from=2020-01-01';
  const suppliers = (await get('/parties?type=supplier&module=shop&page_size=40')).data;
  const items = (await get('/items?status=active&page_size=40')).data;
  if (!suppliers.length || !items.length) throw Error('Local QA tenant has no suppliers or items');
  const pick = (list, i) => list[i % list.length];

  const haveOrders = (await get(`/purchases/orders?page_size=1${all}`)).meta.total ?? 0;
  for (let i = haveOrders; i < COUNT; i += 1) {
    const order = await post('/purchases/orders', {
      party_id: pick(suppliers, i).id,
      lines: [
        { item_id: pick(items, i).id, qty: String(2 + (i % 5)), unit_cost: String(40 + i) },
        { item_id: pick(items, i + 7).id, qty: String(1 + (i % 3)), unit_cost: String(90 + i) },
      ],
    });
    // A tenth stay drafts so the Draft tab is not empty either.
    if (i % 10 !== 0) await post(`/purchases/orders/${order.id}/send`, { version: order.version });
  }
  console.log(`purchase orders: ${Math.max(haveOrders, COUNT)} (had ${haveOrders})`);

  const haveNotes = (await get(`/purchases/debit-notes?page_size=1${all}`)).meta.total ?? 0;
  if (haveNotes < COUNT) {
    const bills = (await get(`/purchases/bills?tab=paid&page_size=200${all}`)).data.filter((row) => row.party);
    if (!bills.length) throw Error('Local QA tenant has no recorded bills from a supplier');
    for (let i = haveNotes; i < COUNT; i += 1) {
      const bill = (await get(`/purchases/bills/${pick(bills, i).id}`)).data;
      await post('/purchases/debit-notes', {
        against_id: bill.id,
        reason: 'goods_returned',
        restock: true,
        lines: [{ bill_line_no: bill.lines[0].line_no, qty: '1' }],
      });
    }
  }
  console.log(`debit notes: ${Math.max(haveNotes, COUNT)} (had ${haveNotes})`);
} finally {
  await browser.close();
}
