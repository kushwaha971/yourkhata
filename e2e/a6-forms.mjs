// A6 — the Shop's separate customer and supplier forms, checked against the
// design (docs/performance/2026-10-28-shop-a6-customer-supplier-forms.md F1–F9)
// on the running app, and the saves read back from the API.
//
// Look (every width × theme × locale): the title, the subtitle, no role
// switches, the placeholders, Credit days only on the customer, "More details"
// open with its subtitle, reminders only on the customer, the footer words,
// no box whose text overflows it and no page wider than the screen.
//
// Functional (English light, 390 and 1280): a customer and a supplier saved
// through the form, the request body captured and the record read back by id;
// "Also a customer" makes both; a double tap on Add makes one record.
// `--skew` flips one expected role, and the run must then FAIL (the read-back
// can fail).
//
//   node e2e/a6-forms.mjs [--width=390,320,1280] [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const widths = arg('width', '390,320,1280').split(',').map(Number);
const skew = process.argv.includes('--skew');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a6';
mkdirSync(dir, { recursive: true });

const W = {
  en: {
    addC: 'Add customer', addS: 'Add supplier', subS: 'No reminders: they are for customers who have to pay you',
    nameC: 'Customer name', nameS: 'Supplier or company name', mobile: 'Mobile number',
    more: 'More details', moreC: 'Code, address, reminders', moreS: 'GSTIN, code, address',
    credit: 'Credit days', remind: 'Send them reminders', alsoS: 'Also a supplier', alsoC: 'Also a customer',
    linkC: 'Already your supplier? (optional)', linkS: 'Already your customer? (optional)',
    editC: 'Edit customer', editS: 'Edit supplier',
    roles: ['I sell to them', 'I buy from them'],
  },
  hi: {
    addC: 'ग्राहक जोड़ें', addS: 'सप्लायर जोड़ें', subS: 'रिमाइंडर नहीं: वे उन ग्राहकों के लिए हैं जिन्हें आपको पैसे देने हैं',
    nameC: 'ग्राहक का नाम', nameS: 'सप्लायर या कंपनी का नाम', mobile: 'मोबाइल नंबर',
    moreC: 'कोड, पता, रिमाइंडर', moreS: 'GSTIN, कोड, पता',
  },
};

const failures = [];
const fail = (k, m) => failures.push(`${k}: ${m}`);
let consoleErrors = 0;

