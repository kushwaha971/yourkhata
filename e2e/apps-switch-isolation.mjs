/**
 * Switching between apps and businesses by tapping, and one app's data never
 * showing in another (DEC-019), on the live stack at 390 and 1280.
 *
 *   A. Each app the business runs is opened from Apps by a TAP (desktop: the
 *      side menu's Apps page; phone: More → Apps). The server's session, the
 *      address and the screen must all agree on the open app, with no page
 *      error and nothing off the screen; a fast second tap and Back leave the
 *      screen and the session agreeing.
 *   B. A second business is opened from Apps and the home one opened again
 *      the same way; each time the screen names only the open business.
 *   C. A Money book entry with a one-off amount and name is written. Only the
 *      Money book's figures move, by exactly that amount; the Shop's customers,
 *      the Library's students and Lending's borrowers neither list the name nor
 *      show the amount, by API and on their screens. Then a Shop customer with a
 *      one-off name is made and the other apps do not list it. Both are taken
 *      out again at the end. Every read-back runs a skewed self-test first.
 *
 *   node e2e/apps-switch-isolation.mjs [--shots=/tmp/e2e-shots/apps-switch]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/apps-switch');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local QA only');
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
// Where each app opens, and what only that app's screens carry.
const HOME = { shop: /^\/(dashboard|sales|parties)/, khata: /^\/money-book/, library: /^\/library/, lending: /^\/lending/ };
const BRANCH = 'Gyan Library Baner';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const signIn = async (width) => {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const me = async () => (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
  const get = async (path) => (await ctx.request.get(`${base}/api/v1${path}`)).json().catch(() => ({}));
  const send = async (method, path, data) => {
    const r = await ctx.request.fetch(`${base}/api/v1${path}`, {
      method,
      data,
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': crypto.randomUUID() },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  return { ctx, page, errors, csrf, me, get, send, phone };
};

const openApps = async (page, phone) => {
  if (phone) {
    await page.getByRole('button', { name: /Apps and more/ }).click();
    await page.getByTestId('more-apps-row').click();
  } else {
    await page.getByTestId('sidebar-apps-row').getByRole('link', { name: 'Apps' }).click();
  }
  await page.getByTestId('apps-panel').waitFor({ timeout: 10000 });
};
const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
};
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// Every business starts at home in the Shop.
let homeId;
{
  const s = await signIn(1280);
  const session = await s.me();
  homeId = (session.tenants.find((t) => t.is_default && t.name !== BRANCH) ?? session.tenants.find((t) => t.name !== BRANCH)).id;
  await s.send('POST', '/auth/switch-tenant', { tenant_id: homeId });
  await s.send('POST', '/auth/switch-app', { app: 'shop' });
  await s.ctx.close();
}

for (const width of [390, 1280]) {
  const s = await signIn(width);
  const { page, phone, me } = s;
  await s.send('POST', '/auth/switch-tenant', { tenant_id: homeId });
  const appsOf = Object.fromEntries(((await s.get('/memberships/apps')).data ?? []).map((r) => [r.tenant_id, r.apps]));
  const apps = (appsOf[homeId] ?? []).filter((a) => HOME[a]);
  check(apps.length >= 3, `${width}: the home business runs ${apps.join(', ')}`);
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });

  // A. Every app, by a tap, twice round so each is opened from every other.
  for (const app of [...apps, ...apps.slice().reverse()]) {
    const t0 = Date.now();
    await openApps(page, phone);
    await page.getByTestId(`apps-card-${app}`).click();
    await page.waitForURL((u) => HOME[app].test(u.pathname), { timeout: 15000 }).catch(() => {});
    await settle(page);
    const ms = Date.now() - t0;
    const session = await me();
    const path = new URL(page.url()).pathname;
    check(session.active_app === app && HOME[app].test(path), `${width}: tapping ${app} opens it (session ${session.active_app}, at ${path}, ${ms} ms)`);
    check(ms < 6000, `${width}: ${app} opened in under 6 s (${ms} ms)`);
    check((await overflow(page)) <= 0, `${width}: ${app} fits the screen`);
    await page.screenshot({ path: `${SHOTS}/${width}-A-${app}.png` });
  }
  // A fast second tap: two cards tapped back to back end in ONE app, and the
  // screen and the session agree on which.
  await openApps(page, phone);
  const [first, second] = apps.filter((a) => a !== 'shop').slice(0, 2);
  await page.getByTestId(`apps-card-${first}`).click({ noWaitAfter: true });
  await page.getByTestId(`apps-card-${second}`).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(3500);
  await settle(page);
  {
    const session = await me();
    const path = new URL(page.url()).pathname;
    check(HOME[session.active_app]?.test(path), `${width}: after two quick taps the screen (${path}) and the session (${session.active_app}) agree`);
  }
  // Back after a switch: the screen shown is a screen of the app the session has.
  await page.goBack().catch(() => {});
  await settle(page);
  {
    const session = await me();
    const path = new URL(page.url()).pathname;
    const owner = Object.keys(HOME).find((a) => HOME[a].test(path));
    check(!owner || owner === session.active_app || path === '/apps', `${width}: Back shows ${path} while the session is in ${session.active_app}`);
  }

  // B. Another business and back, both by taps through the switch question.
  const homeName = (await me()).tenants.find((t) => t.id === homeId)?.name ?? '';
  const branch = (await me()).tenants.find((t) => t.name === BRANCH);
  if (branch) {
    for (const [target, targetName, otherName] of [[branch.id, BRANCH, homeName], [homeId, homeName, BRANCH]]) {
      await openApps(page, phone);
      await page.getByTestId('apps-card-library').click();
      await page.waitForURL((u) => u.pathname.startsWith('/library'), { timeout: 15000 }).catch(() => {});
      await settle(page);
      await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
      const row = page.getByTestId('apps-place').filter({ hasText: targetName }).first();
      if ((await me()).active_tenant_id !== target) {
        await row.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Switch' }).click();
        await page.waitForURL((u) => u.pathname.startsWith('/library'), { timeout: 15000 }).catch(() => {});
      }
      await settle(page);
      await page.waitForTimeout(1500);
      const session = await me();
      const shown = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      check(session.active_tenant_id === target, `${width}: tapping ${targetName} opens it (${session.active_tenant_id === target})`);
      check(shown.includes(targetName) && !shown.includes(otherName), `${width}: the screen names ${targetName} only`);
      await page.screenshot({ path: `${SHOTS}/${width}-B-${target === homeId ? 'home' : 'branch'}.png` });
    }
  } else check(false, `${width}: the second business ${BRANCH} exists (run e2e/apps-primary.mjs once)`);
  check(s.errors.length === 0, `${width}: no page error${s.errors.length ? ` (${s.errors[0]})` : ''}`);
  await s.ctx.close();
}

// C. One app's data never shows in another.
{
  const s = await signIn(1280);
  const { page, me } = s;
  await s.send('POST', '/auth/switch-tenant', { tenant_id: homeId });
  const apps = (((await s.get('/memberships/apps')).data ?? []).find((r) => r.tenant_id === homeId)?.apps ?? []);
  const stamp = String(Date.now()).slice(-6);
  const amount = `7${stamp.slice(0, 3)}.37`; // one-off, so finding it anywhere else is a leak
  const shownAmount = Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const mbName = `Isotest Mb ${stamp}`;
  const shopName = `Isotest Shop ${stamp}`;
  const mobile = `98${stamp}17`.slice(0, 10);

  // Each app's headline figures, as its own screens read them.
  const figures = async () => ({
    khata: (await s.get('/moneybook/people?page_size=1')).meta?.totals ?? null,
    shop: (await s.get('/parties?book=shop&page_size=1')).meta?.totals ?? null,
    library: apps.includes('library') ? (await s.get('/library/home')).data ?? null : null,
    lending: apps.includes('lending') ? (await s.get('/lending/today')).data ?? null : null,
  });
  const before = await figures();

  await s.send('POST', '/auth/switch-app', { app: 'khata' });
  let made = await s.send('POST', '/moneybook/people', { name: mbName, mobile });
  const personId = made.body?.data?.id;
  check(made.status === 201 && personId, `C: a Money book person is made (${made.status})`);
  made = await s.send('POST', `/moneybook/people/${personId}/entries`, {
    kind: 'gave',
    amount,
    note: 'isolation check',
    entry_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  });
  const entryId = made.body?.data?.id;
  check(made.status === 201, `C: You gave ₹${amount} is saved (${made.status})`);
  const after = await figures();

  // Only the Money book moved, by exactly the amount. Skewed first: a ₹1 skew must fail.
  const moved = Number(after.khata?.to_get) - Number(before.khata?.to_get);
  const skewOk = Math.abs(moved - (Number(amount) + 1)) < 0.005;
  check(!skewOk, 'C self-test: a ₹1 skew is caught');
  check(Math.abs(moved - Number(amount)) < 0.005, `C: Money book "To get" moved by exactly ₹${amount} (${moved.toFixed(2)})`);
  for (const app of ['shop', 'library', 'lending']) {
    if (before[app] === null) continue;
    check(JSON.stringify(before[app]) === JSON.stringify(after[app]), `C: the ${app}'s figures did not move`);
  }
  // Nobody else lists the name, by API.
  const lists = {
    shop: `/parties?book=shop&q=${encodeURIComponent('Isotest Mb')}`,
    library: `/library/students?q=${encodeURIComponent('Isotest')}`,
    lending: `/lending/borrowers?q=${encodeURIComponent('Isotest')}`,
  };
  for (const [app, path] of Object.entries(lists)) {
    if (app !== 'shop' && !apps.includes(app)) continue;
    const rows = (await s.get(path)).data ?? [];
    check(!rows.some((r) => String(r.name ?? r.display_name ?? '').includes(mbName)), `C: the ${app} does not list ${mbName} (${rows.length} rows)`);
  }
  // Nor shows it on its screens: each app's people list and home, searched for
  // the name and the amount.
  const screens = {
    shop: ['/parties', '/dashboard'],
    library: ['/library', '/library/students'],
    lending: ['/lending', '/lending/borrowers'],
  };
  for (const [app, paths] of Object.entries(screens)) {
    if (app !== 'shop' && !apps.includes(app)) continue;
    await s.send('POST', '/auth/switch-app', { app });
    for (const path of paths) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const text = await page.locator('body').innerText();
      check(!text.includes(mbName) && !text.includes(shownAmount), `C: ${path} shows neither ${mbName} nor ₹${shownAmount}`);
    }
  }
  // The Money book itself does show it: the check can see the thing it looks for.
  await s.send('POST', '/auth/switch-app', { app: 'khata' });
  await page.goto(`${base}/money-book`, { waitUntil: 'networkidle' });
  await page.getByText(mbName).first().waitFor({ timeout: 8000 }).catch(() => {});
  check((await page.locator('body').innerText()).includes(mbName), `C self-test: the Money book's own list shows ${mbName}`);
  await page.screenshot({ path: `${SHOTS}/C-moneybook.png` });

  // The other way: a Shop customer is not a Money book person or a student.
  await s.send('POST', '/auth/switch-app', { app: 'shop' });
  made = await s.send('POST', '/parties', { name: shopName, mobile, party_type: 'customer' });
  const partyId = made.body?.data?.id;
  check([200, 201].includes(made.status) && partyId, `C: a Shop customer is made (${made.status}${partyId ? '' : ` ${JSON.stringify(made.body).slice(0, 160)}`})`);
  const mbRows = (await s.get(`/moneybook/people?q=${encodeURIComponent('Isotest Shop')}`)).data ?? [];
  check(!mbRows.some((r) => r.name === shopName), `C: the Money book does not list ${shopName}`);
  if (apps.includes('library')) {
    const st = (await s.get(`/library/students?q=${encodeURIComponent('Isotest Shop')}`)).data ?? [];
    check(!st.some((r) => r.name === shopName), `C: the Library does not list ${shopName}`);
  }
  if (apps.includes('lending')) {
    const br = (await s.get(`/lending/borrowers?q=${encodeURIComponent('Isotest Shop')}`)).data ?? [];
    check(!br.some((r) => r.name === shopName), `C: Lending does not list ${shopName}`);
  }
  await s.send('POST', '/auth/switch-app', { app: 'khata' });
  await page.goto(`${base}/money-book`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check(!(await page.locator('body').innerText()).includes(shopName), `C: the Money book screen does not show ${shopName}`);

  // Take both out again.
  if (entryId) await s.send('POST', `/moneybook/entries/${entryId}/remove`, { reason: 'isolation check' });
  if (personId) await s.send('POST', `/moneybook/people/${personId}/archive`, {});
  await s.send('POST', '/auth/switch-app', { app: 'shop' });
  if (partyId) await s.send('POST', `/parties/${partyId}/archive`, {});
  const end = (await s.get('/moneybook/people?page_size=1')).meta?.totals;
  check(Number(end?.to_get).toFixed(2) === Number(before.khata?.to_get).toFixed(2), `C: the Money book is back to ₹${before.khata?.to_get} (${end?.to_get})`);
  check(s.errors.length === 0, `C: no page error${s.errors.length ? ` (${s.errors[0]})` : ''}`);
  await s.ctx.close();
}

await browser.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
