/**
 * Staff add a borrower and give a loan in Lending (owner, 13 Nov 2026: "Yes,
 * let staff add"). Until then only the owner and admins could.
 *
 * A staff member signs in with their own number and code, at 390 and 1280:
 *   - Add borrower is on screen; the borrower they save is read back from the API;
 *   - New loan opens its form (not "Only the owner can do this"); the loan they
 *     save is read back by its own id, with the amount typed and the schedule shown;
 *   - the borrower's page and the loans list show it without a reload of the app;
 *   - routes and settings are still the owner's, on screen and at the server.
 * An accountant is still offered neither and is refused at the server.
 *
 *   node e2e/staff-lends.mjs   (after e2e/team-roles.mjs has added the team)
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/staff-lends';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });

const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

const signIn = async (width, mobile, role) => {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const from = statSync(API_LOG).size;
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=tel]').first().fill(mobile);
  await page.getByRole('button', { name: /Send code|Get code|Continue/i }).first().click();
  const cell = page.getByRole('group').locator('input').first();
  await cell.waitFor({ timeout: 15000 });
  const code = await codeFor(mobile, from);
  await cell.focus();
  await page.keyboard.insertText(code ?? '');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const api = async (path, init = {}) => {
    const r = await ctx.request.fetch(`${base}/api/v1/${path}`, {
      ...init,
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `staff-lends-${Date.now()}-${Math.random()}`, ...(init.headers ?? {}) },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  const me = (await api('auth/me')).body?.data;
  const mine = me?.tenants?.find((t) => t.id === me.active_tenant_id);
  // WHO is signed in, before anything else (a check must be able to fail for the reason it names).
  check((mine?.role?.code ?? mine?.role) === role, `${role} ${width}: the session says ${role}`);
  await api('auth/switch-app', { method: 'POST', data: { app: 'lending' } });
  return { ctx, page, api, phone };
};

for (const width of [390, 1280]) {
  const tag = `staff ${width}`;
  const { ctx, page, api, phone } = await signIn(width, '9700011102', 'staff');
  const refused = [];
  page.on('response', (r) => r.status() === 403 && r.url().includes('/api/v1/') && refused.push(r.url().split('/api/v1/')[1]));
  const name = `Staff Added ${width} ${Date.now() % 100000}`;

  // 1. Add a borrower from the screen.
  await page.goto(`${base}/lending/borrowers`, { waitUntil: 'networkidle' });
  const add = page.getByRole('button', { name: 'Add borrower' }).filter({ visible: true }).first();
  check((await add.count()) === 1, `${tag}: Add borrower is on the Borrowers page`);
  await add.click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name', { exact: false }).first().fill(name);
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/lending/borrowers' && r.request().method() === 'POST');
  await page.getByTestId('lending-borrower-save').click();
  const made = await saved;
  check(made.status() === 201, `${tag}: the borrower is saved (${made.status()})`);
  const borrowerId = (await made.json()).data?.id;
  const back = (await api(`lending/borrowers/${borrowerId}`)).body?.data;
  check(back?.name === name, `${tag}: read back from the API by its id: "${back?.name}"`);
  await sheet.waitFor({ state: 'hidden' }).catch(() => {});
  await page.getByText(name).first().waitFor({ timeout: 8000 }).catch(() => {});
  check((await page.getByText(name).count()) > 0, `${tag}: the list shows the new borrower without a reload`);
  check((await api(`lending/borrowers/${borrowerId}x`)).status !== 200, `${tag}: self-test, a wrong id does not read back`);

  // 2. Give them a loan from the screen.
  await page.goto(`${base}/lending/loans/new?borrower=${borrowerId}`, { waitUntil: 'networkidle' });
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(!/Only the owner can do this/.test(body), `${tag}: New loan shows its form, not "Only the owner can do this"`);
  await page.getByLabel('Amount lent').fill('1000');
  const preview = page.waitForResponse((r) => r.url().includes('/lending/loans?preview=true') && r.request().postData()?.includes('100'));
  await page.getByLabel('Each day').fill('100');
  const pv = (await (await preview).json()).data;
  const posted = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/lending/loans' && r.request().method() === 'POST' && !r.url().includes('preview'));
  await page.getByTestId('lending-new-loan-save').click();
  const res = await posted;
  check(res.status() === 201, `${tag}: the loan is saved (${res.status()})`);
  const loanId = (await res.json()).data?.id;
  const loan = (await api(`lending/loans/${loanId}`)).body?.data;
  check(Number(loan?.lent) === 1000 && loan?.borrower_id === borrowerId, `${tag}: read back by its id: lent ${loan?.lent} to this borrower`);
  check(loan?.schedule?.length === pv?.schedule?.length && pv?.schedule?.length > 0, `${tag}: the saved schedule is the one shown (${loan?.schedule?.length} / ${pv?.schedule?.length})`);
  check(Number(loan?.lent) !== 1001, `${tag}: self-test, a skewed amount would not match`);
  await page.waitForURL((u) => u.pathname === `/lending/loans/${loanId}`, { timeout: 8000 }).catch(() => {});
  check(new URL(page.url()).pathname === `/lending/loans/${loanId}`, `${tag}: lands on the new loan's page`);
  await page.screenshot({ path: `${SHOTS}/staff-${width}-loan.png` });
  await page.goto(`${base}/lending/loans`, { waitUntil: 'networkidle' });
  check((await page.getByText(name).count()) > 0, `${tag}: the Loans list shows it`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: nothing runs off the screen (${wide}px)`);
  check(refused.length === 0, `${tag}: no request was refused on the way (${refused.join(', ')})`);

  // 3. What stays the owner's.
  await page.goto(`${base}/lending/routes`, { waitUntil: 'networkidle' });
  check((await page.getByTestId('lending-route-add').count()) === 0, `${tag}: no add form on Routes`);
  check((await api('lending/routes', { method: 'POST', data: { name: 'x' } })).status === 403, `${tag}: the server refuses a new route`);
  check((await api(`lending/loans/${loanId}/close`, { method: 'POST', data: { reason: 'written_off' } })).status === 403, `${tag}: the server refuses closing a loan`);
  await page.goto(`${base}/lending/loans/${loanId}`, { waitUntil: 'networkidle' });
  check((await page.getByText(/Write off/i).count()) === 0, `${tag}: Write off is not on the loan page`);
  if (phone) await page.screenshot({ path: `${SHOTS}/staff-390-loan-page.png` });
  await ctx.close();
}

{
  const tag = 'accountant 390';
  const { ctx, page, api } = await signIn(390, '9700011103', 'accountant');
  await page.goto(`${base}/lending/borrowers`, { waitUntil: 'networkidle' });
  check((await page.getByRole('button', { name: 'Add borrower' }).count()) === 0, `${tag}: Add borrower is not offered`);
  check((await api('lending/borrowers', { method: 'POST', data: { name: 'x' } })).status === 403, `${tag}: the server refuses a new borrower`);
  await page.goto(`${base}/lending/loans/new`, { waitUntil: 'networkidle' });
  check(/Only the owner can do this/.test(await page.locator('body').innerText()), `${tag}: New loan says "Only the owner can do this"`);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
