// G3 edge cases chance cannot reach (P0 §4.3, §5): the status words by date, the
// on-screen payment sheet with an advance, two tabs on one order, lost reply on
// a save, offline, reload mid-form, Back, a staff member's rights, labels, Hindi.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const dir = '/tmp/e2e-shots/g3e';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const signIn = async (who, viewport = { width: 1280, height: 860 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', `${who}@adcert.test`);
  await page.fill('input[type=password]', 'AdCert-Test-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
};
const { ctx, page } = await signIn('qa-jeweller');
const hdr = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': randomUUID() });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
const post = async (p, data) => (await (await ctx.request.post(`${api}${p}`, { headers: await hdr(), data })).json()).data;
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
const party = await post('/parties', { name: `G3e Lata ${run}`, type: 'customer', is_customer: true });
const today = (await get('/metal-rates/today')).day;
const iso = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mk = (what, days, extra = {}) => post('/sales/custom-orders', { client_key: randomUUID(), party_id: party.id, what, purity: 'gold_22k', deliver_on: iso(days), ...extra });
const search = async (p, q) => { await p.getByPlaceholder('Order, customer or item').fill(q); await p.waitForTimeout(900); };

// E1 the status words by date. A past date cannot be typed, so read today/tomorrow.
await mk(`Today ${run}`, 0);
await mk(`Tomorrow ${run}`, 1);
await page.goto(`${base}/sales/custom-orders`);
await search(page, `Today ${run}`);
check('E1: due today says so', (await page.getByText('Due today').count()) >= 1);
await search(page, `Tomorrow ${run}`);
check('E1: due tomorrow says so', (await page.getByText('Due tomorrow').count()) >= 1);

// E2 a past delivery date: refused on the form, in words
await page.getByPlaceholder('Order, customer or item').fill('');
const past = await ctx.request.post(`${api}/sales/custom-orders`, { headers: await hdr(), data: { client_key: randomUUID(), party_id: party.id, what: 'x', purity: 'gold_22k', deliver_on: iso(-1) } });
check('E2: a past delivery date is refused', past.status() === 400, String(past.status()));

// E3 empty form: errors under boxes, nothing saved
const openCount = (await get('/sales/custom-orders')).open;
await page.getByTestId('custom-order-new').click();
let d = page.getByRole('dialog');
await d.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(1200);
check('E3: an empty form says what is missing', (await d.getByText('Choose the customer.').count()) === 1 && (await d.getByText('Say what to make.').count()) === 1);
await page.screenshot({ path: `${dir}/empty-form-1280.png` });
check('E3: …and saves nothing', (await get('/sales/custom-orders')).open === openCount);

// E4 lost reply: the save reached the server, the answer did not; Save again = one order
await d.getByLabel('Customer').fill(party.name);
await page.getByRole('option', { name: party.name }).first().click();
const lost = `Lost ${run}`;
await d.getByLabel('What to make').fill(lost);
await d.getByText('In 7 days').first().click();
await d.getByRole('textbox', { name: 'Advance' }).fill('500');
let dropped = false;
await page.route('**/sales/custom-orders', async (route) => {
  if (route.request().method() === 'POST' && !dropped) { dropped = true; await route.fetch(); await route.abort(); } else await route.continue();
});
await d.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(1500);
const stillOpen = await d.isVisible();
check('E4: a lost reply keeps the form open', stillOpen);
await d.getByRole('button', { name: 'Save', exact: true }).click();
await d.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
await page.unroute('**/sales/custom-orders');
await page.waitForTimeout(800);
const lostRows = (await get(`/sales/custom-orders?q=${encodeURIComponent(lost)}`)).rows;
check('E4: saving again is one order, one advance', lostRows.length === 1, String(lostRows.length));

// E5 reload mid-form: does it warn or keep? (recorded honestly)
await page.getByTestId('custom-order-new').click();
await page.getByRole('dialog').getByLabel('What to make').fill('half typed');
await page.reload();
await page.getByTestId('custom-orders').waitFor({ timeout: 15000 });
check('E5: reload mid-form does not crash or save', (await get(`/sales/custom-orders?q=half%20typed`)).rows.length === 0);

