/**
 * Your data › Delete, for an owner who signs in with a mobile code and so has
 * no password (owner, 15 Nov 2026). On the live stack, at 390:
 *   - a fresh mobile signs in (a new account) and makes a throwaway business;
 *   - its data is downloaded (the delete needs a fresh export; the job runner
 *     is drained once by this script, as cron would);
 *   - Delete shows "Send code to my mobile" and NO password field;
 *   - a wrong code deletes nothing; the right code from the API log does;
 *   - the business reads back as pending deletion, then Cancel restores it.
 * Only the throwaway business is touched. Shots in /tmp/e2e-shots/delete-by-code.
 *
 *   node e2e/delete-by-code.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const PY = process.env.E2E_PYTHON;
const SHOTS = '/tmp/e2e-shots/delete-by-code';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const mobile = `97002${String(Date.now()).slice(-5)}`;
const codeFor = async (notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG).subarray(notBefore).toString('utf8');
    const hits = [...log.matchAll(/sms\.console to=\+\d+…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname}: ${String(e).slice(0, 200)}`));
const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
const api = async (method, path, data) => {
  const r = await ctx.request.fetch(`${base}/api/v1/${path}`, { method, headers: { 'X-CSRF-Token': await csrf() }, ...(data ? { data } : {}) });
  return { status: r.status(), body: await r.json().catch(() => null) };
};

// A new account that signs in with a code.
let from = statSync(API_LOG).size;
await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.locator('input[type=tel]').first().fill(mobile);
await page.getByRole('button', { name: /Send code/i }).first().click();
const cell = page.getByRole('group').locator('input').first();
await cell.waitFor({ timeout: 15000 });
await cell.focus();
await page.keyboard.insertText((await codeFor(from)) ?? '');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
const me = (await api('GET', 'auth/me')).body?.data;
check(me?.user?.has_password === false, `signed in by code, with no password (${me?.user?.has_password})`);

// Its own throwaway business, made the way the wizard makes one.
const made = await api('POST', 'tenants', { name: `Delete Test ${mobile.slice(-4)}`, business_type: 'kirana', state_code: '27' });
check(made.status === 201 || made.status === 200, `throwaway business created (${made.status})`);
const tenantId = made.body?.data?.id;
await api('POST', 'auth/switch-tenant', { tenant_id: tenantId });
await page.goto(`${base}/settings/data`, { waitUntil: 'networkidle' });

// The download the delete needs; the job runner is drained once, as cron would.
const exp = await api('POST', 'tenants/current/export');
check(exp.status === 202, `download asked for (${exp.status})`);
execFileSync(PY, ['manage.py', 'run_scheduler', '--interval', '0'], { cwd: new URL('../backend/', import.meta.url).pathname, stdio: 'ignore' });
const state = (await api('GET', 'tenants/current/deletion')).body?.data;
check(state?.export_fresh === true, `the download is fresh (${state?.export_fresh})`);

// Delete, by code.
await page.goto(`${base}/settings/data`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Delete business' }).first().click();
const dialog = page.getByRole('dialog');
await dialog.waitFor();
check((await dialog.getByLabel(/Password/).count()) === 0, 'no password field for a mobile-only owner');
from = statSync(API_LOG).size;
await dialog.getByRole('button', { name: 'Send code to my mobile' }).click();
const box = dialog.getByRole('group').locator('input').first();
await box.waitFor({ timeout: 15000 });
await page.screenshot({ path: `${SHOTS}/code.png`, fullPage: true });
const code = await codeFor(from);
await dialog.getByLabel(/^Type .* to confirm/).fill(`Delete Test ${mobile.slice(-4)}`);
await box.focus();
await page.keyboard.insertText(code === '000000' ? '111111' : '000000');
await dialog.getByRole('button', { name: 'Delete business' }).click();
await page.waitForTimeout(1500);
check((await api('GET', 'tenants/current/deletion')).body?.data?.status === 'active', 'a wrong code deletes nothing');
await page.screenshot({ path: `${SHOTS}/wrong.png`, fullPage: true });
await box.focus();
for (let i = 0; i < 6; i += 1) await page.keyboard.press('Backspace');
await page.keyboard.insertText(code ?? '');
await dialog.getByRole('button', { name: 'Delete business' }).click();
await page.waitForTimeout(2000);
const after = (await api('GET', 'tenants/current/deletion')).body?.data?.status;
check(after === 'pending_deletion', `the right code asks for deletion, read back (${after})`);
check(after !== 'active', 'self-test: an unchanged business would not read as pending');
await page.screenshot({ path: `${SHOTS}/pending.png`, fullPage: true });

// Undo, so nothing is left scheduled.
const cancel = await api('POST', 'tenants/current/delete-cancel');
check(cancel.status === 200 && cancel.body?.data?.status === 'active', `cancelled again (${cancel.status})`);
check(errors.length === 0, `no page error ${errors.join(' | ')}`);
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
