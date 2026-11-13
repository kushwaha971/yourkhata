/**
 * Choose which apps a member opens, from the Team screen (owner, 14 Nov 2026:
 * "owner or admin can activate or deactivate member … for that particular
 * module … instead of blocking them to login").
 *
 * On the live stack at 390 and 1280:
 *   - the owner opens Team → ⋯ → Apps for a staff member; the switches show
 *     what the server says the member opens today; Money book is not a switch;
 *   - every app off is refused on screen, and nothing is sent;
 *   - Business and Library off, Save: read back from the server by the member's
 *     id (self-tested), and the member — signing in with their own code — has
 *     Ledger and their own Money book, is NOT blocked, and the server refuses
 *     them Business and Library while Ledger and Money book still answer;
 *   - nothing runs off the screen, and the member gets everything back at the end.
 *
 *   node e2e/member-apps.mjs
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/member-apps';
const MEMBER = { full_name: 'Audit Leaver', mobile: '9700011104', role: 'staff' };
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const open = async (width) => {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const api = async (path, init = {}) => {
    const r = await ctx.request.fetch(`${base}/api/v1/${path}`, {
      ...init,
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `member-apps-${Date.now()}-${Math.random()}`, ...(init.headers ?? {}) },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  return { ctx, page, api, errors };
};
const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

// The owner, and the member in every app the business runs.
const owner = await open(1280);
await owner.page.goto(`${base}/login/email`);
await owner.page.fill('input[type=email]', 'scale@digikhaato.test');
await owner.page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
await owner.page.keyboard.press('Enter');
await owner.page.waitForURL((u) => !u.pathname.startsWith('/login'));
const running = ((await owner.api('auth/me')).body?.data?.apps ?? []).map((a) => a.code);
const find = async () => ((await owner.api('members?page_size=100')).body?.data ?? []).find((m) => (m.mobile ?? '').endsWith(MEMBER.mobile));
if (!(await find())) check((await owner.api('members', { method: 'POST', data: MEMBER })).status === 201, `setup: ${MEMBER.full_name} added as staff`);
const member = await find();
const memberId = member?.id ?? member?.membership_id;
const everything = () => owner.api(`members/${memberId}/apps`, { method: 'PUT', data: { grants: running.map((app) => ({ app, role: 'staff' })) } });
check((await everything()).status === 200, `setup: ${MEMBER.full_name} is in ${running.join(', ')}`);

for (const width of [390, 1280]) {
  const tag = `${width}`;
  if (width === 1280) await everything();
  const o = await open(width);
  await o.page.goto(`${base}/login/email`);
  await o.page.fill('input[type=email]', 'scale@digikhaato.test');
  await o.page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await o.page.keyboard.press('Enter');
  await o.page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await o.page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  await o.page.getByRole('button', { name: `Actions for ${MEMBER.full_name}` }).first().click();
  // Inside the member's own sheet: the phone's last tab is also called "Apps and more".
  const row = o.page.getByRole('dialog', { name: MEMBER.full_name }).getByRole('button', { name: /^Apps/ });
  check((await row.count()) === 1, `${tag}: the member's ⋯ offers Apps`);
  await row.click();
  const dialog = o.page.getByRole('dialog', { name: `Apps for ${MEMBER.full_name}` });
  await dialog.waitFor();
  await dialog.getByRole('switch').first().waitFor();
  const names = await dialog.getByRole('switch').evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') || el.closest('label')?.innerText || el.parentElement?.innerText || '').trim()));
  const states = await dialog.getByRole('switch').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked')));
  check(states.every((s) => s === 'true'), `${tag}: every app is on, as the server says (${names.join(' / ')})`);
  check(!(await dialog.innerText()).match(/^Money book$/m) && (await dialog.getByRole('switch', { name: /Money book/ }).count()) === 0, `${tag}: Money book is not a switch`);
  check(/keep their own Money book/.test(await dialog.innerText()), `${tag}: the dialog says they keep signing in and their own Money book`);
  const wide = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: nothing runs off the screen (${wide}px)`);
  // The track is 18px by design (UbSwitch); the whole labelled row is the target.
  const rows = await dialog.getByRole('switch').evaluateAll((els) => els.map((el) => Math.round(el.closest('label')?.getBoundingClientRect().height ?? 0)));
  check(rows.every((h) => h >= 44), `${tag}: each app row is a 44px+ target (${rows.join(', ')}px)`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-1-dialog.png` });

  // Every app off is refused, and nothing is sent.
  const puts = [];
  o.page.on('request', (r) => r.method() === 'PUT' && r.url().includes(`/members/${memberId}/apps`) && puts.push(r.postData()));
  // Only the app rows: an app's parts (member-parts.mjs) disappear when it goes off.
  for (const app of ['Library', 'Ledger', 'Business']) await dialog.getByRole('switch', { name: app, exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.getByText(/Keep at least one app on/).waitFor({ timeout: 5000 }).catch(() => {});
  check((await dialog.getByText(/Keep at least one app on/).count()) === 1 && puts.length === 0, `${tag}: every app off is refused on screen, nothing sent (${puts.length})`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-2-none.png` });

  // Leave only Ledger on.
  await dialog.getByRole('switch', { name: 'Ledger', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).dblclick().catch(() => {});
  await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  check(puts.length === 1, `${tag}: a double tap on Save sends one change (${puts.length})`);
  const back = (await o.api(`members/${memberId}/apps`)).body?.data;
  check(JSON.stringify([...back.opens].sort()) === JSON.stringify(['khata', 'lending']), `${tag}: read back by the member's id: they open ${back.opens.join(', ')}`);
  check(JSON.stringify([...back.opens].sort()) !== JSON.stringify(['khata', 'lending', 'shop']), `${tag}: self-test, a skewed list would not match`);
  const said = (await o.page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(/now opens Ledger only here/.test(said), `${tag}: the snackbar says what changed`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-3-saved.png` });
  const listed = await find();
  check(listed?.status === 'active', `${tag}: the member is still active, not blocked (${listed?.status})`);
  check(o.errors.length === 0, `${tag}: no page error on the owner's side${o.errors.length ? ` (${o.errors[0]})` : ''}`);
  await o.ctx.close();

  // The member signs in with their own code.
  const m = await open(width);
  const from = statSync(API_LOG).size;
  await m.page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await m.page.locator('input[type=tel]').first().fill(MEMBER.mobile);
  await m.page.getByRole('button', { name: /Send code|Get code|Continue/i }).first().click();
  const cell = m.page.getByRole('group').locator('input').first();
  await cell.waitFor({ timeout: 15000 });
  await cell.focus();
  await m.page.keyboard.insertText((await codeFor(MEMBER.mobile, from)) ?? '');
  await m.page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  await m.page.waitForLoadState('networkidle');
  const me = (await m.api('auth/me')).body?.data;
  check(me?.tenants?.some((t) => t.id === me.active_tenant_id) && !(me?.blocked_from ?? []).length, `${tag}: the member signs in to the business, not blocked`);
  check(JSON.stringify((me?.apps ?? []).map((a) => a.code).sort()) === JSON.stringify(['khata', 'lending']), `${tag}: their session has Ledger and their own Money book only (${(me?.apps ?? []).map((a) => a.code).join(', ')})`);
  check((await m.api('lending/loans')).status === 200, `${tag}: Ledger answers them`);
  check((await m.api('moneybook/people')).status === 200, `${tag}: their own Money book answers them`);
  check((await m.api('library/students')).status === 403, `${tag}: Library refuses them`);
  check((await m.api('sales/invoices')).status === 403, `${tag}: Business refuses them`);
  await m.page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  const cards = await m.page.getByTestId('app-sheet-tiles').innerText().catch(() => '');
  check(!/Library|Business/.test(cards) && /Ledger/.test(cards), `${tag}: their Apps screen shows Ledger, not Library or Business`);
  await m.page.screenshot({ path: `${SHOTS}/${width}-4-member-apps.png`, fullPage: true });
  check(m.errors.length === 0, `${tag}: no page error on the member's side${m.errors.length ? ` (${m.errors[0]})` : ''}`);
  await m.ctx.close();
}
check((await everything()).status === 200, `cleanup: ${MEMBER.full_name} is back in every app`);
await owner.ctx.close();
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
