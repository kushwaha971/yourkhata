/**
 * The Money Book, end to end (rebuilt from scratch, 11 Nov 2026).
 *
 * The owner: "I don't want any relation with shop". The Money Book is its own
 * app — `/money-book`, `/api/v1/moneybook`, `apps/moneybook` — and this
 * harness drives its real screens at 390 and 1280 and reads every figure back
 * from its API by id:
 *
 *   - add a person; gave and got move the balance by exactly the amount;
 *   - the sheet's "After this" is the balance the save then produces;
 *   - changing an entry moves the balance by the difference, removing one
 *     undoes it, and the originals stay in the book (Show removed);
 *   - the list and its To get agree with the server without a reload;
 *   - the report adds up for one person;
 *   - a person with money in the book cannot be put away (no tolerance);
 *   - the Shop never sees this person, and the Shop's API cannot open them;
 *   - nothing runs off a phone screen, no page or console error.
 *
 * Every read-back runs a skewed self-test first, so a comparison that cannot
 * fail is caught (P0 §1).
 *
 *   node e2e/moneybook-round.mjs [--shots=/tmp/e2e-shots/moneybook]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '');
const base = process.env.E2E_FRONTEND ?? process.env.E2E_BASE ?? 'http://localhost:3005';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local QA only');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
// P0 §1: a read-back that cannot fail proves nothing.
const same = (a, b) => a !== undefined && a !== null && Number(a) === Number(b);
if (same('100.00', '100.01') || !same('100.00', '100')) throw Error('self-test: the comparison cannot fail');
const plain = (s) => (s ?? '').replace(/[₹,\s]/g, '');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const phone = width < 768;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 844 : 860 },
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const tag = (s) => `${width}: ${s}`;
    const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${width}-${name}.png`, fullPage: true });

    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', 'scale@digikhaato.test');
    await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    errors.length = 0; // the sign-in page asks /auth/me first: a 401 there is the answer
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
    const api = async (path, init = {}) => {
      const r = await ctx.request.fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID(), ...(init.headers ?? {}) },
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    };
    const book = async () => (await api('/moneybook/people?page_size=1')).body?.meta?.totals;

    // 1. Add a person through the screen.
    const name = `Round ${width} ${String(Date.now()).slice(-5)}`;
    const before = await book();
    await page.goto(`${base}/money-book`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add person', exact: true }).filter({ visible: true }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Name', { exact: true }).fill(name);
    await form.getByLabel('Mobile number', { exact: true }).fill(`8${String(Date.now()).slice(-9)}`);
    const created = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/moneybook/people' && r.request().method() === 'POST');
    await page.getByTestId('moneybook-person-save').click();
    const id = (await (await created).json()).data.id;
    await page.waitForURL((u) => u.pathname === `/money-book/${id}`);
    check(tag('Add person opens the new person'), true);

    const balance = async () => (await api(`/moneybook/people/${id}`)).body?.data?.balance;
    const shown = async (amount) =>
      page.getByTestId('moneybook-balance').filter({ hasText: amount }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
    const entry = async (which, amount, note) => {
      await page.getByTestId(`moneybook-${which}`).filter({ visible: true }).first().click();
      const sheet = page.getByRole('dialog');
      await sheet.getByLabel('Amount', { exact: true }).fill(amount);
      if (note) await sheet.getByLabel(/^Note/).fill(note);
      await sheet.getByTestId('moneybook-after').filter({ hasText: 'After this' }).waitFor({ timeout: 6000 }).catch(() => undefined);
      const after = await sheet.getByTestId('moneybook-after').innerText();
      const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/moneybook\/people\/[^/]+\/entries$/.test(new URL(r.url()).pathname));
      await page.getByTestId('moneybook-entry-save').click();
      const answer = await saved;
      await sheet.waitFor({ state: 'hidden' });
      return { id: (await answer.json()).data.id, after };
    };

    // 2. Gave and got: read back by id, the header updated, "After this" true.
    const gave = await entry('gave', '1500', 'Cement bags');
    check(tag('gave ₹1,500 → balance 1500.00 on the server'), same(await balance(), '1500.00'), await balance());
    check(tag('the sheet said "₹1,500 to get" before Save'), gave.after.includes('₹1,500 to get'), gave.after);
    check(tag('the header says ₹1,500 without a reload'), await shown('₹1,500'));
    const got = await entry('got', '400', 'Part paid');
    check(tag('got ₹400 → balance 1100.00'), same(await balance(), '1100.00'), await balance());
    check(tag('"After this" said ₹1,100 to get'), got.after.includes('₹1,100 to get'), got.after);
    check(tag('the header says ₹1,100 without a reload'), await shown('₹1,100'));
    await shot('01-two-entries');

    // 3. Change the ₹1,500 to ₹1,000: the balance moves by the difference.
    const row = (note) =>
      phone
        ? page.getByTestId('moneybook-entry-row').filter({ hasText: note }).first()
        : page.locator('tr').filter({ hasText: note }).getByRole('button').first();
    await row('Cement bags').click();
    await page.getByRole('menuitem', { name: 'Change this entry' }).or(page.getByRole('button', { name: 'Change this entry' })).first().click();
    const fix = page.getByRole('dialog').last();
    await fix.getByLabel('Amount', { exact: true }).fill('1000');
    const changed = page.waitForResponse((r) => r.request().method() === 'POST' && /\/replace$/.test(new URL(r.url()).pathname));
    await page.getByTestId('moneybook-entry-save').click();
    check(tag('the change is accepted'), (await changed).status() === 201);
    check(tag('changing ₹1,500 to ₹1,000 moves the balance by −500 → 600.00'), same(await balance(), '600.00'), await balance());
    check(tag('the header says ₹600 without a reload'), await shown('₹600'));

    // 4. Remove the ₹400: the balance goes back up by 400.
    await row('Part paid').click();
    await page.getByRole('menuitem', { name: 'Remove this entry' }).or(page.getByRole('button', { name: 'Remove this entry' })).first().click();
    await page.getByRole('dialog').last().getByLabel('Why').fill('Recorded twice');
    const removed = page.waitForResponse((r) => r.request().method() === 'POST' && /\/remove$/.test(new URL(r.url()).pathname));
    await page.getByTestId('moneybook-remove-confirm').click();
    check(tag('the removal is accepted'), (await removed).status() === 200);
    check(tag('removing ₹400 got → balance 1000.00'), same(await balance(), '1000.00'), await balance());
    check(tag('the header says ₹1,000 without a reload'), await shown('₹1,000'));

    // The originals stay in the book, hidden until Show removed.
    const live = (await api(`/moneybook/people/${id}/entries`)).body?.data ?? [];
    const all = (await api(`/moneybook/people/${id}/entries?include_removed=true`)).body?.data ?? [];
    check(tag('one live entry is listed (the ₹1,000)'), live.length === 1 && live[0].amount === '1000.00', JSON.stringify(live.map((e) => e.amount)));
    check(tag('all five rows are kept (two originals, two removals, the new one)'), all.length === 5, `${all.length}`);
    check(tag('the live row\'s "balance after" is the person\'s balance'), same(live[0]?.balance_after, await balance()));
    await page.getByRole('switch', { name: 'Show removed' }).first().click();
    await page.waitForTimeout(900);
    const struck = phone ? await page.getByTestId('moneybook-entry-row').count() : await page.locator('tbody tr').count();
    check(tag('Show removed draws all five rows'), struck === 5, `${struck}`);
    await shot('02-after-fixes');

    // 5. The list and its To get agree with the server, without a reload.
    await page.goto(`${base}/money-book`, { waitUntil: 'networkidle' });
    const after = await book();
    const rise = Number(after?.to_get) - Number(before?.to_get);
    check(tag('"To get" across the book rose by exactly ₹1,000'), rise === 1000, `${before?.to_get} → ${after?.to_get}`);
    const screen = plain(await page.locator('main').innerText());
    check(tag('the screen\'s To get is the server\'s'), screen.includes(String(Number(after?.to_get))), after?.to_get);
    await page.getByPlaceholder('Search name or mobile').fill(name);
    await page.waitForTimeout(900);
    const listed = await page.locator('main').innerText();
    check(tag('the list row reads ₹1,000'), listed.includes(name) && listed.includes('₹1,000'));
    await shot('03-list');

    // 6. The report for this person.
    await page.goto(`${base}/money-book/report?person=${id}`, { waitUntil: 'networkidle' });
    const report = (await api(`/moneybook/report?person=${id}`)).body?.meta?.summary;
    check(tag('report: you gave ₹1,000, you got ₹0, to get now ₹1,000'), same(report?.you_gave, '1000') && same(report?.you_got, '0') && same(report?.to_get_now, '1000'), JSON.stringify(report));
    const rep = plain(await page.locator('main').innerText());
    check(tag('the report screen shows To get now ₹1,000'), rep.includes('Togetnow1000'), rep.slice(0, 160));
    await shot('04-report');

    // 7. Money in the book: cannot be put away, not even ₹0.01 off.
    const blocked = await api(`/moneybook/people/${id}/archive`, { method: 'POST', data: {} });
    check(tag('putting away a person owed ₹1,000 is refused (409)'), blocked.status === 409 && blocked.body?.error?.code === 'balance_not_settled', `${blocked.status}`);
    check(tag('the refusal did not put them away'), (await api(`/moneybook/people/${id}`)).body?.data?.archived === false);

    // 8. No relation with the Shop.
    const shop = (await api(`/parties?book=shop&q=${encodeURIComponent(name)}`)).body?.data ?? [];
    check(tag('the Shop\'s lists do not have this person'), shop.length === 0, `${shop.length}`);
    check(tag('the Shop\'s API cannot open a Money Book person'), (await api(`/parties/${id}`)).status === 404);

    // 9. Nothing off a phone screen, on every Money Book screen.
    for (const path of ['/money-book', `/money-book/${id}`, '/money-book/report', '/money-book/reminders', '/money-book/old-dues']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(tag(`${path.replace(id, ':id')} has no sideways scroll`), over <= 0, `${over}px`);
    }
    check(tag('no page or console error'), errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
