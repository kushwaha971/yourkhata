/**
 * Hide one PART of an app from one team member (owner, 14 Nov 2026: "active/
 * inactive users for that particular sub-module").
 *
 * On the live stack at 390 and 1280:
 *   - the owner opens Team → ⋯ → Apps; under Business and Library are their
 *     parts, all on; the owner switches off Sales and Take fees and saves;
 *   - read back by the member's id: those two hidden, the rest not (self-test);
 *   - the member signs in with their own code: still in every app, not
 *     blocked; their session holds no sales.* and no library.fee.create but
 *     keeps Purchases and enrolling students; the server refuses bills and
 *     answers purchases; the Business menu has no Bills and still has
 *     Purchases; Dashboard, Customers and Purchases open without an error;
 *   - every part is shown again at the end.
 *
 *   node e2e/member-parts.mjs
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/member-parts';
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
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `member-parts-${Date.now()}-${Math.random()}`, ...(init.headers ?? {}) },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  return { ctx, page, api, errors, phone };
};
const ownerIn = async (width) => {
  const o = await open(width);
  await o.page.goto(`${base}/login/email`);
  await o.page.fill('input[type=email]', 'scale@digikhaato.test');
  await o.page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await o.page.keyboard.press('Enter');
  await o.page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return o;
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

const owner = await ownerIn(1280);
const running = ((await owner.api('auth/me')).body?.data?.apps ?? []).map((a) => a.code);
const member = ((await owner.api('members?page_size=100')).body?.data ?? []).find((m) => (m.mobile ?? '').endsWith(MEMBER.mobile));
const memberId = member?.id ?? member?.membership_id;
check(Boolean(memberId), `setup: ${MEMBER.full_name} is on the team (run e2e/member-apps.mjs first)`);
const reset = () => owner.api(`members/${memberId}/apps`, { method: 'PUT', data: { grants: running.map((app) => ({ app, role: 'staff' })), hidden: [] } });
check((await reset()).status === 200, `setup: in every app, nothing hidden`);

for (const width of [390, 1280]) {
  const tag = `${width}`;
  if (width === 1280) await reset();
  const o = await ownerIn(width);
  await o.page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  await o.page.getByRole('button', { name: `Actions for ${MEMBER.full_name}` }).first().click();
  await o.page.getByRole('dialog', { name: MEMBER.full_name }).getByRole('button', { name: /^Apps/ }).click();
  const dialog = o.page.getByRole('dialog', { name: `Apps for ${MEMBER.full_name}` });
  await dialog.getByTestId('member-parts-shop').waitFor();
  const shopParts = await dialog.getByTestId('member-parts-shop').innerText();
  check(/Sales/.test(shopParts) && /Purchases/.test(shopParts) && /Stock/.test(shopParts) && !/Reports/.test(shopParts), `${tag}: Business lists its parts under it (${shopParts.replace(/\s+/g, ' / ')})`);
  check(/Take fees/.test(await dialog.getByTestId('member-parts-library').innerText()), `${tag}: Library lists Take fees`);
  const states = await dialog.getByRole('switch').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked')));
  check(states.every((s) => s === 'true'), `${tag}: every app and part starts on, as the server says (${states.length} switches)`);
  const rows = await dialog.getByRole('switch').evaluateAll((els) => els.map((el) => Math.round(el.closest('label')?.getBoundingClientRect().height ?? 0)));
  check(rows.every((h) => h >= 44), `${tag}: every row is a 44px+ target`);
  const wide = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: nothing runs off the screen (${wide}px)`);
  const cut = await dialog.evaluate((el) => [...el.querySelectorAll('span')].filter((n) => n.children.length === 0 && n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent));
  check(cut.length === 0, `${tag}: no label is cut (${cut.join(', ')})`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-1-parts.png` });
  await dialog.getByRole('switch', { name: /^Sales/ }).click();
  await dialog.getByRole('switch', { name: /^Take fees/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  const back = (await o.api(`members/${memberId}/apps`)).body?.data;
  const hidden = (back?.parts ?? []).filter((p) => p.hidden).map((p) => p.part).sort();
  check(JSON.stringify(hidden) === JSON.stringify(['library_fees', 'sales']), `${tag}: read back by the member's id: hidden ${hidden.join(', ')}`);
  check(JSON.stringify(hidden) !== JSON.stringify(['library_fees', 'purchases', 'sales']), `${tag}: self-test, a skewed list would not match`);
  check(JSON.stringify([...(back?.opens ?? [])].sort()) === JSON.stringify([...running].sort()), `${tag}: they still open every app (${back?.opens?.join(', ')})`);
  check(o.errors.length === 0, `${tag}: no page error on the owner's side`);
  await o.ctx.close();

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
  const me = (await m.api('auth/me')).body?.data;
  const held = new Set(me?.permissions ?? []);
  check(!(me?.blocked_from ?? []).length && (me?.apps ?? []).length === running.length, `${tag}: the member signs in, not blocked, every app (${(me?.apps ?? []).map((a) => a.code).join(', ')})`);
  check(![...held].some((p) => p.startsWith('sales.')) && !held.has('library.fee.create'), `${tag}: their session holds no Sales and no Take fees`);
  check(held.has('purchases.bill.write') && held.has('library.member.write') && held.has('lending.collection.create'), `${tag}: and keeps Purchases, enrolling students and collecting loans`);
  check((await m.api('sales/invoices')).status === 403, `${tag}: the server refuses bills`);
  check((await m.api('purchases/bills')).status === 200, `${tag}: the server answers purchases`);
  await m.api('auth/switch-app', { method: 'POST', data: { app: 'shop' } });
  for (const path of ['/dashboard', '/customers', '/purchases/bills']) {
    await m.page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const text = (await m.page.locator('body').innerText()).replace(/\s+/g, ' ');
    check(!/Something went wrong|Application error|Try again/.test(text), `${tag}: ${path} opens without an error`);
  }
  const links = await m.page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => new URL(a.href).pathname));
  if (!m.phone) check(!links.includes('/sales/invoices') && links.includes('/purchases/bills'), `${tag}: the menu has no Bills and still has Purchases`);
  await m.page.screenshot({ path: `${SHOTS}/${width}-2-member.png` });
  check(m.errors.length === 0, `${tag}: no page error on the member's side${m.errors.length ? ` (${m.errors[0]})` : ''}`);
  await m.ctx.close();
}
check((await reset()).status === 200, 'cleanup: every part shown again');
await owner.ctx.close();
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
