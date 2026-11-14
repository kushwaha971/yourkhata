/**
 * G9 — a distributor's company schemes on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/schemes.mjs [--shots=/tmp/e2e-shots/schemes] [--hi]
 *
 *  * New scheme from the drawer ("buy 10, get 1 free"), read back from the API;
 *  * a bill of 10 cases opened in the editor shows the free case as a ₹0 line,
 *    the scheme under its line, the "add more" offer for a percent scheme not
 *    yet reached, and a grand total equal to the server's own (self-tested);
 *  * issued, the free line is on the bill at ₹0, stock moved by 11, and the
 *    claim is 1 case at the item's price, on the list and in Claims;
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
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).wholesale;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const RAW = /\b(common|sales|nav)\.[a-zA-Z]+\.[a-zA-Z.]+/;
const money = (text) => Number(String(text).replace(/[^\d.]/g, ''));

const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 } });
    if (HI) await ctx.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
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
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const units = (await api('GET', '/units')).data;
    const box = (units.find((u) => u.code === 'BOX') ?? units[0]).id;
    const mkItem = async (name, price) => {
      const made = await api('POST', '/items', { name, unit_id: box, selling_price: price, purchase_price: '10', tax_code: 'GST18', opening_stock: { qty: '50', unit_cost: '10' } });
      return made.data.item ?? made.data;
    };
    const parle = await mkItem(`QA99 Parle ${stamp}`, '620');
    const surf = await mkItem(`QA99 Surf ${stamp}`, '1000');
    const tata = await mkItem(`QA99 Tata ${stamp}`, '500');
    const party = (await api('POST', '/parties', { name: `QA99 Patil ${stamp}`, mobile: `95${String(Date.now()).slice(-8)}`, type: 'customer' })).data;

    // New scheme from the drawer.
    await page.goto(`${base}/sales/schemes`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Schemes`, (await page.locator('a[href="/sales/schemes"]').count()) > 0);
    const add = width < 1024 ? page.getByTestId('page-cta').getByRole('button') : page.getByTestId('scheme-new');
    await add.first().click();
    const drawer = page.getByRole('dialog').last();
    await drawer.waitFor();
    await page.getByTestId('scheme-code').fill(`P${stamp}`);
    await page.getByTestId('scheme-company').fill('Parle Products');
    await drawer.getByRole('searchbox').fill(`QA99 Parle ${stamp}`);
    await page.getByTestId('scheme-item-option').first().click();
    await page.getByTestId('scheme-buy_qty').fill('10');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-${width}.png` });
    check(`${width}: the drawer shows no raw key`, !RAW.test(await drawer.innerText()));
    await page.getByTestId('scheme-save').click();
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    const listed = (await api('GET', `/sales/schemes?q=P${stamp}`)).data.schemes;
    check(`${width}: the drawer saved one free-goods scheme`, listed.length === 1 && listed[0].rule === 'free' && listed[0].buy_qty === '10' && listed[0].free_qty === '1' && listed[0].item?.id === parle.id, JSON.stringify(listed.map((s) => s.code)));

    const till = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    await api('POST', '/sales/schemes', { client_key: crypto.randomUUID(), code: `S${stamp}`, company: 'HUL', rule: 'percent', item_id: surf.id, amount: '2', min_bill: '10000', valid_till: till });
    await api('POST', '/sales/schemes', { client_key: crypto.randomUUID(), code: `T${stamp}`, company: 'Tata Consumer', rule: 'per_unit', item_id: tata.id, amount: '40', valid_till: till });

    // The bill, opened in the editor.
    const d = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: parle.id, qty: '10' }, { item_id: surf.id, qty: '8' }, { item_id: tata.id, qty: '3' }] })).data;
    check(`${width}: API — the draft carries one free case at ₹0`, d.lines.length === 4 && Number(d.lines[3].unit_price) === 0 && Number(d.lines[3].qty) === 1, d.lines.map((l) => `${l.description}×${Number(l.qty)}`).join(', '));
    await page.goto(`${base}/sales/invoices/${d.id}/edit`, { waitUntil: 'networkidle' });
    await page.getByTestId("scheme-free-line").first().waitFor({ timeout: 20000 }).catch(async () => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-missing-${width}.png`, fullPage: true }); console.log((await page.request.get(`${base}/api/v1/sales/schemes/running`).then((r) => r.text())).slice(0, 300)); });
    const freeText = await page.getByTestId('scheme-lines').innerText();
    check(`${width}: the editor shows the free case at ₹0`, (await page.getByTestId('scheme-free-line').count()) === 1 && freeText.includes(`QA99 Parle ${stamp}`) && freeText.includes('₹0'), freeText.replace(/\n/g, ' | '));
    check(`${width}: …and the offer for the percent scheme not reached`, (await page.getByTestId('scheme-offer').count()) === 1 && freeText.includes('2,000'), freeText.replace(/\n/g, ' | '));
    check(`${width}: a line says its scheme`, (await page.getByTestId('line-scheme').count()) >= 1);
    const dockText = await page.getByTestId('invoice-dock').innerText().catch(() => '');
    check(`${width}: the dock says "1 free" (design pScheme)`, /1 free|1 मुफ़्त/.test(dockText), dockText.replace(/\n/g, ' | ').slice(0, 120));
    const shown = money(await page.getByTestId('invoice-grand-total').first().innerText());
    check(`${width}: the editor's total equals the server's`, Math.abs(shown - Number(d.grand_total)) < 0.001, `${shown} vs ${d.grand_total}`);
    check(`${width}: self-test — ₹1 off would fail`, Math.abs(shown - (Number(d.grand_total) + 1)) >= 0.001);
    const words = await page.locator('main').innerText();
    check(`${width}: the bill shows no raw key`, !RAW.test(words));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-${width}.png`, fullPage: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: the bill does not scroll sideways`, over <= 0, `${over}px`);

    // Issue, then read back stock, the bill and the claim.
    const fresh = (await api('GET', `/sales/invoices/${d.id}`)).data;
    const issued = (await api('POST', `/sales/invoices/${d.id}/issue`, { version: fresh.version })).data;
    const freeLine = issued.lines.find((l) => l.scheme_code === `P${stamp}`.toUpperCase());
    check(`${width}: the issued bill keeps the free line`, !!freeLine && Number(freeLine.unit_price) === 0 && Number(freeLine.scheme_claim) === 620, JSON.stringify(freeLine && { qty: freeLine.qty, claim: freeLine.scheme_claim }));
    const stock = (await api('GET', `/items/${parle.id}`)).data;
    const onHand = Number((stock.item ?? stock).on_hand);
    check(`${width}: stock moved by 11 (10 sold + 1 free)`, onHand === 39, String(onHand));
    const tataLine = issued.lines.find((l) => l.item_id === tata.id || l.item?.id === tata.id);
    check(`${width}: ₹40 off each on 3 cases is ₹120 off, claimed`, tataLine && Number(tataLine.discount_amount) === 120 && Number(tataLine.scheme_claim) === 120, JSON.stringify(tataLine ?? issued.lines.map((l) => [l.description, l.item_id, l.discount_amount, l.scheme_code])));

    await page.goto(`${base}/sales/schemes`, { waitUntil: 'networkidle' });
    await page.getByTestId('schemes-screen').waitFor();
    await page.waitForTimeout(600);
    const listText = await page.locator('main').innerText();
    check(`${width}: the list shows the claim`, listText.includes(`P${stamp}`.toUpperCase()) && listText.includes('620'), '');
    check(`${width}: the list shows no raw key`, !RAW.test(listText));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}.png` });
    const listOver = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: the list does not scroll sideways`, listOver <= 0, `${listOver}px`);
    await page.getByTestId('scheme-claims').click();
    const claims = await page.getByTestId('scheme-claims-list').innerText();
    check(`${width}: Claims names each company`, claims.includes('Parle Products') && claims.includes('Tata Consumer'), claims.replace(/\n/g, ' | '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/claims-${width}.png` });
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
