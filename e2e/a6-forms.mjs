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
    addC: 'Add customer', addS: 'Add supplier', subS: 'No reminders: they are for people who owe you',
    nameC: 'Customer name', nameS: 'Supplier or company name', mobile: 'Mobile number',
    more: 'More details', moreC: 'Code, address, reminders', moreS: 'GSTIN, code, address',
    credit: 'Credit days', remind: 'Send them reminders', alsoS: 'Also a supplier', alsoC: 'Also a customer',
    roles: ['I sell to them', 'I buy from them'],
  },
  hi: {
    addC: 'ग्राहक जोड़ें', addS: 'सप्लायर जोड़ें', subS: 'रिमाइंडर नहीं: वे उनके लिए हैं जिन पर आपका पैसा बाकी है',
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
  if (!more) fail(key, `F5 More details subtitle: ${JSON.stringify(r.disc)}`);
  else if (more.open !== 'true') fail(key, 'F5 More details not open');
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
          const r = await page.evaluate(inspect);
          checkLook(key, kind, r, w, W.en);
          if (locale === 'en') {
            const hasCredit = r.labels.includes(w.credit);
            if (kind === 'customer' ? !hasCredit : hasCredit) fail(key, `F4 Credit days ${hasCredit ? 'shown' : 'missing'}`);
            const remind = r.switchNames.some((s) => s.includes(w.remind));
            if (kind === 'customer' ? !remind : remind) fail(key, `F7 reminders ${remind ? 'shown' : 'missing'}`);
            const also = r.switchNames.some((s) => s.includes(kind === 'customer' ? w.alsoS : w.alsoC));
            if (!also) fail(key, 'F9 also-role switch missing');
            // F6 order, by DOM order of the visible labels: the design's first
            // fields come before the kept ones (found by looking: reminders sat
            // under "Another number" and "Note").
            const at = (x) => r.labels.indexOf(x);
            const [first, kept] = kind === 'customer' ? ['How they agreed', 'Another number'] : ['GSTIN', 'Your code for them'];
            if (at(first) < 0 || at(kept) < 0 || at(first) > at(kept)) fail(key, `F6 order: ${r.labels.join(' > ')}`);
          }
          await dlg.screenshot({ path: `${dir}/${key}.png` });
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
        await dlg.getByLabel(w.credit).fill('7');
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
          const cb = bodies.find((b) => b.name === cName);
          if (!cb || !('sms_opt_in' in cb)) fail(`${width}-fn`, 'customer body lacks sms_opt_in');
        }
        // A supplier-only contact: no reminder keys on the wire.
        const sName = `A6 Supp ${stamp}`;
        dlg = await openForm(page, 'supplier', w);
        await dlg.getByLabel('Name').fill(sName);
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
        }
        // A supplier who is also a customer: both.
        const bName = `A6 Both ${stamp}`;
        dlg = await openForm(page, 'supplier', w);
        await dlg.getByLabel('Name').fill(bName);
        await dlg.getByRole('switch', { name: new RegExp(`^${w.alsoC}`) }).click();
        await dlg.getByRole('button', { name: w.addS }).click();
        await dlg.waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail(`${width}-fn`, 'both drawer did not close'));
        await page.waitForTimeout(800);
        const bHit = (await api(ctx, `/parties?q=${encodeURIComponent(bName)}&book=shop&page_size=50`)).data.find((p) => p.name === bName);
        const bp = bHit && (await api(ctx, `/parties/${bHit.id}`)).data;
        if (!bp || bp.is_supplier !== true || bp.is_customer !== true) fail(`${width}-fn`, `both roles ${bp ? `c=${bp.is_customer} s=${bp.is_supplier}` : 'missing'}`);
        console.log(`${width} functional: customer ${cName}, supplier ${sName}, both ${bName}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
const views = widths.length * 2 * 2 * 2;
console.log(failures.join('\n'));
console.log(`${views} views, ${failures.length} failures, ${consoleErrors} console errors${skew ? ' (SKEWED: failures expected)' : ''}`);
process.exit(skew ? (failures.length ? 0 : 1) : failures.length || consoleErrors ? 1 : 0);
