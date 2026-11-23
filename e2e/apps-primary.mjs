/**
 * The Apps screen and the ★ Primary place (owner, 12 Nov 2026), on the live
 * stack, at 390 and 1280, with a screenshot of each step:
 *   1. The side menu / phone header only SAY where you are: no business switch.
 *   2. Apps (desktop: the side menu row; phone: More → Apps) shows every app as
 *      a card, the open one marked, and under the app its places.
 *   3. A second library business (made through POST /tenants, as the wizard
 *      does) is listed under Library; tapping it opens it in the Library.
 *   4. ☆ makes it Primary: read back from /auth/me (is_default + primary_app).
 *   5. Working elsewhere, then a fresh sign-in, lands on the ★ place in its app.
 *   6. Money book shows no places, no ★, no Add.
 *
 *   node e2e/apps-primary.mjs --shots=/tmp/e2e-shots/apps-primary
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/apps-primary');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const EMAIL = 'scale@digikhaato.test';
const PASSWORD = process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const signIn = async (width) => {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const me = async () => (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
  return { ctx, page, errors, csrf, me, phone };
};

// Setup: a second business that runs the Library, unless an earlier run made it.
const BRANCH = 'Gyan Library Baner';
{
  const { ctx, csrf, me } = await signIn(1280);
  let session = await me();
  const home = session.active_tenant_id;
  if (!session.tenants.some((t) => t.name === BRANCH)) {
    const made = await ctx.request.post(`${base}/api/v1/tenants`, {
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `apps-primary-${Date.now()}` },
      data: { name: BRANCH, apps: ['library'], state_code: '27', onboarding_step: 4 },
    });
    check(made.ok(), `setup: a second business running the Library is made (${made.status()} ${made.ok() ? '' : await made.text()})`);
  }
  // Start every run from the home business, with its ★ and no primary app.
  session = await me();
  const homeRow = session.tenants.find((t) => t.id === home) ?? session.tenants.find((t) => t.name !== BRANCH);
  await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { headers: { 'X-CSRF-Token': await csrf() }, data: { tenant_id: homeRow.id } });
  await ctx.request.patch(`${base}/api/v1/memberships/${homeRow.membership_id}`, {
    headers: { 'X-CSRF-Token': await csrf() },
    data: { is_default: true, primary_app: 'shop' },
  });
  await ctx.close();
}

for (const width of [390, 1280]) {
  const { ctx, page, errors, csrf, me, phone } = await signIn(width);
  let session = await me();
  const home = session.tenants.find((t) => t.name !== BRANCH && t.is_default);
  const branch = session.tenants.find((t) => t.name === BRANCH);
  check(Boolean(home && branch), `${width}: the session lists both businesses`);
  const appsOf = Object.fromEntries(((await (await ctx.request.get(`${base}/api/v1/memberships/apps`)).json()).data ?? []).map((r) => [r.tenant_id, r.apps]));
  check(appsOf[branch?.id]?.includes('library') && !appsOf[branch?.id]?.includes('shop'), `${width}: /memberships/apps says the branch runs the Library only (${appsOf[branch?.id]})`);
  check(!('apps' in (session.tenants[0] ?? {})), `${width}: /auth/me stays lean (no per-business apps)`);

  // 1. No business switch where it used to be.
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  check((await page.getByTestId('open-place').count()) >= 1, `${width}: the header shows where you are`);
  check((await page.getByRole('button', { name: /^Switch business|Change business/ }).count()) === 0, `${width}: no business switch in the header`);
  await page.screenshot({ path: `${SHOTS}/${width}-1-header.png` });

  // 2. Open Apps the way each size does.
  if (phone) {
    await page.getByRole('button', { name: /Apps and more/ }).click();
    await page.getByTestId('more-apps-row').click();
  } else {
    // Desktop: Apps is its own page (owner, 12 Nov 2026: no popover, no drawer).
    await page.getByTestId('sidebar-apps-row').getByRole('link', { name: 'Apps' }).click();
    await page.waitForURL((u) => u.pathname === '/apps');
    check((await page.getByRole('dialog').count()) === 0, `${width}: Apps opened as its own page, no popover`);
  }
  await page.getByTestId('apps-panel').waitFor();
  await page.getByTestId('apps-card-library').click({ trial: true });
  check(await page.getByTestId('apps-card-library').isVisible(), `${width}: Library has a card`);
  await page.screenshot({ path: `${SHOTS}/${width}-2-apps.png`, fullPage: true });
  // MEASURE, not read: a label clipped by its card ("Busines") passes every
  // getByRole. Each card is at least as wide as its words.
  const clipped = await page.getByTestId('app-sheet-tiles').first().evaluate((grid) =>
    [...grid.querySelectorAll('span')].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > grid.getBoundingClientRect().right + 1).map((el) => el.textContent)
  );
  check(clipped.length === 0, `${width}: no app card label is cut off${clipped.length ? ` (${clipped.join(', ')})` : ''}`);
  const cardWidth = await page.getByTestId('apps-card-library').evaluate((el) => Math.round(el.getBoundingClientRect().width));
  check(cardWidth >= (phone ? 150 : 115), `${width}: app cards have room (${cardWidth}px)`);

  // 3. Library → the branch is listed; tapping it opens it in the Library.
  await page.getByTestId('apps-card-library').click();
  await page.waitForURL((u) => u.pathname.startsWith('/library'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  session = await me();
  check(session.active_app === 'library', `${width}: the Library card opened the Library (${session.active_app})`);
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  const rows = page.getByTestId('apps-place');
  const names = await rows.allInnerTexts();
  check(names.some((n) => n.includes(BRANCH)), `${width}: under Library: ${names.map((n) => n.split('\n')[0]).join(' | ')}`);
  await page.screenshot({ path: `${SHOTS}/${width}-3-libraries.png`, fullPage: true });
  // Another business: the screen asks first (owner, 14 Nov 2026). Cancel sends
  // nothing and stays; Switch, tapped twice, sends one switch.
  const homeName = (await me()).tenants.find((t) => t.id === home.id)?.name ?? '';
  const switches = [];
  page.on('request', (r) => r.method() === 'POST' && r.url().includes('/auth/switch-tenant') && switches.push(r.url()));
  await rows.filter({ hasText: BRANCH }).click();
  const ask = page.getByRole('dialog');
  await ask.waitFor();
  const words = (await ask.innerText()).replace(/\s+/g, ' ');
  check(words.includes(`Switch to ${BRANCH}?`) && words.includes(`You are in ${homeName} now.`) && words.includes(`Library will open at ${BRANCH}`), `${width}: the switch asks first and names both: ${words.slice(0, 150)}`);
  const askWide = await ask.evaluate((el) => [...el.querySelectorAll('*')].filter((n) => n.scrollWidth > n.clientWidth + 1 && n.children.length === 0).length);
  check(askWide === 0, `${width}: no word in the question is cut (${askWide})`);
  await page.screenshot({ path: `${SHOTS}/${width}-3b-switch-ask.png` });
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await ask.waitFor({ state: 'hidden' });
  check(switches.length === 0 && (await me()).active_tenant_id === home.id, `${width}: Cancel sends nothing and stays in ${homeName}`);
  await rows.filter({ hasText: BRANCH }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch' }).dblclick().catch(() => {});
  await page.waitForURL((u) => u.pathname.startsWith('/library'), { timeout: 15000 });
  check(switches.length === 1, `${width}: a double tap on Switch sends one switch (${switches.length})`);
  await page.getByText(new RegExp(BRANCH)).first().waitFor({ timeout: 8000 }).catch(() => {});
  const shown = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(shown.includes(BRANCH) && !shown.includes(homeName), `${width}: the screen now shows ${BRANCH}, not ${homeName}`);
  await page.waitForLoadState('networkidle');
  session = await me();
  check(session.active_tenant_id === branch.id && session.active_app === 'library', `${width}: the branch opened, in the Library`);

  // 4. ☆ the branch.
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  const branchRow = page.getByTestId('apps-places').locator(':scope > div').filter({ hasText: BRANCH });
  await branchRow.getByTestId('apps-star').click();
  await page.getByText(/is now your Primary/).first().waitFor();
  session = await me();
  const starred = session.tenants.find((t) => t.id === branch.id);
  check(starred.is_default && starred.primary_app === 'library', `${width}: the server has the branch ★ in the Library`);
  check(session.tenants.filter((t) => t.is_default).length === 1, `${width}: exactly one ★`);
  check((await branchRow.getByTestId('apps-star').getAttribute('aria-pressed')) === 'true', `${width}: the ★ shows filled`);
  await page.screenshot({ path: `${SHOTS}/${width}-4-starred.png`, fullPage: true });

  // 5. Work in the home business's Shop, then sign in afresh: the ★ wins.
  await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { headers: { 'X-CSRF-Token': await csrf() }, data: { tenant_id: home.id } });
  const fresh = await signIn(width);
  await fresh.page.waitForLoadState('networkidle');
  const landed = await fresh.me();
  // The branch was made by API and its setup is not finished, so sign-in sends
  // its owner to finish setup there; a finished one opens its Library.
  check(
    landed.active_tenant_id === branch.id && (landed.active_app === 'library' || landed.landing?.kind === 'business_setup'),
    `${width}: a fresh sign-in lands on the ★ branch (${fresh.page.url().replace(base, '')}, ${landed.landing?.kind})`
  );
  await fresh.page.screenshot({ path: `${SHOTS}/${width}-5-after-login.png` });
  await fresh.ctx.close();

  // 6. Money book: no places.
  if (appsOf[home.id]?.includes('khata')) {
    await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
    await page.getByTestId('apps-card-khata').click();
    await page.waitForTimeout(800);
    await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
    check((await page.getByTestId('apps-places').count()) === 0, `${width}: Money book lists no places`);
    await page.screenshot({ path: `${SHOTS}/${width}-6-moneybook.png`, fullPage: true });
  }

  // Overflow, as every piece checks it.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${width}: nothing runs off the screen (${wide}px)`);
  check(errors.length === 0, `${width}: no page error${errors.length ? ` (${errors[0]})` : ''}`);

  // Put the ★ back home for the next size.
  await ctx.request.patch(`${base}/api/v1/memberships/${home.membership_id}`, {
    headers: { 'X-CSRF-Token': await csrf() },
    data: { is_default: true, primary_app: 'shop' },
  });
  await ctx.request.post(`${base}/api/v1/auth/switch-tenant`, { headers: { 'X-CSRF-Token': await csrf() }, data: { tenant_id: home.id } });
  await ctx.close();
}
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
