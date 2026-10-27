// A4 money checks the P0 standard still needed (business + functional),
// each read back from the API by the document's own id:
//
//   overpay        at the API: more than an unpaid bill owes is refused, and
//                  anything against a paid bill is refused; the bills read
//                  back unchanged. On screen: Receive money with more than is
//                  due is refused or capped, never stored.
//   print          the printed bill (print media) shows the API's number, line
//                  descriptions, line amounts and grand total.
//   credit-screens a credit bill issued through the UI; then, WITHOUT a page
//                  load, the customer's page shows the API's new Shop balance
//                  and the item's page the API's new stock (FB-010).
//
// Writes bills and payments to the LOCAL seeded QA tenant only.
//   node e2e/a4-money.mjs [--width=1280]   (PW_CHROME, E2E_SHOTS)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = (process.env.E2E_BASE ?? 'http://localhost:3000');
const width = Number(process.argv.find((a) => a.startsWith('--width='))?.slice(8) ?? 1280);
const phone = width < 1024;
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4-money';
mkdirSync(dir, { recursive: true });
const failures = [];
const fail = (m) => failures.push(m);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const inr = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 900 }, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && !/status of 4/.test(m.text()) && errors.push(m.text().slice(0, 160)));
const api = async (p) => (await (await ctx.request.get(`${base}/api/v1${p}`)).json());
const send = async (method, p, data) => {
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const r = await ctx.request.fetch(`${base}/api/v1${p}`, {
    method,
    data,
    headers: { 'X-CSRF-Token': csrf ?? '', 'Idempotency-Key': crypto.randomUUID() },
  });
  return { status: r.status(), body: await r.json().catch(() => ({})) };
};
const bill = async (id) => (await api(`/sales/invoices/${id}`)).data;

