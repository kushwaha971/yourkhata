/**
 * Gives every LOCAL kind shop (/tmp/e2e-shots/kind-shops.json) a small real book through
 * the API, because measuring a register against the design proves nothing on an empty shop:
 * the table is simply "not found" and the run reports no mismatch.
 *
 *   CHROME=<path> E2E_BASE=http://localhost:3005 node e2e/seed-kind-shops.mjs
 *
 * Idempotent per shop: a shop that already has six bills is left alone. Local QA only.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(`${process.cwd()}/frontend/`)('playwright');
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const shops = {
  ...JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json')),
  jewel: { email: 'qa-jeweller@adcert.test', password: 'AdCert-Test-2026!' },
};
const iso = (ago) => new Date(Date.now() - ago * 864e5).toISOString().slice(0, 10);
const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const [kind, shop] of Object.entries(shops)) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${base}/login/email`);
    await p.fill('input[type=email]', shop.email);
    await p.fill('input[type=password]', shop.password);
    await p.click('button[type=submit]');
    await p.waitForURL((u) => !u.pathname.startsWith('/login'));
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const api = `${base}/api/v1`;
    const get = async (path) => (await ctx.request.get(`${api}${path}`)).json();
    const post = async (path, data = {}) => {
      const key = crypto.randomUUID();
      for (;;) {
        const r = await ctx.request.post(`${api}${path}`, {
          headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': key },
          data,
        });
        if (r.status() === 429) {
          await new Promise((done) => setTimeout(done, 31000));
          continue;
        }
        if (!r.ok()) throw Error(`${kind} POST ${path} ${r.status()}: ${(await r.text()).slice(0, 400)}`);
        return (await r.json()).data;
      }
    };
    if (((await get('/sales/invoices?page_size=1')).meta?.total ?? 0) >= 6) {
      console.log(`${kind}: already has a book`);
      await ctx.close();
      continue;
    }
    const customers = (await get('/parties?type=customer&module=shop&page_size=4')).data ?? [];
    const suppliers = (await get('/parties?type=supplier&module=shop&page_size=2')).data ?? [];
    const items = ((await get(`/items?status=active&page_size=3&q=${encodeURIComponent(kind)}`)).data ?? []).filter((it) => it.name.endsWith(kind));
    for (const [i, name] of ['Ramesh Patil', 'Sunita Yadav', 'Anita Verma', 'Mohan Lal'].slice(customers.length).entries())
      customers.push(await post('/parties', { name, is_customer: true, mobile: `98200112${20 + i}`, state_code: '27' }));
    for (const name of ['Om Traders', 'Shree Wholesale'].slice(suppliers.length))
      suppliers.push(await post('/parties', { name, is_supplier: true, is_customer: false, state_code: '27' }));
    const units = (await get('/units')).data;
    const unit = units.find((u) => /^(pcs|piece)/i.test(u.code ?? u.name)) ?? units[0];
    for (const [i, name] of ['First item', 'Second item', 'Third item'].slice(items.length).entries()) {
      const item = await post('/items', { name: `${name} ${kind}`, unit_id: unit.id, selling_price: `${100 * (i + 1 + items.length)}.00`, reorder_point: '5' });
      items.push(item);
    }
    for (const [i, s] of suppliers.entries())
      for (let n = 0; n < 2; n += 1)
        await post('/purchases/bills?record=true', { party_id: s.id, supplier_invoice_number: `SUP-${Date.now() % 100000}-${i}${n}`, supplier_invoice_date: iso(20 + n), document_date: iso(20 + n), due_on: iso(-20), lines: items.map((it, k) => ({ item_id: it.id, qty: k === 2 ? '2' : '40', unit_cost: `${70 * (k + 1)}.00` })) });
    const bills = [];
    for (let i = 0; i < 6; i += 1)
      bills.push(await post('/sales/invoices?issue=true', { party_id: customers[i % 4].id, document_date: iso(i), due_on: iso(i - 7), lines: [{ item_id: items[i % 2].id, qty: '1' }] }));
    for (let i = 0; i < 3; i += 1) {
      const e = await post('/sales/estimates', { party_id: customers[i].id, document_date: iso(i), lines: [{ item_id: items[i].id, qty: '2' }] });
      await post(`/sales/estimates/${e.id}/mark-sent`);
    }
    const cn = await post('/sales/credit-notes', { against_id: bills[0].id, party_id: customers[0].id, document_date: iso(0), reason: 'sales_return', restock: true, lines: [{ item_id: items[0].id, qty: '1', against_line_id: bills[0].lines[0].id }] });
    await post(`/sales/credit-notes/${cn.id}/issue`);
    for (let i = 0; i < 3; i += 1)
      await post('/payments', { direction: 'in', party_id: customers[i].id, amount: '100.00', payment_date: iso(i), mode_breakup: [{ mode: 'cash', amount: '100.00' }] });
    const cats = (await get('/expense-categories')).data;
    for (const [i, note] of ['Tea and snacks', 'Shop rent', 'Electric bill'].entries())
      await post('/expenses', { amount: String(60 * (i + 1)), category_id: cats[i % cats.length].id, expense_date: iso(i), mode: 'cash', note });
    console.log(`${kind}: seeded`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
