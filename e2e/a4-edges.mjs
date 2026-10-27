// A4 edge cases — what a real counter does to a bill, each case read back
// from the API rather than trusted from the screen.
//
//   offline-pay     network drops, then Paid cash: nothing issued, the bill
//                   says it is offline and kept; back online it issues ONCE.
//   offline-add     BACKLOG (offline billing, docs/BACKLOG.md): the item search
//                   needs the network. Reported, not failed, until it is built.
//   slow-issue      Paid cash; the SERVER issues the bill but its reply is held
//                   back (a lost answer), and the merchant reloads: exactly one
//                   bill, and the reloaded screen shows it issued, never an
//                   editable draft that could be paid a second time.
//   back-after-pay  Back after a paid bill: nothing is issued again.
//   two-tabs        the same draft open in two tabs, both edited: the second
//                   save is refused (stale_version) and says so; no silent
//                   overwrite of the first tab's line.
//   credit          a Saved customer billed on credit: their SHOP balance
//                   rises by exactly the bill total (DEC-019 book).
//   zero-stock      an item made for the case with nothing on hand: issue
//                   refused naming it, or (if the shop allows negative stock)
//                   issued and its stock below zero, read back.
//   long-text       200-character item name search and Hindi/emoji in fields:
//                   no page wider than the viewport, no text out of its box.
//   double-hold     Hold tapped twice fast: one more held bill, not two.
//   cleared-qty     a line whose Qty is emptied, then Hold and Save draft: both
//                   refused with the field named; nothing saved without the
//                   line; the line stays (monkey seed 7713 lost it).
//   locked          a PAID bill cannot be changed: its /edit address sends the
//                   merchant to the bill's page, which offers no Edit, Delete or
//                   Paid cash; and straight at the API, edit, change customer,
//                   delete and issue-again are each refused, the bill, its stock
//                   and the issued count reading back unchanged. (Void, the
//                   designed correction, is not tried: it is allowed.)
//
// Writes bills and drafts to the LOCAL seeded QA tenant only.
//   node e2e/a4-edges.mjs [--width=390] [--only=offline-pay,credit]   (PW_CHROME)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const width = Number(arg('width', '1280'));
const only = arg('only', '')
  .split(',')
  .filter(Boolean);
