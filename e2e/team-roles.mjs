/**
 * Team members on screen (QA audit, 12 Nov 2026; owner: "by adding team member
 * and login their account to see all the edge cases").
 *
 * The owner adds an admin, a staff member and an accountant by name, mobile and
 * role. Each then signs in with their own number and a code (read from the API
 * log, where the console provider prints it) and walks every page of the
 * Lending, Library, Money book and Business apps at 390 and 1280. For each page:
 *   - no crash, no "Something went wrong", no 5xx, nothing wider than the screen;
 *   - a page the role may read makes no refused (403) request;
 *   - a page the role may not use says so plainly instead of drawing a broken form;
 *   - the member's Money book is their own: none of the owner's people in it.
 *
 *   node e2e/team-roles.mjs [--shots=/tmp/e2e-shots/team-roles] [--explore]
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/team-roles');
const EXPLORE = process.argv.includes('--explore');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  if (!ok || !EXPLORE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

const TEAM = [
  { role: 'admin', name: 'Audit Admin', mobile: '9700011101' },
  { role: 'staff', name: 'Audit Staff', mobile: '9700011102' },
  { role: 'accountant', name: 'Audit Accountant', mobile: '9700011103' },
];

/** Pages per app, and which roles may NOT use each (they must be told so). */
const OWNER_ADMIN = ['staff', 'accountant'];
/** Owner, 13 Nov 2026: staff add borrowers and give loans; an accountant still only reads. */
const NOT_ACCOUNTANT = ['accountant'];
const PAGES = {
  lending: [
    ['/lending', []], ['/lending/loans', []], ['/lending/borrowers', []], ['/lending/messages', []],
    ['/lending/routes', []], ['/lending/settings', OWNER_ADMIN], ['/lending/loans/new', NOT_ACCOUNTANT],
  ],
  library: [
    ['/library', []], ['/library/students', []], ['/library/fees', []], ['/library/seats', []],
    ['/library/attendance', []], ['/library/books', []], ['/library/messages', []], ['/library/money', []],
    ['/library/expenses', []], ['/library/counter', []], ['/library/settings', OWNER_ADMIN],
  ],
  khata: [['/money-book', []], ['/money-book/report', []], ['/money-book/old-dues', []], ['/money-book/reminders', []]],
  shop: [
    ['/dashboard', []], ['/customers', []], ['/suppliers', []], ['/items', []], ['/sales/invoices', []], ['/sales/estimates', []], ['/purchases/bills', []],
    ['/payments', []], ['/expenses', []], ['/reports', []], ['/settings/team', OWNER_ADMIN],
  ],
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const context = (width) => {
  const phone = width < 768;
  return browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
};
const helpers = (ctx) => ({
  csrf: async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '',
  get: async (path) => (await ctx.request.get(`${base}/api/v1/${path}`)).json(),
});

// ── the owner adds the team ────────────────────────────────────────────────
const ownerCtx = await context(1280);
const ownerPage = await ownerCtx.newPage();
await ownerPage.goto(`${base}/login/email`);
await ownerPage.fill('input[type=email]', 'scale@digikhaato.test');
await ownerPage.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
await ownerPage.keyboard.press('Enter');
await ownerPage.waitForURL((u) => !u.pathname.startsWith('/login'));
const owner = helpers(ownerCtx);
const me = (await owner.get('auth/me')).data;
const home = me.tenants.find((t) => t.id === me.active_tenant_id);
const running = ((await owner.get('memberships/apps')).data ?? []).find((r) => r.tenant_id === home.id)?.apps ?? [];
console.log(`owner is in "${home.name}", which runs: ${running.join(', ')}`);
const existing = (await owner.get('members?page_size=100')).data ?? [];
for (const person of TEAM) {
  const had = existing.find((m) => (m.mobile ?? '').endsWith(person.mobile));
  if (had) {
    person.membershipId = had.id ?? had.membership_id;
    check(had.role === person.role || had.role?.code === person.role, `${person.role}: already on the team as ${JSON.stringify(had.role?.code ?? had.role)}`);
    continue;
  }
  const made = await ownerCtx.request.post(`${base}/api/v1/members`, {
    headers: { 'X-CSRF-Token': await owner.csrf(), 'Idempotency-Key': `team-roles-${person.role}-${Date.now()}` },
    data: { full_name: person.name, mobile: person.mobile, role: person.role },
  });
  check(made.status() === 201, `owner adds ${person.name} as ${person.role} (${made.status()} ${made.ok() ? '' : (await made.text()).slice(0, 200)})`);
}
const ownerPeople = ((await owner.get('moneybook/people?page_size=100')).data ?? []).map((p) => p.name);

// ── each member signs in with their own number ─────────────────────────────
const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

const summary = [];
for (const person of TEAM) {
  for (const width of [390, 1280]) {
    const tag = `${person.role} ${width}`;
    const ctx = await context(width);
    const page = await ctx.newPage();
    const seen = { errors: [], five: [], refused: [] };
    page.on('pageerror', (e) => seen.errors.push(String(e).slice(0, 160)));
    page.on('response', (r) => {
      if (!r.url().includes('/api/v1/')) return;
      const short = `${r.request().method()} ${r.url().split('/api/v1/')[1].split('?')[0]}`;
      if (r.status() >= 500) seen.five.push(`${short} ${r.status()}`);
      if (r.status() === 403) seen.refused.push(short);
    });
    const from = statSync(API_LOG).size;
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type=tel]').first().fill(person.mobile);
    await page.getByRole('button', { name: /Send code|Get code|Continue/i }).first().click();
    const cell = page.getByRole('group').locator('input').first();
    await cell.waitFor({ timeout: 15000 });
    const code = await codeFor(person.mobile, from);
    check(Boolean(code), `${tag}: a login code was issued`);
    if (!code) { await ctx.close(); continue; }
    await cell.focus();
    await page.keyboard.insertText(code);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    const api = helpers(ctx);
    const session = (await api.get('auth/me')).data;
    check(session?.active_tenant_id === home.id, `${tag}: signed in to the owner's business (${page.url().replace(base, '')})`);
    const mine = session?.tenants?.find((t) => t.id === home.id);
    check((mine?.role?.code ?? mine?.role) === person.role, `${tag}: the session says ${person.role} (${JSON.stringify(mine?.role?.code ?? mine?.role)})`);
    check(session?.tenants?.length === 1, `${tag}: sees only this one business (${session?.tenants?.length})`);

    // Their Money book is their own.
    const theirs = ((await api.get('moneybook/people?page_size=100')).data ?? []).map((p) => p.name);
    check(!theirs.some((n) => ownerPeople.includes(n)) || ownerPeople.length === 0, `${tag}: none of the owner's ${ownerPeople.length} Money book people (${theirs.length} of their own)`);

    for (const app of Object.keys(PAGES)) {
      if (!running.includes(app)) continue;
      const opened = await ctx.request.post(`${base}/api/v1/auth/switch-app`, { headers: { 'X-CSRF-Token': await api.csrf() }, data: { app } });
      for (const [path, barred] of PAGES[app]) {
        seen.errors.length = 0; seen.five.length = 0; seen.refused.length = 0;
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(500);
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        const landed = new URL(page.url()).pathname;
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const broke = /Something went wrong|Application error|Unhandled|undefined|NaN|\[object Object\]/.test(text);
        const told = /not allowed|do not have|don.t have|ask the owner|Only the owner|Only an owner|no access|cannot open|can.t open/i.test(text) || landed !== path;
        const isBarred = barred.includes(person.role);
        summary.push({ tag, app, path, landed, switch: opened.status(), refused: [...new Set(seen.refused)].join(', '), told, broke, wide, text: text.slice(0, 110) });
        check(seen.errors.length === 0, `${tag} ${path}: no page error${seen.errors.length ? ` (${seen.errors[0]})` : ''}`);
        check(seen.five.length === 0, `${tag} ${path}: no server error${seen.five.length ? ` (${seen.five.join(', ')})` : ''}`);
        check(!broke, `${tag} ${path}: nothing broken on screen${broke ? ` (${text.match(/.{0,40}(Something went wrong|Application error|Unhandled|undefined|NaN|\[object Object\]).{0,40}/)?.[0]})` : ''}`);
        check(wide <= 0, `${tag} ${path}: nothing runs off the screen (${wide}px)`);
        if (isBarred) check(told, `${tag} ${path}: a page this role may not use says so or sends them away`);
        else check(seen.refused.length === 0, `${tag} ${path}: no refused request on a page they may read${seen.refused.length ? ` (${[...new Set(seen.refused)].join(', ')})` : ''}`);
        if (isBarred || seen.refused.length || broke || EXPLORE) await page.screenshot({ path: `${SHOTS}/${person.role}-${width}${path.replace(/\//g, '_')}.png` });
      }
    }
    await ctx.close();
  }
}
await browser.close();
if (EXPLORE) for (const r of summary) console.log(`${r.tag} ${r.path} → ${r.landed} sw=${r.switch} 403=[${r.refused}] told=${r.told} | ${r.text}`);
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
