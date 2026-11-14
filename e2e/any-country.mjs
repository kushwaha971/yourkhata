/**
 * Mobile numbers of any country, India first (owner, 14 Nov 2026: "allow for
 * all country and keep India by default … in entire application").
 *
 * On the live stack at 1280 and 390:
 *   - sign-in starts on +91; choosing United Kingdom from the list and typing a
 *     UK number sends +447911…, the code arrives (console) and signs in; the
 *     session's mobile reads back as that UK number;
 *   - Add member offers the list too, and a member added with a UK number reads
 *     back with +44 from the API;
 *   - an Indian number still needs its ten digits (the stricter rule stays).
 *
 *   node e2e/any-country.mjs
 */
import { readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const codeFor = async (last3, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+\d+…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === last3);
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};
const pickUk = async (page) => {
  const picker = page.getByRole('combobox', { name: 'Country code' }).first();
  await picker.waitFor({ timeout: 10000 });
  await picker.click();
  await page.keyboard.type('United Kingdom');
  await page.getByRole('option', { name: /United Kingdom/ }).first().click();
  return picker;
};
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
let n = 0;
for (const width of [1280, 390]) {
  const phone = width < 768;
  const ctx = await b.newContext({ viewport: { width, height: 844 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  // Sign-in with a UK number.
  await p.goto(`${base}/login`, { waitUntil: 'networkidle' });
  const picker = p.getByRole('combobox', { name: 'Country code' }).first();
  await picker.waitFor({ timeout: 10000 });
  check((await picker.innerText()).includes('+91'), `${width}: sign-in starts on +91`);
  // India keeps its ten digits.
  await p.locator('input[type=tel]').first().fill('98450');
  await p.getByRole('button', { name: /Send code/i }).first().click();
  check((await p.getByText(/10-digit/).count()) > 0, `${width}: a short Indian number is still refused`);
  await pickUk(p);
  check((await picker.innerText()).includes('+44'), `${width}: United Kingdom chosen from the list (+44)`);
  n += 1;
  const national = `79111234${50 + n}`;
  await p.locator('input[type=tel]').first().fill(national);
  const sent = [];
  p.on('request', (r) => r.url().includes('/otp/request') && sent.push(JSON.parse(r.postData() || '{}').mobile));
  const from = statSync(API_LOG).size;
  await p.getByRole('button', { name: /Send code/i }).first().click();
  const cells = p.locator('[role=group] input[inputmode=numeric]');
  await cells.first().waitFor({ timeout: 15000 });
  check(sent[0] === `+44${national}`, `${width}: the code is asked for +44${national} (${sent[0]})`);
  const code = await codeFor(national.slice(-3), from);
  check(Boolean(code), `${width}: a code was issued for the UK number`);
  await cells.first().focus();
  await p.keyboard.insertText(code ?? '');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  const me = await (await ctx.request.get(`${base}/api/v1/auth/me`)).json();
  check(me?.data?.user?.mobile === `+44${national}` || me?.data?.mobile === `+44${national}`, `${width}: signed in; the account's mobile reads back as +44${national}`);
  check(errors.length === 0, `${width}: no page error`);
  await p.screenshot({ path: `/tmp/e2e-shots/any-country-${width}.png` });
  await ctx.close();

  // Add member with a UK number, as the QA owner.
  const o = await b.newContext({ viewport: { width, height: 844 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const op = await o.newPage();
  await op.goto(`${base}/login/email`);
  await op.fill('input[type=email]', 'scale@digikhaato.test');
  await op.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await op.keyboard.press('Enter');
  await op.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = async () => (await o.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const mobile = `+4479111235${60 + n}`;
  const members = async () => (await (await o.request.get(`${base}/api/v1/members?page_size=200`)).json()).data ?? [];
  for (const m of await members()) if (m.mobile === mobile) await o.request.post(`${base}/api/v1/members/${m.id}/remove`, { headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `rm-${Date.now()}` } });
  await op.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  await op.getByRole('button', { name: 'Add member' }).first().click();
  const add = op.getByRole('dialog');
  await add.getByLabel(/Full name/).fill(`Overseas Staff ${width}`);
  await pickUk(op);
  await add.locator('input[type=tel]').fill(mobile.slice(3));
  await add.getByRole('button', { name: 'Add to team' }).click();
  await op.waitForTimeout(1500);
  const found = (await members()).find((m) => m.mobile === mobile);
  check(Boolean(found), `${width}: Add member with a UK number — read back as ${found?.mobile ?? 'nothing'}`);
  await op.screenshot({ path: `/tmp/e2e-shots/any-country-member-${width}.png` });
  if (found) await o.request.post(`${base}/api/v1/members/${found.id}/remove`, { headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `rm-${Date.now()}` } });
  await o.close();
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
