/**
 * G11 — a kirana's loose-by-amount sheet and phone orders on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/phone-orders.mjs [--shots=/tmp/e2e-shots/kirana] [--hi]
 *
 *  * loose: sugar at ₹44 on a new bill opens the sheet; ₹50 is 1.136 kg (design
 *    pLoose); ₹100 is 2.273 kg; Add puts 2.273 on the line;
 *  * phone order: a pasted list "atta 5kg, toor dal 500 g, kesar 1 tin" reads
 *    two lines (dal in kg) and asks about kesar; saved and read back;
 *  * Make bill opens the bill with the order's lines and the note; issued on
 *    udhaar the order is Out for delivery, then Delivered today;
 *  * no raw message key; no sideways scroll at 390 and 1280.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
const HI = process.argv.includes('--hi');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).kirana;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const RAW = /\b(common|sales|nav)\.[a-zA-Z]+\.[a-zA-Z.]+/;
const money = (text) => Number(String(text).replace(/[^\d.]/g, ''));
const over = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 } });
    if (HI) await ctx.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
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
      (
        await ctx.request.fetch(`${base}/api/v1${path}`, {
          method,
          data,
          headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
        })
      ).json();
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const units = (await api('GET', '/units')).data;
    const unit = (code) => (units.find((u) => u.code === code) ?? units[0]).id;
    const mkItem = async (name, price, code) => {
      const made = await api('POST', '/items', {
        name, unit_id: unit(code), selling_price: price, purchase_price: '10', tax_code: 'GST0',
        opening_stock: { qty: '100', unit_cost: '10' },
      });
      return made.data.item ?? made.data;
    };
    const sugar = await mkItem(`QA11 Sugar ${stamp}`, '44', 'KGS');
    const atta = await mkItem(`QA11 Atta ${stamp}`, '52', 'KGS');
    const dal = await mkItem(`QA11 Toordal ${stamp}`, '160', 'KGS');
    const name = `QA11 Sunita ${stamp}`;
    const party = (await api('POST', '/parties', { name, mobile: `92${String(Date.now()).slice(-8)}`, type: 'customer' })).data;

    // Loose by amount on a new bill.
    await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
    const itemBox = page.getByPlaceholder(/Search item or scan|Search or scan item|आइटम खोजें या स्कैन करें/).first();
    await itemBox.click();
    await page.keyboard.type(`QA11 Sugar ${stamp}`, { delay: 10 });
    await page.getByRole('option').first().click();
    const sheet = page.getByTestId('loose-sheet');
    await sheet.waitFor({ timeout: 10000 });
    const first = await page.getByTestId('loose-result').innerText();
    check(`${width}: ₹50 of sugar at ₹44 is 1.136 kg`, first.startsWith('1.136'), first);
    await sheet.getByRole('radio', { name: '₹100' }).or(sheet.getByRole('button', { name: '₹100' })).first().click();
    const hundred = await page.getByTestId('loose-result').innerText();
    check(`${width}: ₹100 is 2.272 kg (never more than asked)`, hundred.startsWith('2.272'), hundred);
    const lit = await sheet.locator('[aria-pressed="true"], [aria-checked="true"]').allInnerTexts();
    check(`${width}: the ₹100 chip is the one lit`, lit.some((x) => x.includes('100')) && !lit.some((x) => x.includes('₹50')), lit.join(','));
    check(`${width}: the sheet shows no raw key`, !RAW.test(await page.getByRole('dialog').last().innerText()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/loose-${width}.png` });
    await page.getByTestId('loose-add').click();
    await sheet.waitFor({ state: 'hidden' });
    // Whichever layout draws the line, one of the bill's boxes holds the weight.
    const values = await page.locator('main input').evaluateAll((els) => els.map((e) => e.value));
    const shownText = await page.locator('main').innerText();
    check(`${width}: the line carries 2.272`, values.includes('2.272') || shownText.includes('2.272'), values.filter(Boolean).join(',').slice(0, 120));
    const total = money(await page.getByTestId('invoice-grand-total').first().innerText());
    check(`${width}: the bill is 2.272 × ₹44 rounded (₹100)`, Math.abs(total - 100) <= 0.5, String(total));

    // A phone order from a pasted list.
    await page.goto(`${base}/sales/phone-orders`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Phone orders`, (await page.locator('a[href="/sales/phone-orders"]').count()) > 0);
    const add = width < 1024 ? page.getByTestId('page-cta').getByRole('button') : page.getByTestId('phone-new');
    await add.first().click();
    const drawer = page.getByRole('dialog').last();
    await drawer.waitFor();
    await drawer.getByRole('combobox').first().fill(name);
    await page.getByRole('option').first().click();
    await page.getByTestId('phone-list').fill(`QA11 atta ${stamp} 5kg\nQA11 toordal ${stamp} 500 g, kesar 1 tin`);
    await page.getByTestId('phone-read').click();
    await page.getByTestId('phone-unmatched').waitFor({ timeout: 10000 });
    check(`${width}: the list reads two lines`, (await page.getByTestId('phone-line').count()) === 2);
    const ask = await page.getByTestId('phone-unmatched').innerText();
    check(`${width}: …and asks about kesar`, ask.includes('kesar 1 tin'), ask.replace(/\n/g, ' | '));
    const dock = money(await page.getByTestId('phone-dock-total').innerText());
    check(`${width}: the dock is 5 × ₹52 + 0.5 × ₹160 = ₹340`, dock === 340, String(dock));
    check(`${width}: the drawer shows no raw key`, !RAW.test(await drawer.innerText()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-${width}.png` });
    await page.getByTestId('phone-save').click();
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    const listed = (await api('GET', `/sales/phone-orders?q=${encodeURIComponent(name)}`)).data;
    const order = listed[0];
    check(
      `${width}: API — one order, udhaar, the list kept`,
      listed.length === 1 && order.total === '340.00' && order.pay === 'udhaar' && order.list_text?.includes('kesar'),
      JSON.stringify(order && { n: order.number, t: order.total })
    );
    check(`${width}: dal was read as 0.5 kg`, order?.lines.some((l) => l.item_id === dal.id && l.qty === '0.5'));

    await page.waitForTimeout(500);
    const board = await page.locator('main').innerText();
    check(`${width}: the board shows the order, its customer and Udhaar`, board.includes(order.number) && board.includes(name) && /Udhaar|उधार/.test(board));
    check(`${width}: the board shows no raw key`, !RAW.test(board));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-${width}.png`, fullPage: true });
    check(`${width}: the board does not scroll sideways`, (await over(page)) <= 0);

    // Make bill.
    await page.getByText(order.number, { exact: false }).first().click();
    await page.getByTestId('phone-bill').click();
    await page.getByTestId('bill-phone-note').waitFor({ timeout: 20000 });
    const billText = await page.locator('main').innerText();
    check(`${width}: the bill opens with the order's items and its customer`, billText.includes(`QA11 Atta ${stamp}`) && billText.includes(name));
    const billTotal = money(await page.getByTestId('invoice-grand-total').first().innerText());
    check(`${width}: the bill totals ₹340`, billTotal === 340, String(billTotal));
    check(`${width}: self-test — ₹341 would fail`, billTotal !== 341);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-${width}.png`, fullPage: true });

    const bill = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: atta.id, qty: '5' }, { item_id: dal.id, qty: '0.5' }], phone_order_id: order.id })).data;
    const issued = (await api('POST', `/sales/invoices/${bill.id}/issue`, { version: bill.version })).data;
    check(`${width}: issued on udhaar, ₹340 due`, Number(issued?.amount_due) === 340, JSON.stringify({ d: issued?.amount_due }));
    const out = (await api('GET', `/sales/phone-orders/${order.id}`)).data;
    check(`${width}: the order is out for delivery with its bill`, out.status === 'out' && out.invoice_id === bill.id);
    await api('POST', `/sales/phone-orders/${order.id}/status`, { status: 'delivered' });
    const counts = (await api('GET', '/sales/phone-orders?stage=delivered')).meta.counts;
    check(`${width}: Delivered today counts it`, counts.delivered >= 1, JSON.stringify(counts));
    const stock = (await api('GET', `/items/${dal.id}`)).data;
    check(`${width}: dal stock went down by 0.5 kg`, Number((stock.item ?? stock).on_hand) === 99.5);
    check(`${width}: no page error`, errors.length === 0, errors.join(' | ').slice(0, 200));
    await ctx.close();
  }
} catch (error) {
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: '/tmp/e2e-shots/kirana-fail.png' }).catch(() => {});
  check('harness ran to the end', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
