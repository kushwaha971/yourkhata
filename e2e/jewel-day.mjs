// A jeweller's whole day, through the screens where a merchant works, every figure
// read back from the API (P0 section 9). --skew expects a wrong day total: must fail.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/jewel-day';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
let errs = 0;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const signIn = async (who, viewport) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) { errs += 1; console.log(m.text().slice(0, 170)); } });
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', `${who}@adcert.test`);
  await page.fill('input[type=password]', 'AdCert-Test-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return { ctx, page };
};
const { ctx, page } = await signIn('qa-jeweller', { width: 390, height: 800 });
const hdr = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': randomUUID() });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
const post = async (p, data) => (await (await ctx.request.post(`${api}${p}`, { headers: await hdr(), data })).json()).data;
const money = (s) => Number(String(s).replace(/[^\d.]/g, ''));
for (const old of (await get('/sales/karigars')).open_lots) await post(`/sales/karigar-lots/${old.id}/receive`, { received_g: '0' });
for (const old of (await get('/sales/karigars')).to_tag) await post(`/sales/karigar-lots/${old.id}/tags-done`, {});

// Morning: the rate, on the phone
await page.goto(`${base}/stock/rates`);
const box = page.getByRole('textbox', { name: /22K/ }).first();
await box.waitFor({ timeout: 15000 });
await box.fill('11650');
await page.getByRole('button', { name: /Save/ }).first().click();
await page.waitForTimeout(1200);
check('morning: the 22K rate is saved through the screen', (await get('/metal-rates/today')).today?.rates?.gold_22k?.startsWith('11650'));
await page.goto(`${base}/dashboard`);
const home = page.getByTestId('jewel-home');
await home.waitFor({ timeout: 15000 });
const before = await get('/sales/jewel-home');
const rateTile = await page.getByTestId('jewel-home-rate').innerText();
check('home: the strip says today\'s rate', rateTile.includes('11,650'), rateTile.replace(/\s+/g, ' '));
check('home: orders due match the API', (await page.getByTestId('jewel-home-orders').innerText()).includes(String(before.orders_due)));
await page.screenshot({ path: `${dir}/home-390.png` });

// Set-up the shop already has
const name = `Day Meena ${run}`;
const party = await post('/parties', { name, type: 'customer', is_customer: true });
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const itemName = `Day chain ${run}`;
const item = await post('/items', { name: itemName, unit_id: nos.id, selling_price: '0', tracking: 'serial' });
const k = await post('/sales/karigars', { name: `Raju ${run}`, wastage_limit_pct: '1.5' });

// 10 am: an order with an advance, a karigar and a photo, on the phone
await page.goto(`${base}/sales/custom-orders`);
await page.getByTestId('custom-order-new').click();
let d = page.getByRole('dialog');
await d.getByLabel('Customer').fill(name);
await page.getByRole('option', { name: new RegExp(name) }).first().click();
const what = `Mangalsutra ${run}`;
await d.getByLabel('What to make').fill(what);
await d.getByLabel('Approx. weight').fill('18');
await d.getByText('In 7 days').first().click();
await d.getByRole('textbox', { name: 'Advance' }).fill('50000');
await d.getByRole('switch', { name: /Fix the rate now/ }).click();
const pngB64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 100; c.height = 100; c.getContext('2d').fillRect(0, 0, 100, 100); return c.toDataURL('image/png').split(',')[1]; });
await d.locator('input[type=file]').setInputFiles({ name: 'design.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64') });
await d.getByRole('button', { name: 'Save', exact: true }).click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1200);
let order = (await get(`/sales/custom-orders?q=${encodeURIComponent(what)}`)).rows[0];
check('order: rate fixed, advance held', order?.fixed_rate === '11650.00' && order?.advance === '50000.00');
check('order: the design photo is kept', Boolean(order?.photo_id));
check('order: the photo can be read back', (await ctx.request.get(`${api}/files/${order?.photo_id}`)).ok());

