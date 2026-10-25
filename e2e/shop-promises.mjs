/**
 * BP-16 (R-DEC-26) — Shop promises, on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/shop-promises.mjs [--shots=/tmp/e2e-shots/shop-promises]
 *
 *  * a customer's Shop page takes "will pay ₹1,500 today": a double tap on
 *    Save records ONE promise, Change keeps it one, and the server reads back
 *    what the screen says;
 *  * Home's Follow-ups lists it with the customer's CURRENT Shop balance read
 *    from the server, and the customer lane's caption carries it; the
 *    shop's private note appears on neither, nor in the reminder message;
 *  * a supplier's page is the shop's own promise ("You will pay"), and Home
 *    offers Pay for it;
 *  * "Promise kept" closes it, records no money (Home's figures are the same
 *    before and after), and Home stops listing it;
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi: the person page and
 *    Home's Follow-ups have no sideways scroll, no cut text, no broken figure,
 *    and 44 px targets on a phone.
 *
 * WRITES to the local QA database only: a few promises, which are notes and
 * move no money; the run closes what it opens. Refuses any host but localhost.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

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
const NOTE = 'e2e private note';

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
  for (const el of root.querySelectorAll('.ds-num')) {
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
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    broken,
  };
};

/** Every button in a scope: does the finger land on it at the centre and ±21 px? */
const targets = (scope) =>
  [...(document.querySelector(scope)?.querySelectorAll('button') ?? [])].map((el) => {
    // elementFromPoint sees only the viewport: bring the control into it first.
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return {
      label: el.textContent.trim().slice(0, 20),
      hits: [y - 21, y, y + 21].every((yy) => el.contains(document.elementFromPoint(x, yy))),
    };
  });

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const api = (path) =>
    page.evaluate(async (p) => (await fetch(`/api/v1${p}`, { cache: 'no-store' })).json(), path);
  const dash = await api('/reports/dashboard');
  const customer = dash.data.top_debtors?.[0];
  const supplier = dash.data.top_creditors?.[0];
  check('the QA Shop has a customer who owes and a supplier it owes', Boolean(customer && supplier), `${customer?.name} / ${supplier?.name}`);
  // Key order is not part of the figure: a cached payload and a fresh one list
  // the same object's keys differently, so compare the values, sorted.
  const canon = (v) =>
    v && typeof v === 'object'
      ? Array.isArray(v)
        ? v.map(canon)
        : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const figures = (d) =>
    JSON.stringify(canon([d.data.tiles.to_collect, d.data.tiles.to_pay, d.data.tiles.shop_cash_in_hand]));
  const figuresBefore = figures(dash);
  const shopBalance = async (id) => (await api(`/parties/${id}?book=shop`)).data.shop.customer_balance;

  const personUrl = (id, supplierView) => `${base}/parties/${id}${supplierView ? '?from=suppliers' : ''}`;
  const openPerson = async (id, supplierView = false) => {
    await page.goto(personUrl(id, supplierView), { waitUntil: 'networkidle' });
    await page.getByTestId('shop-promise').waitFor();
    await page.locator('[data-testid="shop-promise-none"], [data-testid="shop-promise-line"]').first().waitFor();
  };
  /** Start from no open promise, closing one a previous run may have left. */
  const clear = async (id, supplierView = false) => {
    await openPerson(id, supplierView);
    if (await page.getByTestId('shop-promise-cancel').count()) {
      await page.getByTestId('shop-promise-cancel').click();
      await page.getByTestId('shop-promise-none').waitFor();
    }
  };
  const openFollowUps = async () => {
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.getByTestId('shop-home-workspace').waitFor();
    await page.getByRole('tab').nth(1).click();
    await page.waitForTimeout(400);
  };
  const addPromise = async ({ quick, amount, note }) => {
    await page.getByTestId('shop-promise-add').click();
    const drawer = page.getByTestId('shop-promise-drawer');
    await drawer.waitFor();
    await drawer.getByRole('button', { name: quick }).click();
    if (amount) await drawer.getByLabel(/How much/).fill(amount);
    if (note) await drawer.getByLabel(/Note/).fill(note);
    return drawer;
  };

  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });

  // ── A customer's promise ────────────────────────────────────────────────
  await clear(customer.id);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/person-none-390.png`, fullPage: true });
  const drawer = await addPromise({ quick: 'Today', amount: '1500', note: NOTE });
  const d = await page.evaluate(measure, '[data-testid="shop-promise-drawer"]');
  check('390 en: the drawer has no sideways scroll or cut text', d.overflow <= 0 && d.cut.length === 0, `${d.overflow}px ${d.cut.join(' | ')}`);
  check('the drawer says a promise changes no bill', (await drawer.innerText()).includes('It does not change any bill or what they owe.'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-390.png` });
  await page.getByTestId('shop-promise-save').dblclick();
  await page.getByTestId('shop-promise-line').waitFor();
  let line = await page.getByTestId('shop-promise-line').innerText();
  check('the page says "Will pay ₹1,500.00 today"', line === 'Will pay ₹1,500.00 today', line);
  let rows = (await api(`/parties/${customer.id}/shop-promises?role=customer`)).data;
  const open = rows.filter((r) => r.state === 'open');
  check(
    'a double tap on Save records one promise, as the screen says',
    open.length === 1 && open[0].amount === '1500.00' && open[0].note === NOTE && open[0].role === 'customer',
    JSON.stringify(open.map((r) => [r.amount, r.promised_on, r.state]))
  );

  await page.getByTestId('shop-promise-change').click();
  const change = page.getByTestId('shop-promise-drawer');
  await change.getByLabel(/How much/).fill('1000');
  await page.getByTestId('shop-promise-save').click();
  await page.getByText('Will pay ₹1,000.00 today').waitFor();
  rows = (await api(`/parties/${customer.id}/shop-promises?role=customer`)).data;
  check(
    'Change keeps it one promise and bumps its version',
    rows.filter((r) => r.state === 'open').length === 1 && rows[0].amount === '1000.00' && rows[0].version === 2,
    JSON.stringify(rows.map((r) => [r.amount, r.version, r.state]))
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/person-open-390.png`, fullPage: true });

  // ── A supplier's promise: the shop's own ─────────────────────────────────
  await clear(supplier.id, true);
  const heading = await page.getByTestId('shop-promise').getByRole('heading').innerText();
  check('a supplier page asks for "Your promise to pay"', heading === 'Your promise to pay', heading);
  await addPromise({ quick: 'Tomorrow' });
  await page.getByTestId('shop-promise-save').click();
  await page.getByTestId('shop-promise-line').waitFor();
  line = await page.getByTestId('shop-promise-line').innerText();
  check('the supplier page says "You will pay on <day>"', /^You will pay on \w{3}, \d{1,2} \w{3}$/.test(line), line);

  // ── Home's Follow-ups ───────────────────────────────────────────────────
  await openFollowUps();
  const homeRows = page.getByTestId('home-promise-row');
  await homeRows.first().waitFor();
  const texts = await homeRows.allInnerTexts();
  const mine = texts.find((t) => t.startsWith(`${customer.name} promised ₹1,000.00 today`)) ?? '';
  const balance = await shopBalance(customer.id);
  check(
    "Home lists the customer's promise with today's Shop balance",
    mine.includes(`Owes ₹${inr(balance)}`),
    `${mine.replace(/\n/g, ' · ')} vs ${balance}`
  );
  check('the shop\'s private note is not on Home', !(await page.getByTestId('home-promises').innerText()).includes(NOTE));
  const theirs = texts.find((t) => t.startsWith(`You promised to pay ${supplier.name} on`)) ?? '';
  check('Home lists the shop\'s promise to the supplier, with Pay', theirs.includes('Pay'), theirs.replace(/\n/g, ' · '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-followups-390.png`, fullPage: true });

  // The reminder carries no internal note.
  const remind = page.getByTestId('home-promise-row').filter({ hasText: customer.name }).getByTestId('home-promise-act');
  if (await remind.count()) {
    await remind.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.waitForTimeout(500);
    const message = await dialog.innerText();
    check('the reminder message carries no promise note', !message.includes(NOTE) && message.length > 20, message.slice(0, 80).replace(/\n/g, ' '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/remind-390.png` });
    await page.keyboard.press('Escape');
  } else {
    check('Remind is offered for a customer who owes and has a mobile', false, 'no Remind on the row');
  }

  // ── Widths × languages ─────────────────────────────────────────────────
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      const tag = `${width} ${locale}`;
      await openPerson(customer.id);
      let m = await page.evaluate(measure, 'main');
      check(`${tag}: person page has no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      const pm = await page.evaluate(measure, '[data-testid="shop-promise"]');
      check(`${tag}: no text cut or broken figure in the promise`, pm.cut.length === 0 && pm.broken.length === 0, [...pm.cut, ...pm.broken].join(' | '));
      if (width < 1024) {
        const tg = await page.evaluate(targets, '[data-testid="shop-promise"]');
        check(`${tag}: every promise button is a 44 px target`, tg.length > 0 && tg.every((x) => x.hits), JSON.stringify(tg.filter((x) => !x.hits)));
      }
      if (locale === 'hi' && width === 390) {
        const h = await page.getByTestId('shop-promise').getByRole('heading').innerText();
        check('390 hi: the promise is said in Hindi', h === 'भुगतान का वादा', h);
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/person-${width}-${locale}.png`, fullPage: true });

      await openFollowUps();
      await page.getByTestId('home-promises').waitFor();
      m = await page.evaluate(measure, 'main');
      check(`${tag}: Home has no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      const hm = await page.evaluate(measure, '[data-testid="home-promises"]');
      check(`${tag}: no text cut or broken figure in Home's promises`, hm.cut.length === 0 && hm.broken.length === 0, [...hm.cut, ...hm.broken].join(' | '));
      if (width < 1024) {
        const tg = await page.evaluate(targets, '[data-testid="home-promises"]');
        check(`${tag}: Remind and Pay are 44 px targets`, tg.every((x) => x.hits), JSON.stringify(tg.filter((x) => !x.hits)));
      }
      if (width === 1280 && locale === 'en') {
        const lane = await page.getByRole('region', { name: /customers/i }).first().innerText().catch(() => '');
        if (lane.includes(customer.name))
          check('the customer lane captions the promise', lane.includes('promised ₹1,000.00 today'), lane.slice(0, 160).replace(/\n/g, ' · '));
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-${width}-${locale}.png`, fullPage: true });
    }
  }

  // ── Kept: closes it, moves no money, leaves Home ─────────────────────────
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await openPerson(customer.id);
  await page.getByTestId('shop-promise-kept').dblclick();
  await page.getByTestId('shop-promise-none').waitFor();
  const toast = await page.getByText('Promise kept. Record any money received as a payment.').count();
  check('Promise kept says to record the payment separately', toast > 0);
  rows = (await api(`/parties/${customer.id}/shop-promises?role=customer`)).data;
  // Earlier runs leave their own kept promises in the history; count only this one.
  check('a double tap closes it once, as kept', rows[0].state === 'kept' && rows[0].version === 3 && rows.filter((r) => r.state === 'open').length === 0 && rows[0].id === open[0].id, JSON.stringify(rows.slice(0, 2).map((r) => [r.state, r.version, r.id.slice(0, 8)])));
  await page.getByRole('button', { name: 'Earlier promises' }).click();
  check('the page keeps it as history', (await page.getByTestId('shop-promise-history').innerText()).includes('Kept'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/person-kept-390.png`, fullPage: true });
  const dashAfter = await api('/reports/dashboard');
  check("a promise moves no money: Home's figures are unchanged", figures(dashAfter) === figuresBefore, `${figuresBefore} → ${figures(dashAfter)}`);
  await openFollowUps();
  const after = await page.getByTestId('home-promise-row').allInnerTexts();
  check('Home no longer lists the kept promise', !after.some((t) => t.startsWith(`${customer.name} promised`)), after.join(' | ').slice(0, 120));

  await clear(supplier.id, true);
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