try {
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  // Self-test: the filters this harness counts with really filter (H17).
  const unpaidRows = (await api('/sales/invoices?tab=unpaid&page_size=30')).data;
  const paidRows = (await api('/sales/invoices?tab=paid&page_size=30')).data;
  if (unpaidRows.some((r) => r.status === 'paid' || r.status === 'draft')) fail('self-test: tab=unpaid returned paid or draft bills');
  if (paidRows.some((r) => r.status !== 'paid')) fail('self-test: tab=paid returned other bills');

  // ── overpay at the API ───────────────────────────────────────────────────
  const unpaid = unpaidRows.find((r) => r.party && Number(r.amount_due) > 0);
  const paid = paidRows.find((r) => r.party);
  const tryPay = async (row, amount) =>
    send('POST', '/payments', {
      direction: 'in',
      party_id: row.party.id,
      mode_breakup: [{ mode: 'cash', amount }],
      allocations: [{ document_type: 'sales_document', document_id: row.id, amount }],
    });
  if (unpaid) {
    const before = await bill(unpaid.id);
    const over = (Number(before.amount_due) + 100).toFixed(2);
    const r = await tryPay(unpaid, over);
    const after = await bill(unpaid.id);
    if (r.status < 400) fail(`API took ₹${over} against ${before.number}, which owed ₹${before.amount_due} (${r.status})`);
    if (after.amount_due !== before.amount_due || after.amount_paid !== before.amount_paid)
      fail(`${before.number} changed after a refused overpay: due ${before.amount_due} → ${after.amount_due}`);
    if (Number(after.amount_due) < 0 || Number(after.amount_paid) > Number(after.grand_total)) fail(`${before.number} shows paid above its total`);
    console.log(`overpay unpaid ${before.number}: ₹${over} against ₹${before.amount_due} due → ${r.status} ${r.body?.error?.code ?? ''} "${(r.body?.error?.message ?? '').slice(0, 80)}"`);
  } else fail('no unpaid customer bill to try');
  if (paid) {
    const before = await bill(paid.id);
    const r = await tryPay(paid, '1.00');
    const after = await bill(paid.id);
    if (r.status < 400) fail(`API took ₹1 against PAID ${before.number} (${r.status})`);
    if (after.amount_paid !== before.amount_paid) fail(`paid ${before.number} changed after a refused payment`);
    console.log(`pay a paid bill ${before.number}: ₹1 → ${r.status} ${r.body?.error?.code ?? ''}`);
  } else fail('no paid customer bill to try');

  // ── overpay on screen ────────────────────────────────────────────────────
  if (unpaid) {
    const before = await bill(unpaid.id);
    const bal0 = Number((await api(`/parties/${unpaid.party.id}?book=shop`)).data.shop.customer_balance);
    await page.goto(`${base}/sales/invoices/${unpaid.id}`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /^Receive money/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
    const sheet = page.getByRole('dialog');
    const amount = sheet.getByRole('textbox').first();
    const over = (Number(before.amount_due) + 100).toFixed(2);
    await amount.fill(over);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const said = (await sheet.innerText()).replace(/\s+/g, ' ');
    const save = sheet.getByRole('button', { name: /^(Save|Record|Receive|Done)/ }).last();
    const canSave = (await save.count()) && !(await save.isDisabled());
    if (canSave) {
      await save.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: `${dir}/${width}-overpay-screen.png` });
    const after = await bill(unpaid.id);
    if (Number(after.amount_paid) > Number(after.grand_total) || Number(after.amount_due) < 0)
      fail(`on screen, ₹${over} against ₹${before.amount_due} due left ${after.number} paid ${after.amount_paid} of ${after.grand_total}`);
    const adv = Number((await api(`/parties/${unpaid.party.id}?book=shop`)).data.shop.customer_balance);
    const paidNow = Number(after.amount_paid) - Number(before.amount_paid);
    if (canSave && !near(bal0 - adv, Number(over))) fail(`₹${over} received should lower the Shop balance by ${over}; it moved ${bal0} → ${adv}`);
    if (canSave && !near(paidNow, Number(before.amount_due))) fail(`the bill took ₹${paidNow}, it owed ₹${before.amount_due}`);
    console.log(`  customer's Shop balance after the overpay: ${adv} (a negative is money the shop holds as advance)`);
    console.log(`overpay on screen ${before.number}: typed ₹${over} (due ₹${before.amount_due}); Save ${canSave ? 'allowed' : 'blocked'}; the sheet said "${(said.match(/[^.]*(Max|more than|only|due|advance)[^.]*/i) ?? ['-'])[0].slice(0, 140)}"; bill now paid ${after.amount_paid}, due ${after.amount_due}`);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ── print against the API ────────────────────────────────────────────────
  if (paid) {
    const d = await bill(paid.id);
    await page.goto(`${base}/sales/invoices/${paid.id}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(500);
    const printed = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: `${dir}/${width}-print.png`, fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    if (!printed.includes(d.number)) fail(`print does not show the bill number ${d.number}`);
    if (!printed.includes(inr(d.grand_total))) fail(`print does not show the grand total ₹${inr(d.grand_total)}`);
    for (const l of d.lines) {
      if (!printed.includes(l.description)) fail(`print is missing the line "${l.description}"`);
      if (l.line_total && !printed.includes(inr(l.line_total))) fail(`print does not show ${l.description}'s amount ₹${inr(l.line_total)}`);
    }
    // Self-test: a figure that is not on the bill must not be "found".
    if (printed.includes(inr(Number(d.grand_total) + 1.37))) fail('self-test: the print check matched a figure that is not on the bill');
    console.log(`print ${d.number}: number, ${d.lines.length} line(s) and total ₹${inr(d.grand_total)} checked against the API`);
  }

  // ── a credit bill, then the other screens without a reload ────────────────
  const customers = (await api('/parties?type=customer&status=active&book=shop&page_size=40')).data;
  const party = customers[13];
  const items = (await api('/items?page_size=40&ordering=name')).data.filter((i) => Number(i.selling_price) > 0 && Number(i.on_hand) > 3);
  const item = items[17];
  const bal0 = Number((await api(`/parties/${party.id}?book=shop`)).data.shop.customer_balance);
  const stock0 = Number((await api(`/items/${item.id}`)).data.on_hand);
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
  await page.getByRole('combobox').first().waitFor();
  await page.getByRole('button', { name: 'Saved customer', exact: true }).click();
  await page.getByLabel('Saved customer').fill(party.name);
  await page.getByRole('option', { name: new RegExp(esc(party.name)) }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('combobox').first().click();
  await page.keyboard.type(item.name, { delay: 8 });
  await page.getByRole('option', { name: new RegExp(esc(item.name)) }).first().click();
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^(Issue|UPI or other)/ }).last().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Full credit' }).click({ timeout: 5000 });
  await sheet.getByRole('button', { name: /Issue/ }).last().click();
  await page.waitForTimeout(3000);
  const inv = (await api(`/sales/invoices?party_id=${party.id}&page_size=1`)).data?.[0];
  const bal1 = Number((await api(`/parties/${party.id}?book=shop`)).data.shop.customer_balance);
  const stock1 = Number((await api(`/items/${item.id}`)).data.on_hand);
  if (!near(bal1, bal0 + Number(inv.grand_total))) fail(`API Shop balance ${bal0} + ${inv.grand_total} ≠ ${bal1}`);
  if (!near(stock0 - stock1, 1)) fail(`API stock ${stock0} → ${stock1}, sold 1`);

  // From here on, every move is client-side: count full page loads.
  let loads = 0;
  page.on('load', () => (loads += 1));
  const viewBill = page.getByRole('dialog').getByRole('button', { name: /View bill/ });
  if (await viewBill.count()) await viewBill.click();
  else await page.getByRole('link', { name: inv.number }).first().click().catch(() => {});
  await page.waitForURL(new RegExp(`/sales/invoices/${inv.id}$`), { timeout: 8000 }).catch(() => fail('View bill did not open the bill'));
  await page.waitForTimeout(1200);
  // The bill page names the customer without a link (listed for the owner), so
  // the merchant's way there: Customers, search, open — all client-side.
  if (phone) await page.goto(`${base}/customers`);
  else await page.getByRole('link', { name: 'Customers', exact: true }).first().click();
  await page.waitForURL(/\/(customers|parties)/, { timeout: 8000 });
  // The list's own search, not the header's.
  await page.getByRole('searchbox', { name: 'Search customers' }).fill(party.name);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: `Open ${party.name}` }).first().click({ timeout: 8000 });
  await page.waitForURL(/\/(customers|parties)\/[0-9a-f-]{36}/, { timeout: 8000 }).catch(() => fail('could not open the customer from Customers'));
  await page.waitForTimeout(2000);
  const custText = await page.locator('main').innerText();
  if (!custText.includes(inr(bal1))) fail(`the customer's page does not show the new Shop balance ₹${inr(bal1)} without a reload`);
  // No "old figure still shown" check: a bill on the same page can carry the
  // same amount (INV/26-27/0452 was ₹5,737.00, the old balance), so it cannot
  // fail only for the reason it names (H2).
  await page.screenshot({ path: `${dir}/${width}-customer-after.png` });
  // The item, through the app's own navigation.
  if (phone) await page.goto(`${base}/items/${item.id}`);
  else {
    await page.getByRole('link', { name: 'Items', exact: true }).first().click();
    await page.waitForURL(/\/items/, { timeout: 8000 });
    await page.locator('main').getByRole('searchbox').first().fill(item.name).catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole('link', { name: new RegExp(esc(item.name)) }).first().click({ timeout: 8000 }).catch(() => fail(`could not open ${item.name} from the items list`));
  }
  await page.waitForTimeout(2000);
  const itemText = await page.locator('main').innerText();
  const shownStock = Number(stock1).toLocaleString('en-IN', { maximumFractionDigits: 3 });
  if (!itemText.includes(shownStock)) fail(`the item's page does not show the new stock ${shownStock}`);
  await page.screenshot({ path: `${dir}/${width}-item-after.png` });
  if (!phone && loads) fail(`${loads} full page load(s) on the way: the screens were not updated client-side`);
  console.log(`credit ${inv.number} ₹${inv.grand_total} to ${party.name}: API balance ${bal0} → ${bal1}, stock ${stock0} → ${stock1}; customer page and item page checked${phone ? '' : `, ${loads} page loads`}`);
} finally {
  await browser.close();
}
for (const e of errors) fail(`console: ${e}`);
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS');
process.exitCode = failures.length ? 1 : 0;