// 11 am: gold to the karigar; part back; the rest back
const lot = await post(`/sales/karigars/${k.id}/issue`, { weight_g: '37.4', purity: 'gold_22k', order_id: order.id, client_key: randomUUID() });
await page.reload();
const lotRow = page.getByTestId('karigar-lot').filter({ hasText: k.name });
await lotRow.getByRole('button', { name: 'Receive back' }).click();
d = page.getByRole('dialog');
await d.getByLabel('Weight received').fill('20');
await d.getByRole('switch', { name: /More to come/ }).click();
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
let row = (await get('/sales/karigars')).rows.find((r) => r.id === k.id);
check('afternoon: part back leaves 17.400 g out', row.with_g === '17.400', row.with_g);
const rest = (await get('/sales/karigars')).open_lots.find((l) => l.karigar.id === k.id);
await post(`/sales/karigar-lots/${rest.id}/receive`, { received_g: '16.88' });
row = (await get('/sales/karigars')).rows.find((r) => r.id === k.id);
check('afternoon: all back is 1.4% within the limit', row.wastage_pct === '1.4' && !row.over_limit, row.wastage_pct);

// 3 pm: a piece from that gold, through the form
await page.reload();
const toTag = page.getByTestId('karigar-to-tag').filter({ hasText: k.name }).first();
await toTag.getByTestId('karigar-make-tag').click();
d = page.getByRole('dialog');
await d.getByLabel('Tag no.').waitFor({ timeout: 10000 });
await d.getByPlaceholder('Choose the item').fill(itemName);
await page.getByRole('option', { name: itemName }).first().click();
const tag = `DY-${run}`;
await d.getByLabel('Tag no.').fill(tag);
await d.getByLabel('Gross').fill('20');
await d.getByLabel('Making', { exact: true }).fill('12');
await d.getByLabel('HUID').fill('7K2P9X');
await d.getByLabel('Labour').fill('350');
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
await page.waitForTimeout(1000);
check('tag: the piece is in stock', (await ctx.request.get(`${api}/jewel-tags/lookup?tag=${tag}`)).ok());
const labelPage = await ctx.newPage();
await labelPage.goto(`${base}/items/labels?item=${item.id}`);
await labelPage.getByTestId('barcode-label').first().waitFor({ timeout: 10000 });
check('tag: the label bars hold the tag no.', (await labelPage.getByTestId('barcode-label').first().locator('svg').getAttribute('aria-label')) === tag);
await labelPage.close();

