/**
 * e2e/moneybook-landing.mjs — where a sign-in lands (owner, 18 Nov 2026).
 *
 *   E2E_BACKEND=http://127.0.0.1:8100/api/v1 DEMO_API_LOG=<api log> \
 *   DEMO_FRONTEND=http://localhost:3005 node e2e/moneybook-landing.mjs [--shots <dir>]
 *
 * One person, start to finish, on a desktop and a phone:
 *   1. a new mobile signs up and lands on Money Book, not business setup;
 *   2. records money there, read back from the API;
 *   3. More shows Apps (not "Switch business"), the person's own settings
 *      open, and a business-only page sends them home to Money Book;
 *   4. Apps leads to setup; they make a business;
 *   5. sign out, sign in: nothing is starred, so Money Book again, with the
 *      business one switch away and More now offering "Switch business";
 *   6. star the business on the Apps screen;
 *   7. sign out, sign in: the starred business opens.
 * Every landing is read from the address bar, and every figure from the API.
 * Demo stack only; it refuses any other API.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const API = process.env.E2E_BACKEND ?? '';
const FE = process.env.DEMO_FRONTEND ?? 'http://localhost:3005';
const LOG = process.env.DEMO_API_LOG;
if (!/:8100\//.test(API) || !LOG) throw new Error('Demo stack only: E2E_BACKEND on :8100 and DEMO_API_LOG are required.');
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
};
/** The demo database keeps OTP budgets and the 60 s resend wait; a journey signs in three times. */
const clearOtpBudget = () => execFileSync('psql', ['-q', '-d', 'yourkhata_demo', '-c', 'delete from platform_rate_limit; delete from platform_otp_challenge;']);
const codeFor = async (mobile, from) => {
  for (let i = 0; i < 40; i += 1) {
    const hits = [...readFileSync(LOG).subarray(from).toString('utf8').matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits.at(-1)[2];
    await sleep(300);
  }
  throw new Error('no OTP in the demo API log');
};
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const apiGet = async (ctx, p) => (await (await ctx.request.get(`${API.replace('127.0.0.1', 'localhost')}${p}`)).json()).data;

const ONLY = process.env.ONLY;
const DEVICES = [
  { name: 'desktop', context: { viewport: { width: 1280, height: 800 } } },
  { name: 'phone', context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
let serial = Number(String(Date.now()).slice(-4)) % 800 + 100;

for (const device of DEVICES.filter((d) => !ONLY || d.name === ONLY)) {
  const phone = device.name === 'phone';
  serial += 1;
  const mobile = `97700${String(serial).padStart(5, '0')}`.slice(0, 10);
  const ctx = await browser.newContext({ ...device.context, locale: 'en-IN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname}: ${String(e.message).slice(0, 60)}`));
  const tag = (s) => `${device.name}: ${s}`;
  const shot = async (label) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${device.name}-${label}.png`) }); };
  const where = () => new URL(page.url()).pathname;
  const redSnackbar = () => page.getByText(/Open a business first|Something went wrong/).count();

  const signIn = async () => {
    clearOtpBudget();
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
    const field = page.getByLabel(/Mobile number/).first();
    await field.click();
    await field.pressSequentially(mobile);
    const from = readFileSync(LOG).length;
    await page.getByRole('button', { name: /Send code/ }).click();
    await page.getByRole('textbox').first().waitFor({ timeout: 30000 });
    await page.getByRole('textbox').first().focus();
    await page.keyboard.type(await codeFor(mobile, from));
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(800);
  };
  const signOut = async () => {
    if (phone) {
      await page.goto(`${FE}/more`, { waitUntil: 'networkidle' });
      await page.getByText(/^Sign out$/).first().click();
    } else {
      // On a computer Sign out is in the account menu at the top right.
      await page.goto(`${FE}/money-book`, { waitUntil: 'networkidle' });
      await page.getByRole('banner').getByRole('button').last().click();
      await page.getByRole('menuitem', { name: /Sign out/ }).click();
    }
    await page.getByRole('dialog').getByRole('button', { name: /Sign out/ }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForURL((u) => u.pathname === '/' || u.pathname.startsWith('/login'), { timeout: 30000 });
  };

  try {
    // ── 1. A new mobile signs up: Money Book, not setup ─────────────────────
    await signIn();
    check(tag('a new account lands on Money Book'), where() === '/money-book', where());
    check(tag('Money Book opens without a red message'), (await redSnackbar()) === 0);
    check(tag('the header reads "My Money Book"'), (await page.getByText('My Money Book').filter({ visible: true }).count()) > 0);
    if (phone) check(tag('the bottom tabs are there'), await page.getByRole('link', { name: 'Reminders' }).first().isVisible());
    else check(tag('the rail has Apps and the Money Book rows'), (await page.getByTestId('sidebar-apps-row').count()) === 1 && (await page.getByRole('link', { name: 'Old dues' }).count()) > 0);
    check(tag('Money Book fits the screen'), (await overflow(page)) <= 0);
    await shot('1-landed-new');

    // ── 2. Money recorded in Money Book, read back ──────────────────────────
    await page.getByRole('button', { name: /Add person/ }).first().click();
    await page.getByLabel(/Name/).first().fill('Raju milkman');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await page.waitForURL(/\/money-book\/[0-9a-f-]{20,}/, { timeout: 30000 });
    await page.getByRole('button', { name: /Gave money/ }).first().click();
    await page.getByLabel(/Amount/).first().fill('500');
    await page.getByRole('button', { name: /^Save/ }).last().click();
    await sleep(1500);
    const people = await apiGet(ctx, '/moneybook/people?page=1&page_size=25');
    const raju = (people.results ?? people.items ?? people).find?.((p) => p.name === 'Raju milkman');
    check(tag('the ₹500 given is on the server'), raju && Number(raju.balance) === 500, JSON.stringify(raju ?? people).slice(0, 160));
    await shot('2-money-recorded');

    // ── 3. More, settings and a business-only page with no business ─────────
    await page.goto(`${FE}/more`, { waitUntil: 'networkidle' });
    check(tag('More shows Apps'), await page.getByRole('link', { name: /^Apps$/ }).first().isVisible());
    check(tag('More does not say "Switch business" with no business'), (await page.getByText('Switch business').count()) === 0);
    check(tag('More keeps the person\'s own rows'), (await page.getByText('Devices').count()) > 0 && (await page.getByText(/Sign out/).count()) > 0);
    check(tag('More opens without a red message'), (await redSnackbar()) === 0);
    await shot('3-more-no-business');
    await page.goto(`${FE}/settings/devices`, { waitUntil: 'networkidle' });
    check(tag('Devices opens with no business'), where() === '/settings/devices', where());
    await page.goto(`${FE}/settings/me`, { waitUntil: 'networkidle' });
    check(tag('My profile opens with no business'), where().startsWith('/settings/me'), where());
    await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle' });
    await sleep(1000);
    check(tag('a business page sends a person with none home to Money Book'), where() === '/money-book', where());

    // ── 4. Apps → set up a business ─────────────────────────────────────────
    await page.goto(`${FE}/more`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /^Apps$/ }).first().click();
    await page.waitForURL(/\/onboarding\/step\/1/, { timeout: 30000 });
    check(tag('Apps opens the choice of apps'), await page.getByRole('group', { name: 'What do you want to use?' }).waitFor({ timeout: 15000 }).then(() => true, () => false));
    await page.getByLabel(/Business name/).fill('Raju Traders');
    if (await page.getByLabel(/Your name/).count()) await page.getByLabel(/Your name/).fill('Raju Verma');
    await page.getByRole('combobox', { name: /State/ }).click();
    await page.getByPlaceholder(/Search/).fill('Maha');
    await page.getByRole('option', { name: /Maharashtra/ }).click();
    await page.getByRole('group', { name: 'What do you want to use?' }).getByRole('checkbox', { name: /^(Business|Shop)/ }).click();
    if (await page.getByRole('radiogroup').count()) await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/onboarding\/step\/2/, { timeout: 30000 });
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.waitForURL(/\/onboarding\/step\/3/, { timeout: 30000 });
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.waitForURL(/\/onboarding\/step\/4/, { timeout: 30000 });
    await page.getByRole('button', { name: /Start using|Finish/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60000 });
    check(tag('setup opens the new business'), where() === '/dashboard', where());
    await shot('4-business-made');

    // ── 5. Sign out, sign in: nothing starred → Money Book ──────────────────
    await signOut();
    await signIn();
    check(tag('with a business but none starred, sign-in lands on Money Book'), where() === '/money-book', where());
    const again = await apiGet(ctx, '/moneybook/people?page=1&page_size=25');
    const rajuAgain = (again.results ?? again.items ?? again).find?.((p) => p.name === 'Raju milkman');
    check(tag('Money Book still has the ₹500'), rajuAgain && Number(rajuAgain.balance) === 500, JSON.stringify(rajuAgain ?? again).slice(0, 120));
    await page.goto(`${FE}/more`, { waitUntil: 'networkidle' });
    check(tag('More now offers "Switch business"'), (await page.getByText('Switch business').count()) > 0);
    await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle' });
    await sleep(800);
    check(tag('the business is still one tap away'), where() === '/dashboard', where());
    await shot('5-relogin-unstarred');

    // ── 6. Star the business ────────────────────────────────────────────────
    await page.goto(`${FE}/apps`, { waitUntil: 'networkidle' });
    await page.getByTestId('apps-star').first().click();
    await sleep(1500);
    const me = await apiGet(ctx, '/auth/me');
    check(tag('the star is saved on the server'), (me.tenants ?? []).some((t) => t.is_default), JSON.stringify(me.tenants?.map((t) => [t.name, t.is_default])));
    await shot('6-starred');

    // ── 7. Sign out, sign in: the starred business opens ────────────────────
    await signOut();
    await signIn();
    check(tag('with a starred business, sign-in lands on it'), where() === '/dashboard', where());
    check(tag('the starred business opens without a red message'), (await redSnackbar()) === 0);
    await page.goto(`${FE}/more`, { waitUntil: 'networkidle' });
    check(tag('More inside the business has "Switch business" and no Apps-for-setup row'), (await page.getByText('Switch business').count()) > 0);
    await page.goto(`${FE}/money-book`, { waitUntil: 'networkidle' });
    check(tag('Money Book still opens from inside the business'), where() === '/money-book' && (await redSnackbar()) === 0, where());
    await shot('7-relogin-starred');
    check(tag('no script error on any page'), errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (error) {
    check(tag('the journey completes'), false, String(error.message).split('\n')[0]);
    await shot('error');
  }
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
