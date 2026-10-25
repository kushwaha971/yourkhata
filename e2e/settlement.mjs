/**
 * BP-08 (R-DEC-26) — settle a Shop contact's customer and supplier balances,
 * on the LOCAL stack, against a business made for this run.
 *
 *   NODE_PATH=$(npm root -g) node e2e/settlement.mjs [--shots=/tmp/e2e-shots/settlement]
 *
 *  * a contact who is both a customer (owes the shop for a bill) and a supplier
 *    (the shop owes them for a purchase) appears on Home in the "in both lists"
 *    note, with the two figures the server holds;
 *  * the dialog opens with both balances, the smaller prefilled, and "After
 *    this" correct before anything is written; focus is on Keep separate;
 *  * an amount above the smaller is refused on the screen and by the server;
 *  * a double tap on Settle settles ONCE, and both role balances go down by the
 *    amount on the server's read-back, the Customers and Suppliers lists agree;
 *  * money received today and the Shop's cash are unchanged — no cash moved;
 *  * the receipt says "Settled, no cash", and cancelling it names the other half
 *    and puts both balances back;
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi: the Home note and the
 *    dialog have no sideways scroll, no cut text, no broken figure, and 44 px
 *    targets on a phone.
 *
 * Creates its own business through the public API; touches nothing else.
 * Refuses any host but localhost.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

import { api, must, newOwner } from './lib/fixtures.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const inr = (v) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (n = 0) => new Date(Date.now() + 5.5 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);

const measure = (scope) => {
  const root = document.querySelector(scope) ?? document.body;
  const cut = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const broken = [];
  for (const el of root.querySelectorAll('*')) {
    for (const node of el.childNodes) {
      if (node.nodeType !== 3) continue;
      for (const m of node.textContent.matchAll(/[-‑−]?₹[\d,.]+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1)
          broken.push(m[0]);
      }
    }
  }
  return { overflow: document.documentElement.scrollWidth - innerWidth, cut: [...new Set(cut)], broken };
};

/** Every button in a scope: does the finger land on it at the centre and ±21 px? */
const targets = (scope) =>
  [...(document.querySelector(scope)?.querySelectorAll('button') ?? [])]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = (yy) => {
        const at = document.elementFromPoint(x, yy);
        return el.contains(at) || at === el;
      };
      // `ub-hit` widens the target past the face with a pseudo-element, which
      // elementFromPoint reports as the button itself.
      return { label: (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 24), hits: [y - 21, y, y + 21].every(hit) };
    });