// Ready: tell the customer
await page.reload();
await page.getByPlaceholder('Order, customer or item').fill(what);
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'Mark ready' }).first().click();
await page.getByTestId('custom-order-tell').first().waitFor({ timeout: 8000 });
await page.getByTestId('custom-order-tell').first().click();
const box2 = page.getByRole('dialog').getByRole('textbox').first();
await box2.waitFor({ timeout: 8000 });
const words = await box2.inputValue();
check('ready: the message is there to read and edit, naming the shop and not the product', words.includes(order.number) && words.includes('QA Jewellery') && !/YourKhata/i.test(words), words.slice(0, 90));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 5 pm: the bill. Old gold, advance, the fixed rate after the rate has moved, PAN
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '12000' } });
await page.getByTestId('custom-order-bill').first().click();
await page.getByTestId('bill-order-note').waitFor({ timeout: 15000 });
const search = page.getByPlaceholder(/Search or scan item|Search item or scan/).first();
await search.click(); await search.fill(tag); await search.press('Enter');
await page.getByTestId('line-jewel').first().waitFor({ timeout: 10000 });
await page.getByTestId('jewel-pan').fill('abcpk1234l');
await page.getByTestId('old-gold-add').click();
const sheet = page.getByTestId('old-gold-sheet');
await sheet.getByLabel('Weight').fill('8.2');
await sheet.getByLabel('Less (melting)').fill('2');
await sheet.getByLabel('Rate').fill('11650');
await page.getByTestId('old-gold-take').click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${dir}/bill-390.png`, fullPage: true });
// 20 g × 11,650 = 2,33,000; 12% = 27,960: 2,60,960.
const price = 260960;
const toPayText = money(await page.getByTestId('invoice-to-pay').first().innerText());
const want = (skew ? 1 : 0) + price - 93619.4 - 50000;
check(`bill: To pay = ₹${want} (fixed rate, less old gold and advance)`, Math.abs(toPayText - want) < 1, String(toPayText));
await page.getByRole('button', { name: /^Issue/ }).locator('visible=true').first().click();
const pay = page.getByRole('dialog');
await pay.getByText(/₹/).first().waitFor({ timeout: 10000 });
await pay.getByRole('button').filter({ hasText: /₹1,17,341|₹1,17,340|Confirm|Take|Record/ }).first().click();
await page.waitForTimeout(3500);
order = await get(`/sales/custom-orders/${order.id}`);
check('evening: the order is delivered by the bill', order.status === 'delivered' && Boolean(order.invoice_id), order.status);
const bill = await get(`/sales/invoices/${order.invoice_id}`);
check('evening: the bill is paid, and keeps PAN and the fixed rate', bill.status === 'paid' && bill.pan === 'ABCPK1234L' && bill.lines[0].jewel.rate === '11650.00', `${bill.status} ${bill.pan} ${bill.lines[0].jewel.rate}`);
check('evening: the tag is sold', (await ctx.request.get(`${api}/jewel-tags/lookup?tag=${tag}`)).status() === 404);
await page.goto(`${base}/sales/invoices/${bill.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.emulateMedia({ media: 'print' });
const printed = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
await page.emulateMedia({ media: 'screen' });
for (const w of ['ABCPK1234L', 'HUID 7K2P9X', 'Rates used', 'Old gold taken in', 'Buy-back as per shop policy']) check(`print: ${w}`, printed.includes(w));
check('print: names the shop, never the product', !/YourKhata|DigiKhaato/i.test(printed));

// Close: other screens agree without being told
await page.goto(`${base}/sales/old-gold`);
await page.getByTestId('old-gold-page').waitFor({ timeout: 15000 });
const og = await get('/sales/old-gold');
check('close: old gold lists this bill', og.rows[0].bill_id === bill.id && og.rows[0].value === '93619.40');
check('close: its stock line says the API figure', (await page.getByTestId('old-gold-stock').innerText()).includes(og.stock.find((s) => s.purity === 'gold_22k').weight_g));
await page.screenshot({ path: `${dir}/old-gold-390.png` });
await page.goto(`${base}/dashboard`);
await page.getByTestId('jewel-home').waitFor({ timeout: 15000 });
const after = await get('/sales/jewel-home');
check('close: old gold this month rose by 8.2 g', Math.abs(Number(after.old_gold_month_g) - Number(before.old_gold_month_g) - 8.2) < 0.0005);
const pm = await get(`/payments?party_id=${party.id}`);
const list = Array.isArray(pm) ? pm : [];
const cashLike = list.filter((p) => p.primary_mode !== 'adjustment').reduce((sum, p) => sum + Number(p.amount), 0);
check('close: only real money counts as money: old gold is a no-money settlement', list.some((p) => p.primary_mode === 'adjustment') && cashLike > 0, `real ${cashLike}`);

// Staff: can bill, cannot remove gold
const st = await signIn('qa-jstaff', { width: 1280, height: 800 });
const lot2 = await post(`/sales/karigars/${k.id}/issue`, { weight_g: '1', purity: 'gold_22k', client_key: randomUUID() });
const csrf = (await st.ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
const del = await st.ctx.request.delete(`${api}/sales/karigar-lots/${lot2.id}`, { headers: { 'X-CSRF-Token': csrf } });
check('staff: cannot remove a lot', del.status() === 403, String(del.status()));
await post(`/sales/karigar-lots/${lot2.id}/receive`, { received_g: '1' });
await st.ctx.close();
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${errs} console errors${skew ? ' (SKEWED)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || errs ? 1 : 0;
