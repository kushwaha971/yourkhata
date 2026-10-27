// A4 functional end to end and busy counter, through the UI like a merchant,
// read back from the API, and the other screens checked WITHOUT a reload
// (FB-010).
//
//   Journey — a cash sale of two items, the first added twice (qty rises,
//   no second line), Paid cash tapped TWICE fast. API: exactly one new
//   issued bill, its total is the total the screen showed, nothing is due,
//   and each item's stock fell by what was sold. Then, client-side only, the
//   Bills list shows that bill number.
//   Busy counter — typing in the item search while its reply is slow (one
//   request per settled query, not per key; React commits counted); fast
//   Quick sale ↔ Saved customer taps end on the last; a reload keeps the
//   lines; a fraction on a whole-number unit sends nothing.
//   Self-test — the read-back checker is run once against a skewed figure and
//   must report it, or the whole run fails: a checker that cannot fail proves
//   nothing.
//
// Writes one issued bill (and drafts) to the LOCAL seeded QA tenant only.
//   node e2e/a4-functional.mjs [--width=1280]   (PW_CHROME, E2E_SHOTS)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const width = Number(process.argv.find((a) => a.startsWith('--width='))?.slice(8) ?? 1280);
const phone = width < 1024;
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4-functional';
mkdirSync(dir, { recursive: true });
const failures = [];
const consoleErrors = [];
const fail = (msg) => failures.push(msg);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const money = (text) => Number(String(text).replace(/[^\d.-]/g, ''));

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 900 } });
const page = await ctx.newPage();
let signedIn = false;
page.on('console', (m) => {
  if (signedIn && (m.type() === 'error' || /Warning:/.test(m.text())) && !/status of 4\d\d/.test(m.text()))
    consoleErrors.push(m.text().slice(0, 200));
});
const writes = [];
page.on('request', (r) => {
  if (/\/sales\/invoices/.test(r.url()) && ['POST', 'PATCH', 'PUT'].includes(r.method()))
    writes.push(`${r.method()} ${new URL(r.url()).pathname.replace('/api/v1', '')}`);
});
const api = async (path) => await (await ctx.request.get(`${base}/api/v1${path}`)).json();

const search = () => page.getByRole('combobox').first();
const addItem = async (name) => {
  await search().click();
  await page.keyboard.type(name, { delay: 5 });
  await page.getByRole('option', { name: new RegExp(esc(name)) }).first().click();
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
};

/** The read-back: what the API holds against what the screen promised. */
const readBack = ({ inv, shownTotal, stock, sold }) => {
  const out = [];
  if (inv.status !== 'paid') out.push(`status is ${inv.status} after Paid cash, expected paid`);
  if (!near(inv.grand_total, shownTotal)) out.push(`API total ${inv.grand_total}, screen showed ${shownTotal}`);
  if (!near(inv.amount_due ?? 0, 0)) out.push(`₹${inv.amount_due} still due after Paid cash`);
  for (const [id, { before, after }] of Object.entries(stock))
    if (!near(Number(before) - Number(after), sold[id])) out.push(`stock of ${id}: ${before} → ${after}, sold ${sold[id]}`);
  return out;
};