// ── A business with one contact in both lists ───────────────────────────────
const owner = await newOwner({ shop: 'Shree Balaji Traders', name: 'Settle Owner', prefix: 'settle' });
const T = owner.token;
const units = await must('GET', '/units', null, T);
const nos = units.find((u) => u.code === 'NOS') ?? units[0];
const rice = await must('POST', '/items', {
  name: 'Basmati Rice 5kg', item_type: 'goods', unit_id: nos.id, selling_price: '500.00', purchase_price: '300.00',
  tax_code: 'GST5', hsn_sac: '1006', reorder_point: '2', opening_stock: { qty: '40', unit_cost: '300.00', as_of: iso(60) },
}, T);
const ramesh = await must('POST', '/parties', { name: 'Ramesh Traders', is_customer: true, is_supplier: true, mobile: '9822012345', state_code: '27' }, T);
const meena = await must('POST', '/parties', { name: 'Meena Devi', is_customer: true, mobile: '9822011111', state_code: '27' }, T);
const sale = (party, qty, date) => api('POST', '/sales/invoices?issue=true', { party_id: party.id, document_date: date, lines: [{ item_id: rice.id, qty, unit_price: '500.00' }] }, T);
for (const [party, qty, days] of [[ramesh, '1', 9], [ramesh, '1', 3], [meena, '1', 1]]) {
  const r = await sale(party, qty, iso(days));
  if (r.status >= 400) throw new Error(`invoice ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
}
const bill = await api('POST', '/purchases/bills?record=true', {
  party_id: ramesh.id, supplier_invoice_number: `RT-${Date.now() % 100000}`, supplier_invoice_date: iso(5), document_date: iso(5),
  lines: [{ item_id: rice.id, qty: '2', unit_cost: '300.00', tax_code: 'GST5' }],
}, T);
if (bill.status >= 400) throw new Error(`bill ${bill.status} ${JSON.stringify(bill.body).slice(0, 300)}`);
// Meena paid cash today: the "received" figure the settlement must not touch.
await must('POST', '/payments', { direction: 'in', party_id: meena.id, payment_date: iso(0), amount: '100.00', mode_breakup: [{ mode: 'cash', amount: '100.00' }] }, T);

const figures = async () => (await must('GET', `/payments/shop-settlements?party_id=${ramesh.id}`, null, T));
const money = async () => {
  const tiles = (await api('GET', '/reports/dashboard?refresh=true', null, T)).body.data.tiles;
  return {
    received: JSON.stringify(tiles.today_received),
    cash: JSON.stringify(tiles.shop_cash_in_hand?.amount ?? tiles.shop_cash_in_hand),
    periods: JSON.stringify(Object.values(tiles.periods ?? {}).map((p) => p.received)),
    collect: tiles.to_collect?.amount,
    pay: tiles.to_pay?.amount,
  };
};
const before = await figures();
const moneyBefore = await money();
console.log('seeded', before.customer_balance, before.supplier_balance, before.max_amount);
check('the contact owes as a customer and is owed as a supplier', Number(before.customer_balance) > 0 && Number(before.supplier_balance) > 0 && before.max_amount === [before.customer_balance, before.supplier_balance].sort((a, b) => a - b)[0], JSON.stringify([before.customer_balance, before.supplier_balance, before.max_amount]));
const MAX = before.max_amount;

// ── The server's own refusals ───────────────────────────────────────────────
const over = await api('POST', '/payments/shop-settlements', { party_id: ramesh.id, amount: (Number(MAX) + 1).toFixed(2) }, T);
check('the server refuses more than the smaller balance', over.status === 409 && over.body?.error?.code === 'settlement_over_balance', `${over.status} ${over.body?.error?.code}`);
const stale = await api('POST', '/payments/shop-settlements', { party_id: ramesh.id, amount: '1.00', expected: { customer_balance: '1.00', supplier_balance: before.supplier_balance } }, T);
check('the server refuses figures that moved since the dialog read them', stale.status === 409 && stale.body?.error?.code === 'settlement_balances_changed' && stale.body?.error?.details?.max_amount === MAX, `${stale.status} ${stale.body?.error?.code}`);
const single = await api('POST', '/payments/shop-settlements', { party_id: meena.id, amount: '1.00' }, T);
check('the server refuses a contact who is only a customer', single.status === 409 && single.body?.error?.code === 'settlement_not_dual_role', `${single.status} ${single.body?.error?.code}`);

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', owner.email);
  await page.fill('input[type=password]', owner.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });

  const openHome = async () => {
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.getByTestId('shop-home-workspace').waitFor();
  };
  const openDialog = async () => {
    await page.getByTestId('home-settlement-open').click();
    await page.getByTestId('settle-body').waitFor({ timeout: 20000 });
    await page.waitForTimeout(300);
  };

  // ── Home's note ──────────────────────────────────────────────────────────
  await openHome();
  const note = page.getByTestId('home-settlement-note');
  await note.waitFor({ timeout: 20000 });
  const noteText = (await note.innerText()).replace(/\s+/g, ' ');
  check(
    'Home says Ramesh is in both lists, with the two figures the server holds',
    noteText.includes('Ramesh Traders is in both lists.') &&
      noteText.includes(`They owe you ₹${inr(before.customer_balance)} as a customer and you owe them ₹${inr(before.supplier_balance)} as a supplier.`),
    noteText
  );
  check('Home names only the contact in both lists', !noteText.includes('Meena'), noteText);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-note-390.png`, fullPage: true });

  // ── The dialog ───────────────────────────────────────────────────────────
  await openDialog();
  const dialog = page.getByRole('dialog').last();
  const prefilled = await page.getByTestId('settle-amount').inputValue();
  check('the smaller balance is prefilled', Number(prefilled.replace(/,/g, '')) === Number(MAX), prefilled);
  const cust = await page.getByTestId('settle-customer').innerText();
  const supp = await page.getByTestId('settle-supplier').innerText();
  check('the dialog shows both balances', cust.includes(`₹${inr(before.customer_balance)}`) && supp.includes(`₹${inr(before.supplier_balance)}`), `${cust} | ${supp}`.replace(/\n/g, ' '));
  const afterText = (await page.getByTestId('settle-after').innerText()).replace(/\s+/g, ' ');
  const wantCust = inr(Number(before.customer_balance) - Number(MAX));
  const wantSupp = inr(Number(before.supplier_balance) - Number(MAX));
  check('"After this" shows both results before anything is written', afterText.includes(`They owe you ₹${wantCust}`) && afterText.includes(`You owe them ₹${wantSupp}`), afterText);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check('focus opens on Keep separate, so Enter never settles', focused === 'Keep separate', focused);
  check('the honest line says no cash moves both ways', (await dialog.innerText()).includes(`Records ₹${inr(MAX)} received from Ramesh Traders in Customers and ₹${inr(MAX)} paid to Ramesh Traders in Suppliers`));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-390.png` });

  await page.getByTestId('settle-amount').fill((Number(MAX) + 50).toFixed(2));
  await page.waitForTimeout(200);
  const blocked = await page.getByTestId('settle-confirm').isDisabled();
  const hint = await dialog.innerText();
  check('an amount above the smaller is refused on the screen', blocked && hint.includes(`You can settle up to ₹${inr(MAX)}, the smaller of the two.`), hint.slice(0, 0));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-over-390.png` });

  const SETTLE = (Number(MAX) - 100).toFixed(2);
  await page.getByTestId('settle-amount').fill(SETTLE);
  await page.waitForTimeout(200);
  const label = await page.getByTestId('settle-confirm').innerText();
  check('the button names the amount', label === `Settle ₹${inr(SETTLE)}`, label);
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/payments\/shop-settlements$/.test(new URL(r.url()).pathname)) posts += 1;
  });
  await page.getByTestId('settle-confirm').dblclick();
  await page.getByText(`Tell Ramesh Traders about the settlement`).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const sheet = await page.getByRole('dialog').last().locator('textarea').inputValue();
  check('the message is signed by the shop and never names the product', sheet.includes('Shree Balaji Traders') && !/YourKhata|yourkhata|DigiKhaato/i.test(sheet), sheet.slice(0, 200));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/message-390.png` });

  const after = await figures();
  check('a double tap settled once', after.settlements.filter((s) => !s.voided_at && !s.voided).length === 1 && posts <= 2, `${after.settlements.length} settlements, ${posts} POST(s)`);
  check(
    'both balances went down by the amount, on the server',
    Math.abs(Number(after.customer_balance) - (Number(before.customer_balance) - Number(SETTLE))) < 0.001 &&
      Math.abs(Number(after.supplier_balance) - (Number(before.supplier_balance) - Number(SETTLE))) < 0.001,
    `${before.customer_balance}/${before.supplier_balance} → ${after.customer_balance}/${after.supplier_balance}`
  );
  const shop = (await must('GET', `/parties/${ramesh.id}?book=shop`, null, T)).shop;
  check('the person page reads the same two figures', shop.customer_balance === after.customer_balance && shop.supplier_balance === after.supplier_balance, JSON.stringify([shop.customer_balance, shop.supplier_balance]));
  const moneyAfter = await money();
  check('money received today is unchanged: no cash moved', moneyAfter.received === moneyBefore.received && moneyAfter.periods === moneyBefore.periods, `${moneyBefore.received} → ${moneyAfter.received}`);
  check("the Shop's cash in hand is unchanged", moneyAfter.cash === moneyBefore.cash, `${moneyBefore.cash} → ${moneyAfter.cash}`);
  check(
    'To collect and To pay each went down by the amount',
    Math.abs(Number(moneyBefore.collect) - Number(moneyAfter.collect) - Number(SETTLE)) < 0.001 &&
      Math.abs(Number(moneyBefore.pay) - Number(moneyAfter.pay) - Number(SETTLE)) < 0.001,
    `${moneyBefore.collect}/${moneyBefore.pay} → ${moneyAfter.collect}/${moneyAfter.pay}`
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const settled = after.settlements[0];

  // ── The person page entry ────────────────────────────────────────────────
  await page.goto(`${base}/parties/${ramesh.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'More actions', exact: true }).locator('visible=true').first().click();
  const settleRow = page.getByRole('button', { name: /Settle with the other balance/ });
  check('the person page offers the settlement in its ⋯ menu', (await settleRow.count()) > 0);
  await settleRow.first().click();
  await page.getByTestId('settle-body').waitFor({ timeout: 20000 });
  const reopened = await page.getByTestId('settle-amount').inputValue();
  check('opened again, it prefills what is left to settle', Number(reopened.replace(/,/g, '')) === Number(after.max_amount), `${reopened} vs ${after.max_amount}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/person-dialog-390.png` });
  await page.getByRole('button', { name: 'Keep separate' }).click();
  await page.waitForTimeout(400);
  check('Keep separate writes nothing', (await figures()).settlements.length === after.settlements.length);
  const lone = await page.goto(`${base}/parties/${meena.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'More actions', exact: true }).locator('visible=true').first().click();
  check('a customer-only contact is not offered it', lone.ok() && (await page.getByRole('button', { name: /Settle with the other balance/ }).count()) === 0);
  await page.keyboard.press('Escape');

  // ── Widths × languages: Home's note and the dialog ───────────────────────
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      const tag = `${width} ${locale}`;
      await openHome();
      await page.getByTestId('home-settlement-note').waitFor({ timeout: 20000 });
      let m = await page.evaluate(measure, 'main');
      check(`${tag}: Home has no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      const nm = await page.evaluate(measure, '[data-testid="home-settlement-note"]');
      check(`${tag}: no cut text or broken figure in the note`, nm.cut.length === 0 && nm.broken.length === 0, [...nm.cut, ...nm.broken].join(' | '));
      if (width < 1024) {
        const tg = await page.evaluate(targets, '[data-testid="home-settlement-note"]');
        check(`${tag}: Settle… is a 44 px target`, tg.length === 1 && tg.every((x) => x.hits), JSON.stringify(tg));
      }
      if (locale === 'hi' && width === 390) {
        const said = await page.getByTestId('home-settlement-note').innerText();
        check('390 hi: the note is in Hindi', said.includes('दोनों सूचियों में हैं'), said.slice(0, 60));
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-${width}-${locale}.png`, fullPage: true });
      await openDialog();
      m = await page.evaluate(measure, '[role="dialog"]');
      check(`${tag}: the dialog has no cut text, broken figure or offscreen part`, m.cut.length === 0 && m.broken.length === 0, [...m.cut, ...m.broken].join(' | '));
      if (width < 1024) {
        const tg = await page.evaluate(targets, '[role="dialog"]');
        check(`${tag}: every dialog button is a 44 px target`, tg.length >= 3 && tg.every((x) => x.hits), JSON.stringify(tg.filter((x) => !x.hits)));
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-${width}-${locale}.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
  check('Keep separate and Escape never wrote anything', (await figures()).settlements.length === after.settlements.length);

  // ── Cancelling one half takes both ───────────────────────────────────────
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  const inId = settled.in_payment?.id ?? settled.in_payment_id;
  await page.goto(`${base}/payments/${inId}`, { waitUntil: 'networkidle' });
  const main = page.locator('main');
  await main.getByText('Settled, no cash').first().waitFor({ timeout: 20000 });
  check('the receipt says "Settled, no cash", not an adjustment', !/Adjustment/i.test(await main.innerText()));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/receipt-390.png`, fullPage: true });
  await page.getByTestId('payment-dock').getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: /Cancel receipt/ }).click();
  const cancel = page.getByRole('dialog').last();
  await cancel.getByTestId('payment-void-confirm').waitFor({ timeout: 15000 });
  const said = (await cancel.innerText()).replace(/\s+/g, ' ');
  const partner = settled.out_payment?.number ?? '';
  check('cancelling names the other half it takes with it', said.includes(`This also cancels the matching ${partner}`) && said.includes(`go back up by ₹${inr(SETTLE)}`), said.slice(0, 260));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancel-390.png` });
  await cancel.getByRole('radio').first().click();
  await cancel.getByTestId('payment-void-confirm').click();
  await page.getByText(/^Cancelled on /).first().waitFor({ timeout: 15000 });
  const undone = await figures();
  check('both balances are back where they were', undone.customer_balance === before.customer_balance && undone.supplier_balance === before.supplier_balance, `${undone.customer_balance}/${undone.supplier_balance}`);
  const outId = settled.out_payment?.id ?? settled.out_payment_id;
  const outHalf = (await must('GET', `/payments/${outId}`, null, T));
  check('the other half is cancelled too', outHalf.status === 'void', outHalf.status);
  await openHome();
  const back = await page.getByTestId('home-settlement-note').innerText();
  check('Home offers the settlement again', back.includes(`₹${inr(before.customer_balance)}`), back.slice(0, 80));
  check('no page error on the way', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