/** In the page: what the open dialog shows, and what does not fit. */
const inspect = () => {
  const d = [...document.querySelectorAll('[role=dialog]')].pop();
  if (!d) return null;
  const R = (e) => e.getBoundingClientRect();
  const visible = (e) => R(e).width > 0 && R(e).height > 0;
  const title = d.querySelector('h2')?.textContent?.trim() ?? '';
  // The drawer's own subtitle, by the id its title shares (`<id>-title`); a
  // switch's description also ends in "-description" and is not it.
  const tid = d.querySelector('h2')?.id?.replace(/-title$/, '');
  const desc = (tid && document.getElementById(`${tid}-description`)?.textContent?.trim()) || '';
  const placeholders = [...d.querySelectorAll('input')].filter(visible).map((i) => i.placeholder);
  const labels = [...d.querySelectorAll('label')].filter(visible).map((l) => l.textContent.trim());
  const switches = [...d.querySelectorAll('[role=switch]')].filter(visible).map((s) => s.getAttribute('aria-label') ?? s.closest('label')?.textContent?.trim() ?? s.id);
  const switchNames = [...d.querySelectorAll('[role=switch]')].map((s) => {
    const id = s.getAttribute('aria-labelledby');
    return (id && document.getElementById(id)?.textContent) || s.closest('label')?.textContent || document.querySelector(`label[for="${s.id}"]`)?.textContent || '';
  });
  const disc = [...d.querySelectorAll('button[aria-expanded]')].map((b) => ({ text: b.textContent.trim(), open: b.getAttribute('aria-expanded') }));
  const footer = [...(d.querySelector('[data-ub-overlay-footer]')?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim());
  // H18: a text node wider than its own box is cut, whatever innerText says.
  const cut = [...d.querySelectorAll('label, button, h2, p, [data-part=message] *')]
    .filter((e) => visible(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible')
    .map((e) => e.textContent.trim().slice(0, 30));
  const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
  const outside = R(d).right > window.innerWidth + 1 || R(d).left < -1;
  return { title, desc, placeholders, labels, switches, switchNames, disc, footer, cut, wide, outside };
};

const signIn = async (ctx) => {
  const page = await ctx.newPage();
  let signedIn = false; // the login page's own 401 probes of /auth/me are expected
  page.on('console', (m) => {
    if (m.type() !== 'error' || !signedIn) return;
    consoleErrors += 1;
    if (consoleErrors <= 3) console.log('console error:', m.text().slice(0, 200), m.location()?.url ?? '');
  });
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  signedIn = true;
  return page;
};

const openForm = async (page, kind, w) => {
  await page.goto(`${base}/${kind === 'customer' ? 'customers' : 'suppliers'}`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: kind === 'customer' ? w.addC : w.addS }).first().click();
  const dlg = page.getByRole('dialog').last();
  await dlg.waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
  return dlg;
};

const checkLook = (key, kind, r, w, en) => {
  const c = kind === 'customer';
  if (r.title !== (c ? w.addC : w.addS)) fail(key, `F1 title "${r.title}"`);
  if (c ? r.desc !== '' : r.desc !== w.subS) fail(key, `F2 subtitle "${r.desc}"`);
  for (const role of en.roles) if (r.switchNames.some((s) => s.includes(role))) fail(key, `F3 role switch "${role}"`);
  if (!r.placeholders.includes(c ? w.nameC : w.nameS)) fail(key, `F4 name placeholder: ${r.placeholders.join(' | ')}`);
  if (!r.placeholders.includes(w.mobile)) fail(key, 'F4 mobile placeholder');
  const more = r.disc.find((x) => x.text.includes(c ? w.moreC : w.moreS));
  // R-DEC-61 (owner, 28 Oct): a busy counter asks a name and a number only, so
  // "More details" starts CLOSED, on both forms (it overrides the mock's open).
  if (!more) fail(key, `F5 More details subtitle: ${JSON.stringify(r.disc)}`);
  else if (more.open !== 'false') fail(key, 'F5 More details starts open');
  if (r.footer.at(-1) !== (c ? w.addC : w.addS)) fail(key, `F8 footer "${r.footer.join(' · ')}"`);
  if (r.cut.length) fail(key, `H18 cut text: ${r.cut.join(' | ')}`);
  if (r.wide) fail(key, 'page wider than the screen');
  if (r.outside) fail(key, 'dialog outside the screen');
};

const api = async (ctx, path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json());

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
for (const width of widths) {
  for (const theme of ['light', 'dark']) {
    for (const locale of ['en', 'hi']) {
      const ctx = await browser.newContext({
        viewport: { width, height: width < 1024 ? 800 : 860 },
        colorScheme: theme,
        locale: locale === 'hi' ? 'hi-IN' : 'en-IN',
      });
      await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
      const page = await signIn(ctx);
      const w = { ...W.en, ...(locale === 'hi' ? W.hi : {}) };
      for (const kind of ['customer', 'supplier']) {
        const key = `${width}-${theme}-${locale}-${kind}`;
        try {
          const dlg = await openForm(page, kind, w);
          const r0 = await page.evaluate(inspect);
          checkLook(key, kind, r0, w, W.en);
          if (locale === 'en') {
            // The counter path: the optional pick, Name and Mobile, nothing else.
            const want = [kind === 'customer' ? w.linkC : w.linkS, 'Name', w.mobile];
            if (JSON.stringify(r0.labels) !== JSON.stringify(want)) fail(key, `counter fields: ${r0.labels.join(' > ')}`);
            if (r0.switchNames.length) fail(key, `a switch before More details: ${r0.switchNames.join(' | ')}`);
          }
          await dlg.locator('button[aria-expanded]').filter({ hasText: kind === 'customer' ? w.moreC : w.moreS }).click();
          await page.waitForTimeout(400);
          const r = await page.evaluate(inspect);
          if (locale === 'en') {
            const hasCredit = r.labels.includes(w.credit);
            if (kind === 'customer' ? !hasCredit : hasCredit) fail(key, `F4 Credit days ${hasCredit ? 'shown' : 'missing'}`);
            const remind = r.switchNames.some((s) => s.includes(w.remind));
            if (kind === 'customer' ? !remind : remind) fail(key, `F7 reminders ${remind ? 'shown' : 'missing'}`);
            // R-DEC-61: no "Also a …" switch; the rare both-roles person is picked.
            const also = r.switchNames.some((s) => s.includes(kind === 'customer' ? w.alsoS : w.alsoC));
            if (also) fail(key, 'F9 also-role switch still shown');
            // F6 order, by DOM order of the visible labels: the design's first
            // fields come before the kept ones (found by looking: reminders sat
            // under "Another number" and "Note").
            const at = (x) => r.labels.indexOf(x);
            const [first, kept] = kind === 'customer' ? ['How they agreed', 'Another number'] : ['GSTIN', 'Your code for them'];
            if (at(first) < 0 || at(kept) < 0 || at(first) > at(kept)) fail(key, `F6 order: ${r.labels.join(' > ')}`);
          }
          await dlg.screenshot({ path: `${dir}/${key}.png` });
          await dlg.evaluate((d) => d.querySelector('[data-ub-dialog-body]')?.scrollTo(0, 0));
          await page.screenshot({ path: `${dir}/${key}-page.png` });
        } catch (e) {
          fail(key, `error ${e.message.split('\n')[0]}`);
        }
      }

      // ── Functional, once per width ────────────────────────────────────────
      if (theme === 'light' && locale === 'en' && width !== 320) {
        const stamp = `${Date.now().toString(36)}${width}`;
        const bodies = [];
        page.on('request', (q) => {
          if (q.method() === 'POST' && /\/api\/v1\/parties$/.test(new URL(q.url()).pathname)) bodies.push(q.postDataJSON());
        });
        // A customer, double-tapped Add, Credit days 7.
        const cName = `A6 Cust ${stamp}`;
        let dlg = await openForm(page, 'customer', w);
        await dlg.getByLabel('Name').fill(cName);
        await dlg.locator('button[aria-expanded]').filter({ hasText: w.moreC }).click();
        await dlg.getByLabel(w.credit).fill('7');
        await dlg.getByLabel('Old balance to collect (optional)').fill('1500');
        const add = dlg.getByRole('button', { name: w.addC });
        await add.dblclick();
        await dlg.waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail(`${width}-fn`, 'customer drawer did not close'));
        await page.waitForTimeout(800);
        const cHits = (await api(ctx, `/parties?q=${encodeURIComponent(cName)}&book=shop&page_size=50`)).data.filter((p) => p.name === cName);
        if (cHits.length !== 1) fail(`${width}-fn`, `double Add made ${cHits.length} customers`);
        if (cHits[0]) {
          const p = (await api(ctx, `/parties/${cHits[0].id}`)).data;
          const wantSupplier = skew; // --skew: expect the wrong role, so the run must fail
          if (p.is_customer !== true || p.is_supplier !== wantSupplier) fail(`${width}-fn`, `customer roles read back c=${p.is_customer} s=${p.is_supplier}`);
          if (p.credit_days !== 7) fail(`${width}-fn`, `credit_days read back ${p.credit_days}`);
          // A6 / DEC-019: the old balance is the SHOP's money, never the Udhaar book's.
          const shop = (await api(ctx, `/parties/${cHits[0].id}?book=shop`)).data.shop;
          const want = skew ? '0.00' : '1500.00';
          if (shop.customer_balance !== want || shop.customer_opening !== '1500.00')
            fail(`${width}-fn`, `Shop old balance read back ${shop.customer_balance} / opening ${shop.customer_opening}`);
          if (Number(p.balance) !== 0) fail(`${width}-fn`, `the Udhaar book moved to ${p.balance}`);
          const cb = bodies.find((b) => b.name === cName);
          if (!cb || !('sms_opt_in' in cb)) fail(`${width}-fn`, 'customer body lacks sms_opt_in');
        }
        // A supplier-only contact: no reminder keys on the wire.
        const sName = `A6 Supp ${stamp}`;
        dlg = await openForm(page, 'supplier', w);
        await dlg.getByLabel('Name').fill(sName);
        await dlg.locator('button[aria-expanded]').filter({ hasText: w.moreS }).click();
        await dlg.getByLabel('Note (optional)').fill('Pays by cheque');
        await dlg.getByLabel('Old balance to pay (optional)').fill('900');
        await dlg.getByRole('button', { name: w.addS }).click();
        await dlg.waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail(`${width}-fn`, 'supplier drawer did not close'));
        await page.waitForTimeout(800);
        const sb = bodies.find((b) => b.name === sName);
        if (!sb) fail(`${width}-fn`, 'no supplier POST seen');
        else if ('sms_opt_in' in sb || 'consent_source' in sb) fail(`${width}-fn`, 'supplier body sends reminder keys');
        const sHit = (await api(ctx, `/parties?q=${encodeURIComponent(sName)}&book=shop&page_size=50`)).data.find((p) => p.name === sName);
        if (!sHit) fail(`${width}-fn`, 'supplier not found');
        else {
          const p = (await api(ctx, `/parties/${sHit.id}`)).data;
          if (p.is_supplier !== true || p.is_customer !== false) fail(`${width}-fn`, `supplier roles c=${p.is_customer} s=${p.is_supplier}`);
          const sf = (await api(ctx, `/parties/${sHit.id}?book=shop`)).data.shop;
          if (sf.supplier_balance !== '900.00' || sf.customer_balance !== '0.00') fail(`${width}-fn`, `supplier old balance ${sf.supplier_balance} / customer ${sf.customer_balance}`);
        }
        // R-DEC-61: that supplier also buys. On Add customer the merchant
        // PICKS them; the save must update the same record (one contact, both
        // roles, the note kept), not make a second one.
        dlg = await openForm(page, 'customer', w);
        await dlg.getByRole('combobox', { name: w.linkC }).fill(sName);
        await page.waitForTimeout(900); // the search settles; a pick waits for it
        await dlg.getByRole('option', { name: new RegExp(sName) }).first().click();
        await dlg.getByText('Your supplier · will be your customer too').waitFor({ timeout: 6000 }).catch(() => fail(`${width}-fn`, 'no picked-contact card'));
        if ((await dlg.getByLabel('Name').inputValue()) !== sName) fail(`${width}-fn`, 'the pick did not fill the name');
        await dlg.screenshot({ path: `${dir}/${width}-picked.png` });
        const before = bodies.length;
        await dlg.getByRole('button', { name: w.addC }).click();
        await dlg.waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail(`${width}-fn`, 'picked drawer did not close'));
        await page.waitForTimeout(800);
        if (bodies.length !== before) fail(`${width}-fn`, 'picking made a POST (a new record)');
        const same = (await api(ctx, `/parties?q=${encodeURIComponent(sName)}&page_size=50`)).data.filter((p) => p.name === sName);
        if (same.length !== 1) fail(`${width}-fn`, `${same.length} contacts named ${sName}`);
        const bp = sHit && (await api(ctx, `/parties/${sHit.id}`)).data;
        if (!bp || bp.is_supplier !== true || bp.is_customer !== true) fail(`${width}-fn`, `picked roles ${bp ? `c=${bp.is_customer} s=${bp.is_supplier}` : 'missing'}`);
        if (bp && bp.notes !== 'Pays by cheque') fail(`${width}-fn`, `picked note became "${bp?.notes}"`);
        const bName = sName;

        // Edit in the Shop is the customer form: its own title, no role switch.
        await page.goto(`${base}/customers?q=${encodeURIComponent(cName)}`, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        await page.getByRole('button', { name: `Open ${cName}` }).or(page.getByRole('link', { name: new RegExp(cName) })).first().click();
        await page.waitForTimeout(1500);
        if (!(await page.getByText('Started with ₹1,500.00 old balance').count()))
          fail(`${width}-fn`, 'the person page does not say where the figure came from');
        await page.screenshot({ path: `${dir}/${width}-person-old-balance.png` });
        // A payment with no bill goes against the old balance: the words say so
        // (not "advance for the next bill"), the Shop figure drops, and the
        // Udhaar book never moves (DEC-019).
        await page.getByRole('button', { name: 'Receive payment' }).first().click();
        const pay = page.getByRole('dialog').last();
        await pay.waitFor();
        await page.waitForTimeout(800);
        await pay.getByLabel(/^Amount/).first().fill('500');
        await page.waitForTimeout(400);
        if (!(await pay.getByText('No unpaid bills. The ₹500.00 goes against their old balance.').count()))
          fail(`${width}-fn`, 'the payment sheet does not say the money goes against the old balance');
        await pay.locator('[data-ub-overlay-footer] button').last().click();
        await pay.getByText('₹500.00 against the old balance').waitFor({ timeout: 8000 }).catch(() =>
          fail(`${width}-fn`, 'the receipt does not say "against the old balance"'));
        await pay.screenshot({ path: `${dir}/${width}-paid-old-balance.png` });
        const afterPay = (await api(ctx, `/parties/${cHits[0].id}?book=shop`)).data;
        if (afterPay.shop.customer_balance !== '1000.00') fail(`${width}-fn`, `after ₹500 the Shop figure is ${afterPay.shop.customer_balance}`);
        if (Number((await api(ctx, `/parties/${cHits[0].id}`)).data.balance) !== 0) fail(`${width}-fn`, 'the payment moved the Udhaar book');
        await pay.getByRole('button', { name: 'Done' }).click().catch(() => page.keyboard.press('Escape'));
        await pay.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
        // Edit is a header button on a desktop and behind "More" on a phone.
        const editBtn = page.getByRole('button', { name: /^Edit/ }).first();
        if (!(await editBtn.isVisible().catch(() => false))) {
          await page.getByRole('button', { name: /^More( actions)?$/ }).first().click();
          await page.waitForTimeout(400);
        }
        await page.getByRole('button', { name: /^Edit/ }).or(page.getByRole('menuitem', { name: /^Edit/ })).first().click();
        const ed = page.getByRole('dialog').last();
        await ed.waitFor();
        await page.waitForTimeout(500);
        const re = await page.evaluate(inspect);
        if (re.title !== w.editC) fail(`${width}-fn`, `edit title "${re.title}"`);
        if (re.switchNames.some((n) => W.en.roles.some((x) => n.includes(x)))) fail(`${width}-fn`, 'edit shows role switches');
        await ed.screenshot({ path: `${dir}/${width}-edit.png` });
        await ed.getByRole('button', { name: 'Save changes' }).click();
        await ed.waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail(`${width}-fn`, 'edit did not close'));
        const ce = cHits[0] && (await api(ctx, `/parties/${cHits[0].id}`)).data;
        if (ce && (ce.is_customer !== true || ce.is_supplier !== skew)) fail(`${width}-fn`, `edit changed roles c=${ce.is_customer} s=${ce.is_supplier}`);
        console.log(`${width} functional: customer ${cName}, supplier ${sName}, both ${bName}`);
      }
      await ctx.close();
    }
  }
}
// ── Choose from phone contacts (an Android phone's Contact Picker) ──────────
// Headless Chrome has no picker, so the button is hidden there, as on every
// desktop and on iOS Safari. Here the picker is simulated, as Chrome on Android
// provides it, and both forms must show the button and fill Name and Mobile.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'contacts', {
      value: { select: async () => [{ name: ['Asha Devi'], tel: ['098765 43210'] }] },
    });
  });
  const page = await signIn(ctx);
  for (const kind of ['customer', 'supplier']) {
    const key = `390-contacts-${kind}`;
    try {
      const dlg = await openForm(page, kind, W.en);
      const btn = dlg.getByRole('button', { name: 'Choose from phone contacts' });
      if (!(await btn.isVisible())) { fail(key, 'no "Choose from phone contacts" button'); continue; }
      await btn.click();
      await page.waitForTimeout(500);
      const name = await dlg.getByLabel('Name').inputValue();
      const mobile = await dlg.getByLabel('Mobile number').inputValue();
      if (name !== 'Asha Devi') fail(key, `contact name "${name}"`);
      if (mobile.replace(/\D/g, '') !== '9876543210') fail(key, `contact mobile "${mobile}"`);
      await dlg.screenshot({ path: `${dir}/${key}.png` });
    } catch (e) {
      fail(key, `error ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
const views = widths.length * 2 * 2 * 2;
console.log(failures.join('\n'));
console.log(`${views} views, ${failures.length} failures, ${consoleErrors} console errors${skew ? ' (SKEWED: failures expected)' : ''}`);
process.exit(skew ? (failures.length ? 0 : 1) : failures.length || consoleErrors ? 1 : 0);
