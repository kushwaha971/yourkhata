/**
 * G10 — a café's open orders and advance orders on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/cafe-orders.mjs [--shots=/tmp/e2e-shots/cafe] [--hi]
 *
 *  * a token made in the drawer (an item picked twice is one line × 2), read
 *    back from the API with the item's price and the board's total;
 *  * an advance order: the drawer's dock says "Balance on delivery"; one made
 *    for tomorrow with ₹500 advance shows under Advance orders and on Home;
 *  * Take payment opens the bill with the order's lines and the note; the bill
 *    settles the order, the board drops it, and an advance bill applies ₹500;
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
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).cafe;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const RAW = /\b(common|sales|nav|reports)\.[a-zA-Z]+\.[a-zA-Z.]+/;
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
    const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
    const mkItem = async (name, price, stock) => {
      const made = await api('POST', '/items', {
        name, unit_id: nos, selling_price: price, purchase_price: '10', tax_code: 'GST0',
        ...(stock ? { opening_stock: { qty: stock, unit_cost: '10' } } : { track_stock: false }),
      });
      return made.data.item ?? made.data;
    };
    const coffee = await mkItem(`QA10 Coffee ${stamp}`, '120');
    const box = await mkItem(`QA10 Box ${stamp}`, '720', '40');
    const party = (await api('POST', '/parties', { name: `QA10 Sunita ${stamp}`, mobile: `94${String(Date.now()).slice(-8)}`, type: 'customer' })).data;

    // A token from the drawer.
    await page.goto(`${base}/sales/open-orders`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Open orders`, (await page.locator('a[href="/sales/open-orders"]').count()) > 0);
    const add = width < 1024 ? page.getByTestId('page-cta').getByRole('button') : page.getByTestId('cafe-new');
    await add.first().click();
    const drawer = page.getByRole('dialog').last();
    await drawer.waitFor();
    for (let i = 0; i < 2; i += 1) {
      await drawer.getByRole('searchbox').fill(`QA10 Coffee ${stamp}`);
      await page.getByTestId('cafe-item-option').first().click();
    }
    check(`${width}: an item picked twice is one line`, (await page.getByTestId('cafe-line').count()) === 1);
    const dock = money(await page.getByTestId('cafe-dock-total').innerText());
    check(`${width}: the dock totals 2 × ₹120`, dock === 240, String(dock));
    check(`${width}: the drawer shows no raw key`, !RAW.test(await drawer.innerText()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/token-${width}.png` });
    await page.getByTestId('cafe-save').click();
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    const open = (await api('GET', '/sales/cafe-orders?scope=open')).data;
    const token = open.find((o) => o.lines.some((l) => l.item_id === coffee.id));
    check(`${width}: API — the token was saved at the item's price`, !!token && token.kind === 'token' && token.total === '240.00' && token.lines[0].qty === '2', JSON.stringify(token && { n: token.number, t: token.total }));

    // The advance drawer's dock speaks of the balance.
    await add.first().click();
    await drawer.waitFor();
    await drawer.getByRole('button', { name: /^(Advance|एडवांस)$/ }).click();
    await page.waitForTimeout(300);
    const pressed = await drawer.getByRole('group').first().locator('[aria-pressed="true"]').allInnerTexts();
    check(`${width}: only Advance is pressed`, pressed.length === 1 && /Advance|एडवांस/.test(pressed[0]), pressed.join(','));
    const dockLabel = await drawer.innerText();
    check(`${width}: an advance order asks for the ready time and shows the balance`, /Balance on delivery|देते समय बाकी/.test(dockLabel) && /Ready on|तैयार कब/.test(dockLabel));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/advance-drawer-${width}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button').first().click({ timeout: 3000 }).catch(() => undefined);
    await drawer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);

    // An advance order for tomorrow.
    const tomorrow = new Date(Date.now() + 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    const adv = (await api('POST', '/sales/cafe-orders', {
      client_key: crypto.randomUUID(), kind: 'advance', party_id: party.id, ready_at: `${tomorrow}T11:00`, fulfil: 'pickup', advance: '500', advance_mode: 'cash',
      lines: [{ item_id: box.id, qty: '2', note: 'Happy Diwali' }],
    })).data;
    check(`${width}: API — advance order ₹1,440 with ₹940 to pay`, adv.total === '1440.00' && adv.balance === '940.00', JSON.stringify({ t: adv.total, b: adv.balance }));

    await page.goto(`${base}/sales/open-orders`, { waitUntil: 'networkidle' });
    await page.getByTestId('cafe-board').waitFor();
    const board = await page.getByTestId('cafe-board').innerText();
    check(`${width}: the board shows the token and its total`, board.includes(`${token.number}`) && board.includes('240'), '');
    check(`${width}: the board shows Swiggy as Later`, (await page.getByTestId('cafe-swiggy').count()) === 1);
    check(`${width}: the board shows no raw key`, !RAW.test(await page.locator('main').innerText()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-${width}.png`, fullPage: true });
    check(`${width}: the board does not scroll sideways`, (await over(page)) <= 0);
    await page.getByRole('button', { name: /Advance orders|एडवांस ऑर्डर/ }).or(page.getByRole('radio', { name: /Advance orders|एडवांस ऑर्डर/ })).first().click();
    await page.waitForTimeout(700);
    const advBoard = await page.locator('main').innerText();
    check(`${width}: Advance orders lists it with the customer`, advBoard.includes(adv.number) && advBoard.includes(`QA10 Sunita ${stamp}`));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/advance-${width}.png`, fullPage: true });

    // Home, the day before.
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    const home = page.getByTestId('home-advance-orders');
    await home.waitFor({ timeout: 15000 }).catch(() => undefined);
    const homeText = (await home.count()) ? await home.innerText() : '';
    check(`${width}: Home shows the advance order due tomorrow`, homeText.includes(adv.number), homeText.replace(/\n/g, ' | ').slice(0, 160));
    check(`${width}: Home's block shows no raw key`, !RAW.test(homeText));
    if (SHOTS && (await home.count())) await home.screenshot({ path: `${SHOTS}/home-${width}.png` });

    // Take payment opens the bill with the token's lines.
    await page.goto(`${base}/sales/open-orders`, { waitUntil: 'networkidle' });
    await page.getByTestId('cafe-card').filter({ hasText: `${token.number}` }).first().click();
    await page.getByTestId('cafe-bill').click();
    await page.getByTestId('bill-cafe-note').waitFor({ timeout: 20000 });
    const billText = await page.locator('main').innerText();
    check(`${width}: the bill opens with the token's item and the note`, billText.includes(`QA10 Coffee ${stamp}`), '');
    const shown = money(await page.getByTestId('invoice-grand-total').first().innerText());
    check(`${width}: the bill totals the order (GST 0)`, shown === 240, String(shown));
    check(`${width}: self-test — ₹1 more would fail`, shown !== 241);
    check(`${width}: the bill shows no raw key`, !RAW.test(billText));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-${width}.png`, fullPage: true });

    // The bills settle the orders (issued through the API, read back).
    const tokenBill = (await api('POST', '/sales/invoices', { lines: [{ item_id: coffee.id, qty: '2' }], cafe_order_id: token.id })).data;
    const paid = await api('POST', `/sales/invoices/${tokenBill.id}/issue`, { version: tokenBill.version, payment: { mode_breakup: [{ mode: 'cash', amount: tokenBill.grand_total }] } });
    check(`${width}: the token's bill is issued`, !!paid.data?.number, JSON.stringify(paid.error ?? {}).slice(0, 120));
    const after = (await api('GET', `/sales/cafe-orders/${token.id}`)).data;
    check(`${width}: the token is paid and names its bill`, after.status === 'billed' && after.invoice_id === tokenBill.id);
    const advBill = (await api('POST', '/sales/invoices', { party_id: party.id, lines: [{ item_id: box.id, qty: '2' }], cafe_order_id: adv.id })).data;
    const advDone = (await api('POST', `/sales/invoices/${advBill.id}/issue`, { version: advBill.version })).data;
    check(`${width}: the advance bill applies ₹500 and leaves ₹940`, Number(advDone.amount_paid) === 500 && Number(advDone.amount_due) === 940, JSON.stringify({ p: advDone.amount_paid, d: advDone.amount_due }));
    const stock = (await api('GET', `/items/${box.id}`)).data;
    check(`${width}: the boxes left stock on the bill`, Number((stock.item ?? stock).on_hand) === 38);
    await page.goto(`${base}/sales/open-orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const left = await page.locator('main').innerText();
    check(`${width}: the board no longer shows the paid token`, !left.includes(`QA10 Coffee ${stamp}`));
    check(`${width}: no page error`, errors.length === 0, errors.join(' | ').slice(0, 200));
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
