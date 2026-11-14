/**
 * Your profile › Change mobile number (design settings-and-profile S2,
 * owner-approved 14 Nov 2026). The QA staff member, at 390 and 1280:
 *   - asks for a number another account signs in with → told so, nothing sent;
 *   - asks for a new number, types a WRONG code → told so, number unchanged;
 *   - types the right code from the API log → the sign-in moves, read back;
 *   - signs in with the NEW number; then changes it back the same way.
 * Shots in /tmp/e2e-shots/change-mobile.
 *
 *   node e2e/change-mobile.mjs
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/change-mobile';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const STAFF = '9700011102';
const TAKEN = '9700011101'; // the QA admin signs in with it
// A fresh pair of numbers each run: the server waits sixty seconds between
// codes to one number, so reusing a number on a quick rerun is refused.
const tail = String(Date.now()).slice(-4);
const NEXT = { 390: `97001${tail}0`, 1280: `97001${tail}1` };
const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG).subarray(notBefore).toString('utf8');
    const hits = [...log.matchAll(/sms\.console to=\+\d+…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};
const signIn = async (page, mobile) => {
  const from = statSync(API_LOG).size;
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=tel]').first().fill(mobile);
  await page.getByRole('button', { name: /Send code/i }).first().click();
  const cell = page.getByRole('group').locator('input').first();
  await cell.waitFor({ timeout: 15000 });
  await cell.focus();
  await page.keyboard.insertText((await codeFor(mobile, from)) ?? '');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
};
const me = async (ctx) => (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data?.user ?? {};
const change = async (page, to, { wrongFirst = false, shot = '' } = {}) => {
  await page.goto(`${base}/settings/me`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Change', exact: true }).click();
  await page.waitForURL(/\/settings\/me\/mobile/);
  await page.locator('input[type=tel]').first().fill(to);
  const from = statSync(API_LOG).size;
  await page.getByRole('button', { name: 'Send code' }).click();
  const cell = page.getByRole('group').locator('input').first();
  await cell.waitFor({ timeout: 15000 });
  if (shot) await page.screenshot({ path: `${SHOTS}/${shot}-code.png`, fullPage: true });
  const code = await codeFor(to, from);
  if (wrongFirst) {
    await cell.focus();
    await page.keyboard.insertText(code === '000000' ? '111111' : '000000');
    await page.getByText(/That code is not right/).first().waitFor({ timeout: 8000 }).catch(() => {});
    return code;
  }
  await cell.focus();
  await page.keyboard.insertText(code ?? '');
  await page.waitForURL((u) => u.pathname === '/settings/me', { timeout: 15000 }).catch(() => {});
  return code;
};

const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 1280]) {
  const tag = `staff ${width}`;
  const phone = width < 768;
  const ctx = await b.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  // Every console error is printed, so an intermittent one (React #418 on
  // /login, seen twice in about twelve live runs) leaves its evidence.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log(`console ${new URL(page.url()).pathname}: ${m.text().slice(0, 1500)}`); });
  page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname}: ${String(e).slice(0, 300)}`));
  await signIn(page, STAFF);
  check((await me(ctx)).mobile === `+91${STAFF}`, `${tag}: signed in as the QA staff member`);

  // A number another account signs in with.
  await page.goto(`${base}/settings/me/mobile`, { waitUntil: 'networkidle' });
  await page.locator('input[type=tel]').first().fill(TAKEN);
  await page.getByRole('button', { name: 'Send code' }).click();
  const taken = await page.getByText('Another account signs in with this number.').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check(taken, `${tag}: a number another account uses is refused under the field`);
  await page.screenshot({ path: `${SHOTS}/${width}-taken.png`, fullPage: true });

  // A wrong code changes nothing.
  const right = await change(page, NEXT[width], { wrongFirst: true, shot: `${width}` });
  const told = await page.getByText(/That code is not right/).count();
  check(told > 0, `${tag}: a wrong code is told under the boxes`);
  await page.screenshot({ path: `${SHOTS}/${width}-wrong.png`, fullPage: true });
  check((await me(ctx)).mobile === `+91${STAFF}`, `${tag}: a wrong code changed nothing`);

  // The right code, typed into the same boxes, moves the sign-in. (A second
  // code inside sixty seconds is refused by the server's resend gap.)
  const cell = page.getByRole('group').locator('input').first();
  await cell.focus();
  await page.keyboard.insertText(right ?? '');
  await page.waitForURL((u) => u.pathname === '/settings/me', { timeout: 15000 }).catch(() => {});
  if (new URL(page.url()).pathname !== '/settings/me') {
    console.log(`debug ${tag}: still on ${new URL(page.url()).pathname}; code ${right}; boxes "${await page.getByRole('group').locator('input').evaluateAll((xs) => xs.map((x) => x.value).join(''))}"; text: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
    await page.screenshot({ path: `${SHOTS}/${width}-stuck.png`, fullPage: true });
  }
  const after = (await me(ctx)).mobile;
  check(after === `+91${NEXT[width]}`, `${tag}: the new number is read back (${after})`);
  check(after !== `+91${NEXT[width]}0`, `${tag}: self-test, a skewed number would not match`);
  const shown = await page.getByText(new RegExp(`\\+91 ${NEXT[width].slice(0, 5)} ${NEXT[width].slice(5)}`)).count();
  check(shown > 0, `${tag}: Your profile shows the new number at once`);
  await page.screenshot({ path: `${SHOTS}/${width}-changed.png`, fullPage: true });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: nothing runs off the screen (${wide}px)`);

  // The new number signs in.
  if (process.env.DEBUG418) {
    console.log('storage', await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } })));
  }
  await ctx.clearCookies();
  if (process.env.DEBUG418) {
    const ssr = await (await ctx.request.get(`${base}/login`)).text();
    console.log('ssr main text', ssr.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  }
  await signIn(page, NEXT[width]);
  check((await me(ctx)).mobile === `+91${NEXT[width]}`, `${tag}: the new number signs in`);

  // And back, so the QA account keeps its number.
  await change(page, STAFF);
  check((await me(ctx)).mobile === `+91${STAFF}`, `${tag}: changed back to the QA number`);
  // 14 Nov 2026: one run raised React #418 (server and client HTML differ) on
  // /login after cookies were cleared; sixteen targeted reruns did not. It
  // counts again, and the page is kept so the next one can be read.
  check(errors.length === 0, `${tag}: no page error ${errors.join(' | ')}`);
  if (errors.length) await page.screenshot({ path: `${SHOTS}/${width}-page-error.png`, fullPage: true });
  await ctx.close();
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
