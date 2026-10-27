/**
 * Fills the LOCAL QA tenant's estimates, sales orders, delivery challans and
 * credit-note drafts through the real API, so the sales-document registers have
 * more than one page of source-backed rows to sweep (revamp-bills.mjs and
 * mobile-sales-contract.mjs). `seed_scale` writes invoices only, and a fresh
 * container's QA tenant otherwise shows every one of these lists empty, which
 * turns every "ready" frame into a first-use frame.
 *
 *   NODE_PATH=$(npm root -g) node e2e/seed-sales-flow.mjs [--count=60]
 *
 * Idempotent per kind: a list that already holds `count` rows is left alone.
 * Writes only the local QA tenant; nothing is sent to anybody.
 */
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
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
  const customers = (await get('/parties?type=customer&module=shop&page_size=40')).data;
  const items = (await get('/items?status=active&page_size=40')).data;
  if (!customers.length || !items.length) throw Error('Local QA tenant has no customers or items');
  const pick = (list, i) => list[i % list.length];
  const lines = (i) => [
    { item_id: pick(items, i).id, qty: String(1 + (i % 5)) },
    { item_id: pick(items, i + 7).id, qty: String(2 + (i % 3)) },
  ];

  const flows = [
    ['estimates', 'estimates', 'mark-sent'],
    ['orders', 'orders', 'confirm'],
    ['delivery-challans', 'delivery challans', 'issue'],
  ];
  for (const [slug, label, verb] of flows) {
    const have = (await get(`/sales/${slug}?page_size=1`)).meta.total ?? 0;
    for (let i = have; i < COUNT; i += 1) {
      const doc = await post(`/sales/${slug}`, { party_id: pick(customers, i).id, lines: lines(i) });
      // A tenth stay drafts so the Draft tab is not empty either.
      if (i % 10 !== 0) await post(`/sales/${slug}/${doc.id}/${verb}`);
    }
    console.log(`${label}: ${Math.max(have, COUNT)} (had ${have})`);
  }

  const haveNotes = (await get('/sales/credit-notes?tab=draft&page_size=1')).meta.total ?? 0;
  if (haveNotes < COUNT) {
    // A return needs a saved customer; quick-sale bills are refused by the server.
    const paid = (await get('/sales/invoices?tab=paid&page_size=200')).data.filter((row) => row.party);
    if (!paid.length) throw Error('Local QA tenant has no paid bills to a saved customer');
    for (let i = haveNotes; i < COUNT; i += 1) {
      const invoice = (await get(`/sales/invoices/${pick(paid, i).id}`)).data;
      await post('/sales/credit-notes', {
        against_id: invoice.id,
        reason: 'sales_return',
        lines: [{ against_line_id: invoice.lines[0].id, qty: '1' }],
      });
    }
  }
  console.log(`credit-note drafts: ${Math.max(haveNotes, COUNT)} (had ${haveNotes})`);
} finally {
  await browser.close();
}