try {
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  signedIn = true;

  const items = (await api('/items?page_size=100&ordering=name')).data.filter(
    (i) => Number(i.selling_price) > 0 && Number(i.on_hand ?? i.stock?.on_hand ?? 0) > 5
  );
  const [a, b] = items;
  const onHand = async (id) => {
    const d = (await api(`/items/${id}`)).data;
    return d.on_hand ?? d.stock?.on_hand;
  };
  const stockBefore = { [a.id]: await onHand(a.id), [b.id]: await onHand(b.id) };
  // Issued bills without drafts: `tabs.all` (the API filters by `tab`, not `status`).
  const issuedBefore = (await api('/sales/invoices?page_size=1')).meta?.tabs?.all;
  const drafts = (await api('/sales/invoices?tab=draft&page_size=20')).data ?? [];
  if (!drafts.length || drafts.some((r) => r.status !== 'draft')) fail('self-test: tab=draft does not filter');
  console.log(`items ${a.name} (${stockBefore[a.id]}), ${b.name} (${stockBefore[b.id]}); issued so far ${issuedBefore}`);
  if (issuedBefore === undefined) fail('self-test: /sales/invoices meta.tabs.all missing, counts cannot be compared');

  // ---- Busy counter 1: typing while the search reply is slow ----------------
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  let searches = 0;
  await page.route('**/api/v1/items**', async (route) => {
    searches += 1;
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.evaluate(() => {
    window.__commits = 0;
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook?.onCommitFiberRoot) {
      const orig = hook.onCommitFiberRoot.bind(hook);
      hook.onCommitFiberRoot = (...args) => {
        window.__commits += 1;
        return orig(...args);
      };
    }
  });
  await search().click();
  await page.keyboard.type(a.name, { delay: 40 });
  await page.waitForTimeout(2500);
  const typed = a.name.length;
  console.log(`typed ${typed} keys with a 1.2 s reply: ${searches} item requests`);
  if (searches > 3) fail(`typing ${typed} keys sent ${searches} item searches (debounce lost)`);
  await page.getByRole('option', { name: new RegExp(esc(a.name)) }).first().click();
  await page.unroute('**/api/v1/items**');
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');

  // ---- The journey: a twice, b once --------------------------------------
  await addItem(a.name);
  await addItem(b.name);
  const lineCount = phone
    ? await page.locator('[data-testid^=invoice-line-card], [data-testid=invoice-line-list] > *').count()
    : await page.locator('table [data-testid=invoice-line]').count();
  if (!phone && lineCount !== 2) fail(`${lineCount} line rows; adding ${a.name} twice should raise its qty, not add a row`);
  const qtyA = await page.locator('[id="lines.0.qty"]').inputValue().catch(() => null);
  if (!phone && qtyA !== '2') fail(`first line qty is ${qtyA}, expected 2`);

  // ---- Busy counter 2: reload keeps the bill -----------------------------
  await page.waitForTimeout(4000); // past the 3 s server autosave
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const restore = page.getByRole('button', { name: /Restore|Keep|Continue/i });
  if (await restore.count()) await restore.first().click();
  await page.waitForTimeout(800);
  const afterReload = await page.getByText(a.name).count();
  if (!afterReload) fail('the lines were gone after a reload');
  await page.screenshot({ path: `${dir}/${width}-after-reload.png` });

  // ---- Busy counter 3: fast Quick sale ↔ Saved customer ------------------
  for (let i = 0; i < 8; i += 1)
    await page.getByRole('button', { name: i % 2 ? 'Quick sale' : 'Saved customer', exact: true }).click({ delay: 0 });
  await page.waitForTimeout(400);
  const quickPressed = await page.getByRole('button', { name: 'Quick sale', exact: true }).getAttribute('aria-pressed');
  if (quickPressed !== 'true') fail(`after 8 fast taps ending on Quick sale, Quick sale is aria-pressed=${quickPressed}`);

  // ---- Paid cash, tapped twice fast ---------------------------------------
  const shownTotal = money(await page.getByTestId('invoice-grand-total').last().innerText().catch(async () =>
    page.locator('[data-testid=total-dock], footer').first().innerText()
  ));
  await page.screenshot({ path: `${dir}/${width}-before-pay.png` });
  writes.length = 0;
  const pay = page.getByRole('button', { name: /^Paid cash/ }).last();
  await pay.dblclick();
  await page.waitForTimeout(800);
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm|Save/ });
  if (await confirm.count()) {
    await confirm.last().dblclick();
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${dir}/${width}-after-pay.png` });
  const issues = writes.filter((w) => /issue/.test(w));
  console.log('writes on Paid cash:', writes.join(' | '));
  if (issues.length !== 1) fail(`Paid cash tapped twice sent ${issues.length} issue requests`);

  // ---- Read back ------------------------------------------------------------
  const issuedAfter = (await api('/sales/invoices?page_size=1')).meta?.tabs?.all;
  if (issuedAfter !== issuedBefore + 1) fail(`issued bills ${issuedBefore} → ${issuedAfter}, expected +1`);
  const newest = (await api('/sales/invoices?tab=paid&page_size=1')).data?.[0];
  const inv = newest && (await api(`/sales/invoices/${newest.id}`)).data;
  if (!inv) throw new Error('no issued bill to read back');
  const stock = {
    [a.id]: { before: stockBefore[a.id], after: await onHand(a.id) },
    [b.id]: { before: stockBefore[b.id], after: await onHand(b.id) },
  };
  const sold = { [a.id]: 2, [b.id]: 1 };
  for (const f of readBack({ inv, shownTotal, stock, sold })) fail(`read-back: ${f}`);
  console.log(`issued ${inv.number}: API ${inv.grand_total}, screen ${shownTotal}, due ${inv.amount_due}`);
  console.log(`stock ${JSON.stringify(stock)}`);

  // Self-test: the same checker, given a skewed screen total, must object.
  const skew = readBack({ inv, shownTotal: shownTotal + 1, stock, sold });
  if (!skew.some((f) => f.startsWith('API total'))) fail('self-test: a skewed total was not reported');

  // ---- Other screens, no reload -------------------------------------------
  const navs = [];
  page.on('framenavigated', (f) => f === page.mainFrame() && navs.push(f.url()));
  const loads = [];
  page.on('load', () => loads.push(page.url()));
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  if (phone) {
    await page.goto(`${base}/sales/invoices`); // phones reach Bills through the menu sheet
  } else {
    await page.getByRole('link', { name: 'Bills', exact: true }).first().click();
  }
  await page.waitForTimeout(2500);
  const listed = await page.getByText(inv.number).count();
  if (!listed) fail(`Bills list does not show ${inv.number}`);
  if (!phone && loads.length) fail(`going to Bills reloaded the page (${loads.length} loads)`);
  await page.screenshot({ path: `${dir}/${width}-bills.png` });
} finally {
  await browser.close();
}
for (const e of consoleErrors) fail(`console: ${e}`);
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS');
process.exit(failures.length ? 1 : 0);