// E6 two tabs: mark ready and delivered in one, the other still shows Mark ready
const twoWhat = `Two ${run}`;
const two = await mk(twoWhat, 5);
const tab2 = await ctx.newPage();
for (const p of [page, tab2]) { await p.goto(`${base}/sales/custom-orders`); await search(p, twoWhat); }
await page.getByRole('button', { name: 'Mark ready' }).first().click();
await page.waitForTimeout(800);
await tab2.getByRole('button', { name: 'Mark ready' }).first().click();
await tab2.waitForTimeout(1200);
check('E6: a stale tab is refused, status unchanged', (await get(`/sales/custom-orders/${two.id}`)).status === 'ready');
const tabMsg = await tab2.getByRole('alert').first().innerText().catch(() => '');
check('E6: the stale tab says something', tabMsg.length > 0, tabMsg.slice(0, 70));
await tab2.close();

// E7 offline: moving an order says so, and nothing changes
const offWhat = `Off ${run}`;
const off = await mk(offWhat, 5);
await page.goto(`${base}/sales/custom-orders`);
await search(page, offWhat);
await ctx.setOffline(true);
await page.getByRole('button', { name: 'Mark ready' }).first().click();
await page.waitForTimeout(1500);
await ctx.setOffline(false);
check('E7: offline changes nothing', (await get(`/sales/custom-orders/${off.id}`)).status === 'open');
check('E7: and the screen says so', (await page.getByRole('alert').count()) > 0 || (await page.getByText(/Couldn't|offline|internet/i).count()) > 0);

// E8 the on-screen payment sheet on a bill with an advance
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const tag = `EB-${run}`;
await post('/items', { name: `G3e chain ${run}`, unit_id: nos.id, selling_price: '0', tracking: 'serial', tag: { tag_no: tag, purity: 'gold_22k', gross_g: '12.34', net_g: '12.34', making_type: 'pct', making_value: '12' } });
const billWhat = `Bill ${run}`;
const billOrder = await mk(billWhat, 5, { advance: '50000', advance_mode: 'upi', fix_rate: true });
await page.goto(`${base}/sales/custom-orders`);
await search(page, billWhat);
await page.getByTestId('custom-order-bill').first().click();
await page.getByTestId('bill-order-note').waitFor({ timeout: 15000 });
const box = page.getByPlaceholder(/Search or scan item|Search item or scan/).first();
await box.click(); await box.fill(tag); await box.press('Enter');
await page.getByTestId('line-jewel').first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /^Issue/ }).locator('visible=true').first().click();
const sheet = page.getByRole('dialog');
await sheet.waitFor({ timeout: 10000 });
await sheet.getByText(/₹/).first().waitFor({ timeout: 10000 }).catch(() => undefined);
const sheetText = (await sheet.innerText()).replace(/\s+/g, ' ');
await page.screenshot({ path: `${dir}/payment-sheet.png` });
check('E8: the sheet asks To pay, not the whole bill', sheetText.includes('1,11,012') && !sheetText.includes('1,61,012'), sheetText.slice(0, 120));
await sheet.getByRole('button').filter({ hasText: /₹1,11,012|Confirm|Take|Record/ }).first().click();
await page.waitForTimeout(3500);
const delivered = await get(`/sales/custom-orders/${billOrder.id}`);
check('E8: issued from the sheet, the order is delivered', delivered.status === 'delivered', delivered.status);
const bill = delivered.invoice_id ? await get(`/sales/invoices/${delivered.invoice_id}`) : null;
check('E8: the bill is paid, cash + advance', bill?.status === 'paid', `${bill?.status} ${bill?.amount_paid}`);
await page.screenshot({ path: `${dir}/after-issue.png` });
await page.keyboard.press('Escape').catch(() => undefined);

// E9 a finished bill is locked; the order cannot be billed twice
const again = await ctx.request.post(`${api}/sales/custom-orders/${billOrder.id}/status`, { headers: await hdr(), data: { status: 'cancelled' } });
check('E9: a delivered order cannot be cancelled', again.status() === 409, String(again.status()));

// E10 labels: does the label name the tag?
const tag2 = `EL-${run}`;
await post('/items', { name: `G3e ring ${run}`, unit_id: nos.id, selling_price: '0', tracking: 'serial', tag: { tag_no: tag2, purity: 'gold_22k', gross_g: '12.34', net_g: '12.34', making_type: 'pct', making_value: '12', huid: '7K2P9X' } });
const labelled = await get(`/items?q=${encodeURIComponent(`G3e ring ${run}`)}`);
await page.goto(`${base}/items/labels?item=${labelled[0].id}`);
await page.waitForTimeout(2500);
const labelText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
await page.screenshot({ path: `${dir}/labels.png`, fullPage: true });
check('E10: the labels page shows the tag no.', labelText.includes(tag2), labelText.slice(0, 160));
check('E10: …its net weight', labelText.includes('12.340'));
check('E10: …purity, and no ₹0.00 on the piece', labelText.includes('22K 916') && !labelText.includes(`${tag2} · ₹`));
const svg = await page.getByTestId('barcode-label').first().locator('svg').getAttribute('aria-label').catch(() => '');
check('E10: the bars hold the tag no. the bill scans', svg === tag2, svg ?? '');

// E14 a tagged item picked by name offers its tags (monkey seed 33)
await page.goto(`${base}/sales/invoices/new`);
await page.waitForTimeout(800);
const nameBox = page.getByPlaceholder(/Search or scan item|Search item or scan/).first();
await nameBox.click(); await nameBox.fill(`G3e ring ${run}`);
await page.getByRole('option', { name: new RegExp(`G3e ring ${run}`) }).first().click();
const choice = page.getByTestId('tag-choice');
await choice.waitFor({ timeout: 8000 }).catch(() => undefined);
await page.screenshot({ path: `${dir}/tag-choice.png` });
check('E14: picking by name offers the tag', (await choice.getByText(tag2).count()) === 1);
await choice.getByText(tag2).click();
await page.getByTestId('line-jewel').first().waitFor({ timeout: 8000 }).catch(() => undefined);
check('E14: the piece arrives priced by weight', (await page.getByTestId('line-jewel').first().innerText().catch(() => '')).includes(tag2));
check('E14: nothing asks for an IMEI', (await page.getByText(/IMEI/).count()) === 0);

// E11 staff: qa-jstaff may not break anything they should not
const st = await signIn('qa-jstaff');
const r = await st.ctx.request.get(`${api}/sales/custom-orders`);
console.log(`     staff can read orders: ${r.status()}`);
const stHdr = { 'X-CSRF-Token': (await st.ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' };
const costly = await st.ctx.request.get(`${api}/sales/karigars`);
console.log(`     staff karigars: ${costly.status()}`);
const lot = await post(`/sales/karigars/${(await post('/sales/karigars', { name: `Staff ${run}` })).id}/issue`, { weight_g: '5', purity: 'gold_22k', client_key: randomUUID() });
const del = await st.ctx.request.delete(`${api}/sales/karigar-lots/${lot.id}`, { headers: stHdr });
console.log(`     staff removing a lot: ${del.status()}`);
check('E11: staff answers are permissions, not crashes', r.status() < 500 && del.status() < 500);
await st.ctx.close();

// E12 another business cannot reach this one's order
const other = await signIn('qa-owner');
check('E12: another business gets no order by id', (await other.ctx.request.get(`${api}/sales/custom-orders/${billOrder.id}`)).status() === 404);
await other.ctx.close();

// E13 Hindi: every new dialog, no raw ids
const hi = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width: 390, height: 800 } });
await hi.addCookies([{ name: 'ub_locale', value: 'hi', domain: new URL(base).hostname, path: '/' }]);
const hp = await hi.newPage();
await hp.goto(`${base}/sales/custom-orders`);
await hp.getByTestId('karigars').waitFor({ timeout: 15000 });
await hp.waitForTimeout(800);
const RAW = /\b(sales|items|nav)\.[a-zA-Z]+\.[a-zA-Z.]+/;
check('E13: page has no raw ids in Hindi', !RAW.test(await hp.locator('body').innerText()));
for (const id of ['custom-order-new', 'karigar-add', 'karigar-issue']) {
  await hp.getByTestId(id).click();
  await hp.getByRole('dialog').waitFor({ timeout: 10000 });
  await hp.waitForTimeout(400);
  check(`E13: ${id} dialog has no raw ids`, !RAW.test(await hp.getByRole('dialog').innerText()));
  await hp.screenshot({ path: `${dir}/hi-${id}.png` });
  await hp.keyboard.press('Escape');
  await hp.waitForTimeout(400);
}
await hi.close();
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
