// Two jewellery flows through the running app. A purchase page lists bought pieces
// with no weights and fills them in; old gold worth more than the bill pays the
// extra in cash, read back from the payments and the customer's balance. `--skew` must fail.
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
let errs = 0;
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) errs += 1; });
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-jeweller@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
const hdr = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': randomUUID() });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
const post = async (p, data) => { const r = await ctx.request.post(`${api}${p}`, { headers: await hdr(), data }); const j = await r.json(); if (!r.ok()) console.log('  api', p, r.status(), JSON.stringify(j).slice(0, 220)); return j.data; };

const nos = (await get('/units')).find((u) => u.code === 'NOS');
const item = await post('/items', { name: `G4 ring ${run}`, unit_id: nos.id, selling_price: '0', tracking: 'serial', tag: { tag_no: `G4R${run}`, purity: 'gold_22k', gross_g: '1', stone_g: '0', net_g: '1', making_type: 'pct', making_value: '0' } });
const sup = await post('/parties', { name: `G4 Supplier ${run}`, is_supplier: true, state_code: '27' });
const piece = `G4P${run}`;
const bill = await post('/purchases/bills', { party_id: sup.id, lines: [{ item_id: item.id, qty: '1', unit_cost: '5000', serials: [piece] }] });
await post(`/purchases/bills/${bill.id}/record`, { version: bill.version });
await page.goto(`${base}/purchases/bills/${bill.id}`);
const panel = page.getByTestId('bought-pieces');
await panel.waitFor({ timeout: 15000 });
check('the purchase page lists the piece with no weights', (await panel.innerText()).includes(piece));
await page.screenshot({ path: '/tmp/e2e-shots/g4/bought-390.png', fullPage: true });
await panel.getByRole('button').first().click();
const d = page.getByRole('dialog');
await d.getByLabel('Gross').fill('10.000');
await d.getByRole('button', { name: /add|save/i }).last().click();
await panel.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
check('filled in, it leaves the list', (await panel.count()) === 0);
const tags = await get(`/items/${item.id}/tags`);
const row = (tags.rows ?? tags).find((t) => t.tag_no === piece);
check('the weights read back on that piece', row?.net_g === (skew ? '10.001' : '10.000'), JSON.stringify(row?.net_g));

const cust = await post('/parties', { name: `G4 Customer ${run}`, is_customer: true, state_code: '27' });
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
const draft = await post('/sales/invoices', { party_id: cust.id, lines: [{ item_id: item.id, qty: '1', serials: [`G4R${run}`], jewel: {} }], old_gold: { weight_g: '30.000', purity: 'gold_22k', less_pct: '0', cash_back: true } });
const issued = await post(`/sales/invoices/${draft.id}/issue`, { version: draft.version });
const extra = 349500 - Number(issued?.grand_total ?? 0);
const after = await get(`/parties/${cust.id}?book=shop`);
const out = await get(`/payments?party_id=${cust.id}&direction=out`);
const paid = (out.rows ?? out)[0];
check('the bill is settled by the old gold', issued?.status === 'paid', issued?.status);
check('the extra goes out as cash', paid && Math.abs(Number(paid.amount) - extra) < 0.005 && paid.primary_mode === 'cash', `${paid?.amount} / ${extra}`);
check('the customer ends level, no advance left', Number(after?.shop_balance ?? after?.balance) === 0, String(after?.shop_balance ?? after?.balance));
// Monkey seed 42: a tracked piece with no tag went to the server and came back
// refused as "Enter 1 IMEI". The bill now stops it and says what to do.
const bare = await post('/sales/invoices', { lines: [{ item_id: item.id, qty: '1' }] });
check('a saved draft remembers the piece needs a tag', bare?.lines?.[0]?.tracks_serial === true);
let issueCalls = 0;
page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes(`/sales/invoices/${bare?.id}/issue`)) issueCalls += 1; });
await page.goto(`${base}/sales/invoices/${bare?.id}/edit`);
await page.waitForTimeout(1500);
await page.keyboard.press('Control+Enter');
await page.getByText(/add it again to choose its tag/).first().waitFor({ timeout: 6000 }).catch(() => undefined);
check('issue is held back with the words to fix it', (await page.getByText(/add it again to choose its tag/).count()) > 0);
check('nothing was sent to the server', issueCalls === 0, String(issueCalls));
check('no IMEI words on a jeweller\'s bill', (await page.getByText(/IMEI/).count()) === 0);
await ctx.request.delete(`${api}/sales/invoices/${bare?.id}`, { headers: await hdr() });
// LOOK: the table's sideways scroll clipped the search list to one row over the lines.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/sales/invoices/new`);
await page.waitForTimeout(1200);
const finder = page.getByPlaceholder(/Search or scan item/).first();
await finder.click(); await finder.fill('G4 ring');
await page.getByRole('option').first().waitFor({ timeout: 5000 }).catch(() => undefined);
const listH = await page.getByRole('listbox').first().evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 20, r.bottom - 6); return { h: r.height, own: el.contains(top) }; }).catch(() => ({}));
check('the search list is not clipped by the table', listH.own === true, JSON.stringify(listH));
check('no console errors', errs === 0, String(errs));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