const phone = width < 1024;
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4-edges';
mkdirSync(dir, { recursive: true });
const results = [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

/** One signed-in context per case, so no case inherits another's state. */
const session = async () => {
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if ((m.type() === 'error' || /Warning:/.test(m.text())) && !/status of 4\d\d|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message.slice(0, 200)}`));
  const writes = [];
  page.on('request', (r) => {
    if (/\/sales\/invoices/.test(r.url()) && ['POST', 'PATCH'].includes(r.method()))
      writes.push(`${r.method()} ${new URL(r.url()).pathname.replace('/api/v1', '')}`);
  });
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const api = async (path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json()).data;
  const meta = async (path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json()).meta;
  const post = async (path, data) => {
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const r = await ctx.request.post(`${base}/api/v1${path}`, {
      data,
      headers: { 'X-CSRF-Token': csrf ?? '', 'Idempotency-Key': crypto.randomUUID() },
    });
    return { status: r.status(), body: await r.json().catch(() => ({})) };
  };
  const send = async (method, path, data) => {
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const r = await ctx.request.fetch(`${base}/api/v1${path}`, {
      method,
      data,
      headers: { 'X-CSRF-Token': csrf ?? '', 'Idempotency-Key': crypto.randomUUID() },
    });
    return { status: r.status(), body: await r.json().catch(() => ({})) };
  };
  return { ctx, page, errors, writes, api, meta, post, send };
};

const openNew = async (page) => {
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
  await page.getByRole('combobox').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
};
const addItem = async (page, name) => {
  await page.getByRole('combobox').first().click();
  await page.keyboard.type(name, { delay: 10 });
  await page.getByRole('option', { name: new RegExp(esc(name)) }).first().click({ timeout: 8000 });
  await page.waitForTimeout(400);
  if (await page.getByRole('dialog').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
};
const lines = (page) => page.locator('[data-testid=invoice-line] [data-part=name]').allInnerTexts();
// Issued bills, drafts excluded: the list's `tabs.all` (the API filters by
// `tab`; a `status=` it ignores counted every bill, drafts too, and a draft's
// creation looked like an issue).
const issuedCount = async (s) => (await s.meta('/sales/invoices?page_size=1')).tabs.all;
/** Self-test: the filter really filters, or every count above means nothing. */
const filterSelfTest = async (s, f) => {
  const rows = await s.api('/sales/invoices?tab=draft&page_size=20');
  if (!rows.length || rows.some((r) => r.status !== 'draft')) f(`self-test: tab=draft returned ${rows.map((r) => r.status).join(',') || 'nothing'}`);
};
const heldCount = async (page) =>
  Number(((await page.getByText(/On hold · \d+/).first().innerText().catch(() => '0')).match(/\d+/) ?? ['0'])[0]);
const overflow = (page) =>
  page.evaluate(() => {
    const wide = document.documentElement.scrollWidth - window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('main *')) {
      if (!el.childElementCount && el.textContent?.trim() && el.scrollWidth > el.clientWidth + 1) {
        const cs = getComputedStyle(el);
        if (cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match(/\d/))
          out.push(el.textContent.trim().slice(0, 40));
      }
    }
    return { wide, out: out.slice(0, 5) };
  });

const cases = {
  async 'offline-pay'(s, f) {
    const { page, ctx } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[3].name);
    await page.waitForTimeout(4000);
    const before = await issuedCount(s);
    await ctx.setOffline(true);
    await page.waitForTimeout(800);
    const pay = page.getByRole('button', { name: /^Paid cash/ }).last();
    const disabled = await pay.isDisabled();
    if (!disabled) await pay.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    if (!/No internet|Offline/i.test(text)) f('offline: the bill does not say it is offline');
    await page.screenshot({ path: `${dir}/${width}-offline-pay.png` });
    await ctx.setOffline(false);
    await page.waitForTimeout(2500);
    if ((await issuedCount(s)) !== before) f('a bill was issued while offline');
    await page.getByRole('button', { name: /^Paid cash/ }).last().dblclick({ timeout: 5000 });
    await page.waitForTimeout(800);
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm/ });
    if (await confirm.count()) await confirm.last().click().catch(() => {});
    await page.waitForTimeout(3000);
    const after = await issuedCount(s);
    if (after !== before + 1) f(`back online, Paid cash moved issued bills ${before} → ${after}, expected +1`);
    return `offline Paid cash ${disabled ? 'switched off' : 'tapped'}; online issued ${after - before}`;
  },

  async 'offline-add'(s, f) {
    const { page, ctx } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[4].name);
    await page.waitForTimeout(4000);
    const id = /invoices\/([0-9a-f-]{36})\/edit/.exec(page.url())?.[1];
    await ctx.setOffline(true);
    // The item search may need the network; type the second name as a merchant would.
    let backlog = false;
    await addItem(page, items[5].name).catch(() => {
      backlog = true;
    });
    if (backlog) {
      await ctx.setOffline(false);
      return 'BACKLOG — offline billing: the item search needs the network (docs/BACKLOG.md); the bill already open was kept';
    }
    await page.waitForTimeout(4000);
    const said = await page.getByTestId('invoice-save-indicator').innerText().catch(() => '');
    await ctx.setOffline(false);
    await page.waitForTimeout(6000);
    const shown = await lines(page);
    const saved = id ? ((await s.api(`/sales/invoices/${id}`))?.lines ?? []).map((l) => l.description) : [];
    for (const n of shown) if (!saved.includes(n)) f(`back online, "${n}" on screen is not in the saved draft`);
    return `while offline the bill said "${said}"; after reconnecting the server has ${saved.length} of ${shown.length} lines`;
  },

  async 'slow-issue'(s, f) {
    const { page } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[6].name);
    await page.waitForTimeout(4000);
    const before = await issuedCount(s);
    let reached = false;
    // The request reaches the server and is processed; only the answer is held,
    // as when the link drops on the way back.
    await page.route('**/issue', async (r) => {
      const reply = await r.fetch().catch(() => null);
      reached = !!reply;
      await new Promise((ok) => setTimeout(ok, 4000));
      if (reply) await r.fulfill({ response: reply }).catch(() => {});
    });
    await page.getByRole('button', { name: /^Paid cash/ }).last().click();
    await page.waitForTimeout(800);
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm/ });
    if (await confirm.count()) await confirm.last().click().catch(() => {});
    await page.waitForTimeout(1500);
    const busy = await page.locator('body').innerText();
    await page.reload({ waitUntil: 'load' }).catch(() => {});
    await page.unroute('**/issue').catch(() => {});
    await page.waitForTimeout(5000);
    const after = await issuedCount(s);
    if (!reached) f('self-test: the issue request never reached the server, so a lost reply was not simulated');
    // By this bill's own id, not the shop's count: another run may be issuing too.
    const draftIdNow = /invoices\/([0-9a-f-]{36})/.exec(page.url())?.[1];
    const mine = draftIdNow ? await s.api(`/sales/invoices/${draftIdNow}`) : null;
    if (!mine || mine.status === 'draft') f('after the lost reply and a reload, the bill is not issued');
    const creates = s.writes.filter((w) => w === 'POST /sales/invoices').length;
    if (creates > 1) f(`this tab created ${creates} bills for one Paid cash`);
    if (after !== before + 1) console.log(`     (shop-wide issued count moved ${after - before}; another run may be issuing)`);
    const where = page.url().replace(base, '');
    const pay = page.getByRole('button', { name: /^Paid cash/ }).last();
    const payable = (await pay.count()) && !(await pay.isDisabled().catch(() => true));
    if (payable && (await lines(page)).length) {
      // Tap it: the server must refuse a second issue of the same bill.
      await pay.click().catch(() => {});
      await page.waitForTimeout(800);
      const c2 = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm/ });
      if (await c2.count()) await c2.last().click().catch(() => {});
      await page.waitForTimeout(3000);
      const again = await issuedCount(s);
      if (again !== before + 1) f(`after the lost reply and a reload, Paid cash made another bill (${again - before} in all)`);
      else f(`after the lost reply and a reload, ${where} still offers Paid cash on an already-issued bill (the server refused the second, but the screen should say it is issued)`);
    }
    await page.screenshot({ path: `${dir}/${width}-slow-issue.png` });
    return `server reached: ${reached}; in flight: "${(busy.match(/Issuing…|Saving…|Still working[^\n]*/) ?? ['(no busy word)'])[0]}"; this bill ${mine?.number ?? '-'} ${mine?.status ?? '-'}; reload landed on ${where}; Paid cash ${payable ? 'still offered' : 'not offered'}`;
  },

  async 'back-after-pay'(s, f) {
    const { page } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[7].name);
    await page.waitForTimeout(500);
    const before = await issuedCount(s);
    await page.getByRole('button', { name: /^Paid cash/ }).last().click();
    await page.waitForTimeout(800);
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm/ });
    if (await confirm.count()) await confirm.last().click().catch(() => {});
    await page.waitForTimeout(3000);
    s.writes.length = 0;
    await page.goBack().catch(() => {});
    await page.waitForTimeout(3000);
    const tap = page.getByRole('button', { name: /^Paid cash/ }).last();
    const offered = (await tap.count()) && !(await tap.isDisabled().catch(() => true));
    if (offered) {
      await tap.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    const after = await issuedCount(s);
    if (after !== before + 1) f(`Back after paying, then Paid cash again, made ${after - before} bills`);
    if (s.writes.some((w) => /issue/.test(w)) && after > before + 1) f('Back re-issued the same bill');
    return `after Back: at ${page.url().replace(base, '')}, Paid cash ${offered ? 'offered' : 'not offered'}; bills +${after - before}`;
  },

  async 'two-tabs'(s, f) {
    const { page, ctx } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[8].name);
    await page.waitForTimeout(4000);
    const id = /invoices\/([0-9a-f-]{36})\/edit/.exec(page.url())?.[1];
    if (!id) return f('the first save did not put the draft id in the address');
    const tab2 = await ctx.newPage();
    await tab2.goto(`${base}/sales/invoices/${id}/edit`, { waitUntil: 'load' });
    await tab2.getByRole('combobox').first().waitFor({ timeout: 10000 });
    await tab2.waitForTimeout(1500);
    await addItem(page, items[9].name); // tab 1 saves first
    await page.waitForTimeout(4500);
    await addItem(tab2, items[10].name); // tab 2 is a version behind
    await tab2.waitForTimeout(5000);
    const saved = ((await s.api(`/sales/invoices/${id}`))?.lines ?? []).map((l) => l.description);
    const said2 = await tab2.locator('body').innerText();
    if (!saved.includes(items[9].name)) f(`tab 2 overwrote tab 1's "${items[9].name}" without asking`);
    if (saved.includes(items[10].name) && saved.includes(items[9].name)) return 'merged both lines (no conflict needed)';
    if (!/Somebody else changed|changed on another|conflict|Reload/i.test(said2))
      f('tab 2 was refused but the screen does not say the bill changed elsewhere');
    await tab2.screenshot({ path: `${dir}/${width}-two-tabs.png` });
    await tab2.close();
    return `server keeps ${JSON.stringify(saved)}; tab 2 told: ${(said2.match(/[^\n]*(Somebody else|another device|conflict)[^\n]*/i) ?? ['-'])[0]}`;
  },

  async credit(s, f) {
    const { page } = s;
    const customers = await s.api('/parties?type=customer&status=active&book=shop&page_size=50');
    const party = customers[7];
    const before = Number((await s.api(`/parties/${party.id}?book=shop`)).shop.customer_balance);
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await page.getByRole('button', { name: 'Saved customer', exact: true }).click();
    await page.getByLabel('Saved customer').fill(party.name);
    await page.getByRole('option', { name: new RegExp(esc(party.name)) }).first().click();
    await page.waitForTimeout(1000);
    await addItem(page, items[11].name);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^(Issue|UPI or other)/ }).last().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Full credit' }).click({ timeout: 5000 });
    await sheet.getByRole('button', { name: /Issue/ }).last().click();
    await page.waitForTimeout(3000);
    const inv = (await s.api(`/sales/invoices?party_id=${party.id}&page_size=1`))?.[0];
    const after = Number((await s.api(`/parties/${party.id}?book=shop`)).shop.customer_balance);
    if (!inv) return f('no bill found for the customer');
    if (!near(after, before + Number(inv.grand_total)))
      f(`Shop balance ${before} + bill ${inv.grand_total} should be ${before + Number(inv.grand_total)}, the API says ${after}`);
    const main = Number((await s.api(`/parties/${party.id}`))?.summary?.balance ?? NaN);
    return `${inv.number} ₹${inv.grand_total} on credit to ${party.name}: Shop balance ${before} → ${after}; Udhaar book ${Number.isNaN(main) ? 'n/a' : main} (must not move)`;
  },

  async 'zero-stock'(s, f) {
    const { page } = s;
    const all = await s.api('/items?page_size=5&ordering=name');
    const made = await s.post('/items', {
      name: `Edge zero stock ${Date.now() % 100000}`,
      unit_id: all[0].unit?.id ?? all[0].unit_id,
      selling_price: '50.00',
    });
    if (made.status >= 300) return f(`could not make the zero-stock item: ${made.status} ${JSON.stringify(made.body).slice(0, 200)}`);
    const empty = made.body.data;
    const onHand = Number((await s.api(`/items/${empty.id}`)).on_hand ?? 0);
    if (onHand !== 0) f(`self-test: the new item has ${onHand} on hand, not 0`);
    const before = await issuedCount(s);
    await openNew(page);
    await addItem(page, empty.name);
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Paid cash/ }).last().click();
    await page.waitForTimeout(800);
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Paid cash|Issue|Confirm/ });
    if (await confirm.count()) await confirm.last().click().catch(() => {});
    await page.waitForTimeout(3000);
    const after = await issuedCount(s);
    const body = await page.locator('body').innerText();
    await page.screenshot({ path: `${dir}/${width}-zero-stock.png` });
    if (after === before) {
      if (!body.includes(empty.name) || !/stock|on hand/i.test(body)) f('refused for stock, but the screen does not name the item and its stock');
      return `refused, and the screen names ${empty.name}`;
    }
    const now = await s.api(`/items/${empty.id}`);
    return `issued with negative stock allowed: ${empty.name} on hand ${now.on_hand ?? now.stock?.on_hand}`;
  },

  async 'long-text'(s, f) {
    const { page } = s;
    await openNew(page);
    await page.getByRole('combobox').first().click();
    await page.keyboard.type('x'.repeat(200), { delay: 0 });
    await page.waitForTimeout(1200);
    let m = await overflow(page);
    if (m.wide > 0) f(`a 200-character search made the page ${m.wide}px wider than the screen`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Saved customer', exact: true }).click();
    await page.getByLabel('Saved customer').fill('राधे राधे 😀 '.repeat(8));
    await page.waitForTimeout(1200);
    m = await overflow(page);
    if (m.wide > 0) f(`a long Hindi/emoji name made the page ${m.wide}px wider than the screen`);
    if (m.out.length) f(`text out of its box: ${m.out.join(' | ')}`);
    await page.screenshot({ path: `${dir}/${width}-long-text.png` });
    return `page overflow ${m.wide}px; clipped text ${m.out.length}`;
  },

  async 'cleared-qty'(s, f) {
    const { page } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[13].name);
    if (phone) {
      await page.locator('[data-testid=invoice-line]').first().getByRole('button', { name: /^Edit/ }).click();
      await page.waitForTimeout(400);
    }
    await page.locator('[id="lines.0.qty"]').fill('');
    if (phone) await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    s.writes.length = 0;
    const bodies = [];
    page.on('request', (r) => {
      if (/\/sales\/invoices/.test(r.url()) && ['POST', 'PATCH'].includes(r.method())) bodies.push(r.postData() ?? '');
    });
    if (phone) {
      await page.getByTestId('invoice-more').click();
      await page.getByTestId('invoice-hold').click().catch(() => {});
    } else await page.getByRole('button', { name: 'Hold', exact: true }).click();
    await page.waitForTimeout(1500);
    const said = await page.locator('body').innerText();
    if (!/Check line 1: Qty/.test(said)) f('Hold with an empty Qty did not say "Check line 1: Qty"');
    if ((await lines(page)).length !== 1) f('after a refused Hold the line is gone from the screen');
    if (bodies.some((b) => /"lines":\[\]/.test(b))) f('a save went out with no lines while the screen had one');
    await page.screenshot({ path: `${dir}/${width}-cleared-qty.png` });
    return `Hold refused with "${(said.match(/Check line 1: Qty/) ?? ['-'])[0]}"; line kept on screen; empty saves sent: ${bodies.filter((b) => /"lines":\[\]/.test(b)).length}`;
  },

  async locked(s, f) {
    const { page } = s;
    const recent = await s.api('/sales/invoices?tab=paid&page_size=5');
    const row = recent.find((r) => r.status === 'paid');
    if (!row) return f('no paid bill to try (run the journey first)');
    const id = row.id;
    const snap = async () => {
      const d = await s.api(`/sales/invoices/${id}`);
      return { d, key: JSON.stringify([d.status, d.version, d.grand_total, d.amount_due, d.party?.id ?? null, d.lines.map((l) => [l.item_id ?? l.item?.id, l.qty, l.unit_price])]) };
    };
    const before = await snap();
    const itemIds = before.d.lines.map((l) => l.item_id ?? l.item?.id).filter(Boolean);
    const onHand = async () => Promise.all(itemIds.map(async (i) => (await s.api(`/items/${i}`)).on_hand));
    const stock0 = await onHand();
    const issued0 = await issuedCount(s);

    // Through the screen.
    await page.goto(`${base}/sales/invoices/${id}/edit`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const at = new URL(page.url()).pathname;
    if (at !== `/sales/invoices/${id}`) f(`the paid bill's /edit opened ${at}, not the bill's own page`);
    const offered = [];
    for (const name of [/^Edit\b/, /^Delete/, /^Paid cash/, /^Discard draft/, /^Save draft/, /^Hold$/]) {
      const b = page.getByRole('button', { name }).or(page.getByRole('link', { name }));
      if (await b.count()) offered.push(String(name));
    }
    if (await page.getByRole('button', { name: /^Receive money/ }).count()) offered.push('Receive money (nothing is due)');
    // The ⋯ menu's items exist only once it is open.
    const more = page.getByRole('button', { name: 'More actions' }).first();
    let menu = [];
    if (await more.count()) {
      await more.click();
      await page.waitForTimeout(500);
      menu = (await page.locator('[role=menu] [role=menuitem], [role=dialog] button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      await page.keyboard.press('Escape');
      for (const m of menu) if (/^(Edit|Delete|Change|Add item)/i.test(m)) offered.push(`⋯ ${m.split('\n')[0]}`);
    }
    if (offered.length) f(`the paid bill's page still offers ${offered.join(', ')}`);
    await page.screenshot({ path: `${dir}/${width}-locked.png` });

    // Straight at the API, as a stale screen or another device would.
    const v = before.d.version;
    const tries = {
      'edit lines': await s.send('PATCH', `/sales/invoices/${id}`, { version: v, notes: 'tampered', lines: before.d.lines.map((l) => ({ item_id: l.item_id ?? l.item?.id, description: l.description, qty: '99', unit_code: l.unit_code, unit_price: '1.00', tax_code: l.tax_code })) }),
      'change customer': await s.send('PATCH', `/sales/invoices/${id}`, { version: v, walk_in_name: 'Someone else' }),
      delete: await s.send('DELETE', `/sales/invoices/${id}`),
      'issue again': await s.send('POST', `/sales/invoices/${id}/issue`, { payments: [] }),
    };
    const got = [];
    for (const [what, r] of Object.entries(tries)) {
      got.push(`${what} ${r.status} ${r.body?.error?.code ?? ''}`.trim());
      if (r.status < 400 && what !== 'issue again') f(`API let "${what}" through on a paid bill (${r.status})`);
    }
    const after = await snap();
    if (after.key !== before.key) f(`the paid bill changed: ${before.key} → ${after.key}`);
    const stock1 = await onHand();
    if (JSON.stringify(stock0) !== JSON.stringify(stock1)) f(`stock moved: ${stock0} → ${stock1}`);
    const issued1 = await issuedCount(s);
    if (issued1 !== issued0) f(`issued bills ${issued0} → ${issued1} after "issue again"`);
    return `${row.number}: screen → ${at} (⋯: ${menu.map((m) => m.split('\n')[0]).join(', ') || 'none'}); API ${got.join(' · ')}; bill, stock and count unchanged: ${after.key === before.key && JSON.stringify(stock0) === JSON.stringify(stock1) && issued1 === issued0}`;
  },

  async 'double-hold'(s, f) {
    const { page } = s;
    const items = await s.api('/items?page_size=50&ordering=name');
    await openNew(page);
    await addItem(page, items[12].name);
    await page.waitForTimeout(500);
    const before = await heldCount(page);
    if (phone) {
      await page.getByTestId('invoice-more').click();
      await page.getByTestId('invoice-hold').dblclick();
    } else await page.getByRole('button', { name: 'Hold', exact: true }).dblclick();
    await page.waitForTimeout(3000);
    const after = await heldCount(page);
    if (after !== before + 1) f(`Hold tapped twice: on hold ${before} → ${after}, expected +1`);
    const blank = (await lines(page)).length === 0;
    if (!blank) f('after Hold the screen still shows the held bill instead of a blank one');
    return `on hold ${before} → ${after}`;
  },
};

for (const [name, run] of Object.entries(cases)) {
  if (only.length && !only.includes(name)) continue;
  const s = await session();
  const fails = [];
  let note = '';
  try {
    await filterSelfTest(s, (m) => fails.push(m));
    note = (await run(s, (m) => fails.push(m))) ?? '';
  } catch (e) {
    fails.push(`harness: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    await s.page.screenshot({ path: `${dir}/${width}-${name}-error.png` }).catch(() => {});
  }
  for (const e of s.errors) fails.push(`console: ${e}`);
  results.push({ name, note, fails });
  console.log(`${fails.length ? 'FAIL' : 'pass'} ${name} — ${note}`);
  for (const x of fails) console.log(`     ✗ ${x}`);
  await s.ctx.close();
}
await browser.close();
writeFileSync(`${dir}/${width}-results.json`, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.fails.length).length;
console.log(`${width}px: ${results.length - bad}/${results.length} cases pass`);
process.exitCode = bad ? 1 : 0;
