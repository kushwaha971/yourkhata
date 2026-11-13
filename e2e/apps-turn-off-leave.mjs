/**
 * Turn an app off (owner) or leave it (anyone else), from the Apps screen
 * (owner, 14 Nov 2026: "Yes, bring back"). Both lived in the business menu the
 * Apps screen replaced on 12 Nov and were lost with it.
 *
 * On the live stack at 390 and 1280:
 *   - the owner sees "Turn off Ledger" under Ledger, never "Leave"; Cancel
 *     changes nothing; Confirm turns it off, read back from the server's
 *     session; the app's own address no longer opens; its data is untouched;
 *     "Add Ledger" on the same screen brings it back with every loan it had;
 *   - a staff member sees "Leave Library", never "Turn off"; leaving takes
 *     Library out of THEIR session only (the owner still has it);
 *   - Money book, the person's own book, offers neither;
 *   - the row is a 44px target and nothing runs off the screen.
 *
 *   node e2e/apps-turn-off-leave.mjs
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/apps-turn-off-leave';
const LEAVER = { full_name: 'Audit Leaver', mobile: '9700011104', role: 'staff' };
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
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `apps-off-${Date.now()}-${Math.random()}`, ...(init.headers ?? {}) },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  const codes = async () => ((await api('auth/me')).body?.data?.apps ?? []).map((a) => a.code).sort();
  return { ctx, page, api, codes, errors, phone };
};
const ownerIn = async (width) => {
  const s = await open(width);
  await s.page.goto(`${base}/login/email`);
  await s.page.fill('input[type=email]', 'scale@digikhaato.test');
  await s.page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await s.page.keyboard.press('Enter');
  await s.page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return s;
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
const action = (page) => page.getByTestId('apps-app-action');
const fitsAndTaps = async (page, tag) => {
  const box = await action(page).boundingBox();
  check(box && box.height >= 44, `${tag}: the row is a ${Math.round(box?.height ?? 0)}px target`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: nothing runs off the screen (${wide}px)`);
};

// ── the owner turns Ledger off and adds it back ────────────────────────────
for (const width of [390, 1280]) {
  const tag = `owner ${width}`;
  const { ctx, page, api, codes, errors } = await ownerIn(width);
  const before = await codes();
  const loansBefore = ((await api('lending/loans?status=all')).body?.data ?? []).length;
  check(before.includes('lending') && before.length > 1, `${tag}: starts with Ledger among ${before.length} apps`);
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  await page.getByTestId('apps-card-khata').click();
  await page.waitForURL((u) => u.pathname.startsWith('/money-book'));
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  check((await action(page).count()) === 0, `${tag}: Money book, the person's own, offers neither`);
  await page.getByTestId('apps-card-lending').click();
  await page.waitForURL((u) => u.pathname.startsWith('/lending'));
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  check((await action(page).innerText()).trim() === 'Turn off Ledger', `${tag}: the owner is offered "Turn off Ledger"`);
  check((await page.getByRole('button', { name: /^Leave / }).count()) === 0, `${tag}: and never "Leave"`);
  await fitsAndTaps(page, tag);
  await page.screenshot({ path: `${SHOTS}/owner-${width}-1-row.png`, fullPage: true });

  await action(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const words = (await dialog.innerText()).replace(/\s+/g, ' ');
  check(/Turn off Ledger for .+\?/.test(words) && /Nothing is deleted/.test(words) && /add it back from Apps/.test(words), `${tag}: the dialog says what happens`);
  await page.screenshot({ path: `${SHOTS}/owner-${width}-2-confirm.png` });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await dialog.waitFor({ state: 'hidden' });
  check(JSON.stringify(await codes()) === JSON.stringify(before), `${tag}: Cancel changes nothing`);

  await action(page).click();
  const sent = [];
  page.on('request', (r) => r.method() === 'POST' && r.url().includes('/tenants/current/apps') && sent.push(r.postData()));
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Turn off Ledger' });
  await confirm.dblclick().catch(() => {});
  await page.waitForURL((u) => !u.pathname.startsWith('/apps') && !u.pathname.startsWith('/lending'), { timeout: 15000 }).catch(() => {});
  const after = await codes();
  check(!after.includes('lending') && after.length === before.length - 1, `${tag}: read back from the session: Ledger is off (${after.join(', ')})`);
  check(sent.length === 1, `${tag}: a double tap on Confirm sends one request (${sent.length})`);
  check(!new URL(page.url()).pathname.startsWith('/lending'), `${tag}: lands in an app that is left (${new URL(page.url()).pathname})`);
  check((await api('lending/loans')).status === 403, `${tag}: the server answers nobody for Ledger now`);
  await page.goto(`${base}/lending`, { waitUntil: 'networkidle' });
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(!/Something went wrong|Application error/.test(body), `${tag}: typing the old address breaks nothing (${new URL(page.url()).pathname})`);

  // Add it back from the same screen, as the dialog promised.
  await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
  check((await page.getByTestId('apps-card-lending').count()) === 0, `${tag}: Ledger is no longer among Your apps`);
  await page.screenshot({ path: `${SHOTS}/owner-${width}-3-off.png`, fullPage: true });
  await page.getByTestId('app-add-tiles').getByRole('button', { name: /Ledger/ }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/lending'), { timeout: 15000 }).catch(() => {});
  check(JSON.stringify(await codes()) === JSON.stringify(before), `${tag}: "Add Ledger" brings it back: the same apps as before`);
  const loansAfter = ((await api('lending/loans?status=all')).body?.data ?? []).length;
  check(loansAfter === loansBefore && loansBefore > 0, `${tag}: nothing was deleted: ${loansAfter} loans, as before (${loansBefore})`);
  check(loansAfter !== loansBefore + 1, `${tag}: self-test, a skewed count would not match`);
  check(errors.length === 0, `${tag}: no page error${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

// ── a staff member leaves Library ──────────────────────────────────────────
{
  const owner = await ownerIn(1280);
  const all = await owner.codes();
  const find = async () => ((await owner.api('members?page_size=100')).body?.data ?? []).find((m) => (m.mobile ?? '').endsWith(LEAVER.mobile));
  if (!(await find())) {
    const made = await owner.api('members', { method: 'POST', data: LEAVER });
    check(made.status === 201, `setup: the owner adds ${LEAVER.full_name} as staff (${made.status})`);
  }
  const member = await find();
  const memberId = member?.id ?? member?.membership_id;
  // An earlier run left them out of Library: the owner puts them back in every shared app.
  const shared = all.filter((c) => c !== 'khata');
  const put = await owner.api(`members/${memberId}/apps`, { method: 'PUT', data: { grants: shared.map((app) => ({ app, role: 'staff' })) } });
  check(put.status === 200, `setup: ${LEAVER.full_name} is in ${shared.join(', ')} (${put.status})`);

  for (const width of [390, 1280]) {
    const tag = `staff ${width}`;
    if (width === 1280) await owner.api(`members/${memberId}/apps`, { method: 'PUT', data: { grants: shared.map((app) => ({ app, role: 'staff' })) } });
    const { ctx, page, api, codes, errors } = await open(width);
    const from = statSync(API_LOG).size;
    await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type=tel]').first().fill(LEAVER.mobile);
    await page.getByRole('button', { name: /Send code|Get code|Continue/i }).first().click();
    const cell = page.getByRole('group').locator('input').first();
    await cell.waitFor({ timeout: 15000 });
    await cell.focus();
    await page.keyboard.insertText((await codeFor(LEAVER.mobile, from)) ?? '');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
    const me = (await api('auth/me')).body?.data;
    const mine = me?.tenants?.find((t) => t.id === me.active_tenant_id);
    check((mine?.role?.code ?? mine?.role) === 'staff', `${tag}: the session says staff`);
    const before = await codes();
    check(before.includes('library'), `${tag}: starts in Library (${before.join(', ')})`);
    await api('auth/switch-app', { method: 'POST', data: { app: 'library' } });
    await page.goto(`${base}/library`, { waitUntil: 'networkidle' });
    await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
    check((await action(page).innerText()).trim() === 'Leave Library', `${tag}: staff are offered "Leave Library"`);
    check((await page.getByRole('button', { name: /^Turn off / }).count()) === 0, `${tag}: and never "Turn off"`);
    check((await page.getByTestId('app-add-tiles').count()) === 0, `${tag}: and no app to add`);
    await fitsAndTaps(page, tag);
    await action(page).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    check(/Leave Library at .+\?/.test(await dialog.innerText()) && /the owner can add you back/.test(await dialog.innerText()), `${tag}: the dialog says what happens`);
    await page.screenshot({ path: `${SHOTS}/staff-${width}-confirm.png` });
    await dialog.getByRole('button', { name: 'Leave Library' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/apps') && !u.pathname.startsWith('/library'), { timeout: 15000 }).catch(() => {});
    const after = await codes();
    check(!after.includes('library') && after.length === before.length - 1, `${tag}: read back: Library is gone from THEIR session (${after.join(', ')})`);
    // Leaving bumps the member's rights version, so the old token is refused
    // as stale (401) at once; the app refreshes it, as here, and then it is 403.
    const stale = await api('library/students');
    check(stale.status === 401 || stale.status === 403, `${tag}: the old token no longer reads Library (${stale.status} ${stale.body?.error?.code ?? ''})`);
    await api('auth/refresh', { method: 'POST' });
    const refusedNow = await api('library/students');
    check(refusedNow.status === 403, `${tag}: after the refresh the server refuses them Library (${refusedNow.status})`);
    const landed = new URL(page.url()).pathname;
    const landedText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    check(!landed.startsWith('/login') && !/Something went wrong|Try again/.test(landedText), `${tag}: they stay signed in, on a working page (${landed})`);
    await page.screenshot({ path: `${SHOTS}/staff-${width}-after.png` });
    check((await owner.codes()).includes('library'), `${tag}: the owner still has Library`);
    check((await api('tenants/current/apps', { method: 'POST', data: { app: 'lending', running: false } })).status === 403, `${tag}: the server refuses staff turning an app off`);
    await page.goto(`${base}/apps`, { waitUntil: 'networkidle' });
    check((await page.getByTestId('apps-card-library').count()) === 0, `${tag}: Library is no longer among Your apps`);
    check(errors.length === 0, `${tag}: no page error${errors.length ? ` (${errors[0]})` : ''}`);
    await ctx.close();
  }
  await owner.ctx.close();
}
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
