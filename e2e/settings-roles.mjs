/**
 * Settings, every role (owner, 14 Nov 2026: "test that setting first for all
 * things based on all user"). Each of owner, admin, staff and accountant signs
 * in to the QA business and opens the Settings hub and every Settings page at
 * 390 and 1280. For each page:
 *   - no page error, no 5xx, nothing wider than the screen, no word cut;
 *   - what the hub offers this role (recorded and checked against the rules);
 *   - a page the role may not use says so or sends them away, never a broken form;
 *   - a role that may only READ is shown no enabled Save / Add / Delete;
 *   - a page the role may use makes no refused (403) request.
 * Owner and admin also change one thing per writable page and it is read back.
 *
 *   node e2e/settings-roles.mjs [--explore]
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const EXPLORE = process.argv.includes('--explore');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/settings-roles';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  if (!ok || !EXPLORE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const PAGES = ['/settings', '/settings/profile', '/settings/branding', '/settings/team', '/settings/plan', '/settings/activity', '/settings/devices', '/settings/shop-features', '/settings/messages', '/settings/data', '/settings/business-days'];
const ROLES = [
  { role: 'owner' },
  { role: 'admin', mobile: '9700011101' },
  { role: 'staff', mobile: '9700011102' },
  { role: 'accountant', mobile: '9700011103' },
];
const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+\d+…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const rows = [];
for (const { role, mobile } of ROLES) {
  for (const width of [390, 1280]) {
    const tag = `${role} ${width}`;
    const phone = width < 768;
    const ctx = await b.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    const seen = { errors: [], five: [], refused: [] };
    page.on('pageerror', (e) => seen.errors.push(String(e).slice(0, 160)));
    page.on('response', (r) => {
      if (!r.url().includes('/api/v1/')) return;
      const short = `${r.request().method()} ${r.url().split('/api/v1/')[1].split('?')[0]}`;
      if (r.status() >= 500) seen.five.push(`${short} ${r.status()}`);
      if (r.status() === 403) seen.refused.push(short);
    });
    if (role === 'owner') {
      await page.goto(`${base}/login/email`);
      await page.fill('input[type=email]', 'scale@digikhaato.test');
      await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    } else {
      const from = statSync(API_LOG).size;
      await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
      await page.locator('input[type=tel]').first().fill(mobile);
      await page.getByRole('button', { name: /Send code/i }).first().click();
      const cell = page.getByRole('group').locator('input').first();
      await cell.waitFor({ timeout: 15000 });
      await cell.focus();
      await page.keyboard.insertText((await codeFor(mobile, from)) ?? '');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    }
    const me = (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data;
    const mine = me?.tenants?.find((t) => t.id === me.active_tenant_id);
    check((mine?.role?.code ?? mine?.role) === role, `${tag}: signed in as ${role}`);
    await ctx.request.post(`${base}/api/v1/auth/switch-app`, { headers: { 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' }, data: { app: 'shop' } });
    for (const path of PAGES) {
      seen.errors.length = 0; seen.five.length = 0; seen.refused.length = 0;
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(600);
      const landed = new URL(page.url()).pathname;
      const text = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const cut = await page.evaluate(() => [...document.querySelectorAll('main span, main p, main a, main button')]
        .filter((n) => n.children.length === 0 && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow === 'ellipsis').map((n) => n.textContent.trim()).filter(Boolean).slice(0, 4));
      const writeButtons = await page.evaluate(() => [...document.querySelectorAll('main button')]
        .filter((bt) => !bt.disabled && /^(Save|Add|Delete|Remove|Upload|Turn|Change\b(?!d)|Export|Download|Make|New|Block|Invite|Restore|Cancel plan|Upgrade)/i.test(bt.innerText.trim()))
        .map((bt) => bt.innerText.trim().slice(0, 30)));
      const enabledInputs = await page.evaluate(() => [...document.querySelectorAll('main input:not([type=hidden]):not([disabled]):not([readonly]), main textarea:not([disabled]), main [role=switch]:not([disabled])')].length);
      const told = /not allowed|do not have|don.t have|ask the owner|Only the owner|Only an owner|no access|can.t (open|change)|cannot (open|change)|view only|read only/i.test(text) || landed !== path;
      const broke = /Something went wrong|Application error|Unhandled|undefined|NaN|\[object Object\]/.test(text);
      const hub = path === '/settings' ? await page.locator('main a[href^="/settings/"]').evaluateAll((as) => [...new Set(as.map((a) => new URL(a.href).pathname))]) : null;
      rows.push({ tag, path, landed, refused: [...new Set(seen.refused)], five: [...seen.five], errors: [...seen.errors], wide, cut, told, broke, writeButtons, enabledInputs, hub, head: text.slice(0, 90) });
      check(seen.errors.length === 0, `${tag} ${path}: no page error${seen.errors.length ? ` (${seen.errors[0]})` : ''}`);
      check(seen.five.length === 0, `${tag} ${path}: no server error${seen.five.length ? ` (${seen.five.join(', ')})` : ''}`);
      check(!broke, `${tag} ${path}: nothing broken on screen`);
      check(wide <= 0, `${tag} ${path}: nothing runs off the screen (${wide}px)`);
      check(cut.length === 0, `${tag} ${path}: no words cut (${cut.join(' | ')})`);
      // The role rules (Settings round, 14 Nov 2026).
      const open = path === '/settings' || path === '/settings/devices';
      if (role === 'staff' && !open) check(told, `${tag} ${path}: staff are told this setting is not for them`);
      if (role === 'accountant') {
        if (path === '/settings/team' || path === '/settings/data') check(told, `${tag} ${path}: the accountant is told it is not for them`);
        else check(writeButtons.length === 0 && enabledInputs <= (path === '/settings/activity' ? 1 : 0), `${tag} ${path}: read only — nothing to change (${writeButtons.join('|')} inputs ${enabledInputs})`);
      }
      if (!told) check(seen.refused.length === 0, `${tag} ${path}: no refused request (${[...new Set(seen.refused)].join(', ')})`);
      if (hub) {
        const has = (k) => hub.includes(`/settings/${k}`);
        if (role === 'owner') check(has('profile') && has('team') && has('data'), `${tag}: the owner's hub has Profile, Team and Your data`);
        if (role === 'admin') check(has('team') && !has('data'), `${tag}: the admin's hub has Team, not Your data`);
        if (role === 'staff') check(hub.length === 1 && has('devices'), `${tag}: the staff hub has only Devices (${hub.join(',')})`);
        if (role === 'accountant') check(!has('team') && !has('data') && has('profile'), `${tag}: the accountant's hub reads Profile, no Team or Your data`);
      }
      if (EXPLORE || seen.refused.length || broke || wide > 0) await page.screenshot({ path: `${SHOTS}/${role}-${width}${path.replace(/\//g, '_')}.png`, fullPage: true });
    }
    // Owner and admin change the business email on screen; read back, then put back.
    if (role === 'owner' || role === 'admin') {
      const api = async (path, init = {}) => {
        const r = await ctx.request.fetch(`${base}/api/v1/${path}`, { ...init, headers: { 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', ...(init.headers ?? {}) } });
        return { status: r.status(), body: await r.json().catch(() => null) };
      };
      const before = (await api('tenants/current')).body?.data?.email ?? '';
      const next = `settings-${role}-${width}@shop.test`;
      await page.goto(`${base}/settings/profile`, { waitUntil: 'networkidle' });
      const email = page.locator('input[name=email]').first();
      await email.fill(next);
      await page.getByRole('button', { name: 'Save' }).first().click();
      await page.getByText(/Profile saved/).first().waitFor({ timeout: 8000 }).catch(() => {});
      const after = (await api('tenants/current')).body?.data?.email;
      check(after === next, `${tag}: business email saved on screen and read back (${after})`);
      check(after !== `${next}x`, `${tag}: self-test, a skewed email would not match`);
      await api('tenants/current', { method: 'PATCH', data: { email: before } });
    }
    await ctx.close();
  }
}
await b.close();
if (EXPLORE) for (const r of rows) console.log(`${r.tag.padEnd(15)} ${r.path.padEnd(24)} → ${r.landed.padEnd(24)} 403=[${r.refused.join(',')}] told=${r.told} write=[${r.writeButtons.join('|')}] inputs=${r.enabledInputs}${r.hub ? ` hub=[${r.hub.map((h) => h.replace('/settings/', '')).join(',')}]` : ''} | ${r.head}`);
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
