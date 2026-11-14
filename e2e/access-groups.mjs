/**
 * Access groups, live (owner, 14 Nov 2026; design docs/revamp/design/access-groups.html).
 *
 * At 390 and 1280, on the QA business:
 *   1. Business › Team says which app and business it is for. Access groups
 *      starts empty for Business; the owner makes the server's example
 *      "Counter staff" on screen (Purchases off, Stock view only) as default;
 *      read back by the API.
 *   2. Members › ⋯ › Access for a staff member: the owner puts them in the
 *      group on screen; read back.
 *   3. The member signs in with their own code: bills answer, purchases are
 *      refused, stock is read-only, Library is untouched; not signed out of
 *      anything else.
 *   4. An exception (Purchases view only) and a change to the group reach the
 *      member; "Use group again" on screen drops the exception.
 *   5. Library › Team shows Library's groups only, never "Counter staff".
 *   6. Add member from Library gives Library (and their own Money book) only,
 *      in Library's default group.
 * Everything is put back at the end, so other rounds see the business as before.
 *
 *   node e2e/access-groups.mjs
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
const SHOTS = '/tmp/e2e-shots/access-groups';
const MEMBER = { full_name: 'Audit Leaver', mobile: '9700011104', role: 'staff' };
const DESK = { full_name: 'Audit Desk', mobile: '9700011105' };
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
      headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': `access-${Date.now()}-${Math.random()}`, ...(init.headers ?? {}) },
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
const fits = async (page, tag, what) => {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag}: ${what} — nothing runs off the screen (${wide}px)`);
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll('[role=dialog] span, [role=dialog] button, [data-testid=access-groups] span')]
      .filter((n) => n.children.length === 0 && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow === 'ellipsis')
      .map((n) => n.textContent.trim()).filter(Boolean));
  check(cut.length === 0, `${tag}: ${what} — no text cut (${cut.join(' | ')})`);
};

// ── setup: a clean business ─────────────────────────────────────────────────
const owner = await ownerIn(1280);
const me = (await owner.api('auth/me')).body?.data;
const BUSINESS = me.tenants.find((t) => t.id === me.active_tenant_id)?.name;
const running = (me.apps ?? []).map((a) => a.code);
const clean = async () => {
  for (const app of ['shop', 'library']) {
    const rows = (await owner.api(`members?page_size=100&app=${app}`)).body?.data ?? [];
    for (const r of rows) if (r.access?.group_id || r.access?.changes) await owner.api(`members/${r.id}/access?app=${app}`, { method: 'PUT', data: { group_id: null, exceptions: {} } });
    for (const g of (await owner.api(`access-groups?app=${app}`)).body?.data?.groups ?? []) await owner.api(`access-groups/${g.id}`, { method: 'DELETE' });
  }
};
await clean();
const findBy = async (mobile) => ((await owner.api('members?page_size=100')).body?.data ?? []).find((m) => (m.mobile ?? '').endsWith(mobile));
if (!(await findBy(MEMBER.mobile))) await owner.api('members', { method: 'POST', data: MEMBER });
const member = await findBy(MEMBER.mobile);
const allApps = async () => owner.api(`members/${member.id}/apps`, { method: 'PUT', data: { grants: running.map((app) => ({ app, role: 'staff' })) } });
check((await allApps()).status === 200, `setup: ${MEMBER.full_name} in ${running.join(', ')}, no group`);

for (const width of [390, 1280]) {
  const tag = `${width}`;
  if (width === 1280) {
    await clean();
    await allApps();
  }
  const o = await ownerIn(width);
  await o.api('auth/switch-app', { method: 'POST', data: { app: 'shop' } });

  // 1. The groups tab, empty, then the example made on screen.
  await o.page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  const text = (await o.page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(text.includes(`Business · ${BUSINESS}`), `${tag}: Team says "Business · ${BUSINESS}"`);
  await o.page.getByRole('tab', { name: 'Access groups' }).click();
  await o.page.getByText('No groups for Business yet').waitFor({ timeout: 10000 });
  await o.page.screenshot({ path: `${SHOTS}/${width}-1-empty.png` });
  await o.page.getByTestId('access-group-example').click();
  const drawer = o.page.getByTestId('access-group-form');
  await drawer.waitFor();
  check((await o.page.getByTestId('access-group-name').inputValue()) === 'Counter staff', `${tag}: the form starts from the example "Counter staff"`);
  const levelOf = async (part) => drawer.getByTestId(`part-${part}`).getByRole('button', { pressed: true }).innerText();
  check((await levelOf('purchases')) === 'Off' && (await levelOf('stock')) === 'View only' && (await levelOf('sales')) === 'Full', `${tag}: example levels — Sales Full, Stock View only, Purchases Off`);
  const heights = await drawer.locator('[data-testid^=part-] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check(Math.min(...heights) >= (width < 768 ? 32 : 28), `${tag}: level buttons are ${Math.min(...heights)}px or taller`);
  await drawer.getByRole('switch', { name: /Default group/ }).click();
  await fits(o.page, tag, 'group form');
  await o.page.screenshot({ path: `${SHOTS}/${width}-2-group-form.png` });
  await o.page.getByTestId('access-group-save').click();
  await drawer.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await o.page.getByTestId('access-groups').getByText('Counter staff').first().waitFor({ timeout: 10000 }).catch(() => {});
  const groups = (await o.api('access-groups?app=shop')).body?.data?.groups ?? [];
  const counter = groups.find((g) => g.name === 'Counter staff');
  check(counter?.is_default && counter.levels.purchases === 'off' && counter.levels.stock === 'view' && counter.levels.sales === 'full', `${tag}: read back — Counter staff, default, Purchases off, Stock view`);
  check(counter?.levels.purchases !== 'full', `${tag}: self-test, a skewed level would not match`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-3-groups.png` });
  // Owner, 14 Nov 2026: New group floats at the bottom right on a phone.
  const fab = o.page.getByRole('button', { name: 'New group' }).filter({ visible: true });
  const box = await fab.first().boundingBox();
  const vp = o.page.viewportSize();
  if (o.phone) check((await fab.count()) === 1 && box && box.x + box.width > vp.width - 40 && box.y + box.height > vp.height - 160 && box.height >= 44, `${tag}: New group floats at the bottom right (${Math.round(box?.x ?? 0)},${Math.round(box?.y ?? 0)}, ${Math.round(box?.height ?? 0)}px)`);
  else check((await fab.count()) === 1 && box && box.y < 400, `${tag}: desktop keeps New group above the list`);

  // 2. Put the member in it, on screen.
  await o.page.getByRole('tab', { name: 'Members' }).click();
  await o.page.getByRole('button', { name: `Actions for ${MEMBER.full_name}` }).first().click();
  await o.page.getByRole('dialog', { name: MEMBER.full_name }).getByRole('button', { name: /^Access/ }).click();
  const sheet = o.page.getByTestId('member-access');
  await sheet.waitFor();
  await sheet.getByRole('combobox', { name: 'Access group' }).click();
  await o.page.getByRole('option', { name: 'Counter staff' }).click();
  await fits(o.page, tag, 'member access sheet');
  await o.page.screenshot({ path: `${SHOTS}/${width}-4-member-sheet.png` });
  await o.page.getByTestId('member-access-save').click();
  await sheet.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  const mine = (await o.api(`members/${member.id}/access?app=shop`)).body?.data;
  check(mine?.group_id === counter?.id && mine?.changes === 0, `${tag}: read back — ${MEMBER.full_name} is in Counter staff, no changes`);
  await o.page.getByText('Counter staff').first().waitFor({ timeout: 8000 }).catch(() => {});
  check((await o.page.getByText('Counter staff').count()) > 0, `${tag}: the Members list shows their group`);
  check(o.errors.length === 0, `${tag}: no page error on the owner's side${o.errors.length ? ` (${o.errors[0]})` : ''}`);

  // 3. The member signs in.
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
  const held = async () => new Set((await m.api('auth/me')).body?.data?.permissions ?? []);
  let h = await held();
  check(h.has('sales.invoice.write') && !h.has('purchases.bill.read') && h.has('inventory.stock.read'), `${tag}: the member holds Sales, no Purchases, Stock to look at`);
  check(h.has('library.fee.create') && h.has('lending.collection.create'), `${tag}: Library and Ledger are untouched`);
  check((await m.api('sales/invoices')).status === 200 && (await m.api('purchases/bills')).status === 403, `${tag}: the server answers bills and refuses purchases`);
  check(((await m.api('auth/me')).body?.data?.apps ?? []).length === running.length, `${tag}: still every app, not signed out of anything`);
  if (!m.phone) {
    await m.api('auth/switch-app', { method: 'POST', data: { app: 'shop' } });
    await m.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    const links = await m.page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => new URL(a.href).pathname));
    check(!links.includes('/purchases/bills') && links.includes('/sales/invoices'), `${tag}: the member's menu has Bills and no Purchases`);
    await m.page.screenshot({ path: `${SHOTS}/${width}-5-member-menu.png` });
  }

  // 4. An exception and a group change reach the member.
  await o.api(`members/${member.id}/access?app=shop`, { method: 'PUT', data: { group_id: counter.id, exceptions: { purchases: 'view' } } });
  await m.api('auth/refresh', { method: 'POST' });
  h = await held();
  check(h.has('purchases.bill.read') && !h.has('purchases.bill.write'), `${tag}: an exception (Purchases view only) reaches the member`);
  await o.api(`access-groups/${counter.id}`, { method: 'PATCH', data: { levels: { ...counter.levels, expenses: 'view' } } });
  await m.api('auth/refresh', { method: 'POST' });
  h = await held();
  check(h.has('expenses.expense.read') && !h.has('expenses.expense.write'), `${tag}: changing the group (Expenses view only) reaches the member`);
  await o.page.reload({ waitUntil: 'networkidle' });
  await o.page.getByText('1 change from the group').first().waitFor({ timeout: 8000 }).catch(() => {});
  check((await o.page.getByText('1 change from the group').count()) > 0, `${tag}: the Members list says "1 change from the group"`);
  await o.page.getByRole('button', { name: `Actions for ${MEMBER.full_name}` }).first().click();
  await o.page.getByRole('dialog', { name: MEMBER.full_name }).getByRole('button', { name: /^Access/ }).click();
  await o.page.getByTestId('member-access-changes').waitFor();
  await o.page.screenshot({ path: `${SHOTS}/${width}-6-exception.png` });
  await o.page.getByRole('button', { name: 'Use group again' }).click();
  await o.page.getByTestId('member-access-save').click();
  await o.page.getByTestId('member-access').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  check(((await o.api(`members/${member.id}/access?app=shop`)).body?.data?.changes ?? -1) === 0, `${tag}: "Use group again" on screen drops the exception`);
  check(m.errors.length === 0, `${tag}: no page error on the member's side${m.errors.length ? ` (${m.errors[0]})` : ''}`);
  await m.ctx.close();

  // 5. Library's Team is Library's own.
  await o.api('auth/switch-app', { method: 'POST', data: { app: 'library' } });
  await o.page.goto(`${base}/library`, { waitUntil: 'networkidle' });
  await o.page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  const libText = (await o.page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(libText.includes(`Library · ${BUSINESS}`), `${tag}: Team in Library says "Library · ${BUSINESS}"`);
  await o.page.getByRole('tab', { name: 'Access groups' }).click();
  await o.page.getByText('No groups for Library yet').waitFor({ timeout: 10000 }).catch(() => {});
  check((await o.page.getByText('Counter staff').count()) === 0 && (await o.page.getByText('No groups for Library yet').count()) === 1, `${tag}: Library shows its own groups, not Business's`);
  await o.page.screenshot({ path: `${SHOTS}/${width}-7-library.png` });

  // 6. Add member from Library, in Library's default group.
  const desk = await o.api('access-groups', { method: 'POST', data: { app: 'library', name: 'Library desk', is_default: true, levels: { library_fees: 'off' } } });
  const old = await findBy(DESK.mobile);
  if (old) await o.api(`members/${old.id}/remove`, { method: 'POST' });
  await o.page.getByRole('tab', { name: 'Members' }).click();
  await o.page.getByRole('button', { name: 'Add member' }).first().click();
  const add = o.page.getByRole('dialog');
  // Groups arrive first, then the owner types: what is typed must stay.
  await add.getByText('Library desk (default)').first().waitFor({ timeout: 8000 }).catch(() => {});
  await add.getByLabel(/Full name/).fill(DESK.full_name);
  await add.locator('input[type=tel]').fill(DESK.mobile);
  check((await add.getByText('Library desk (default)').count()) > 0, `${tag}: Add member has Library's default group chosen`);
  check(/This gives them Library at/.test(await add.innerText()), `${tag}: Add member says it gives Library here only`);
  await fits(o.page, tag, 'Add member');
  await o.page.screenshot({ path: `${SHOTS}/${width}-8-add-member.png` });
  check((await add.getByLabel(/Full name/).inputValue()) === DESK.full_name, `${tag}: what the owner typed is still there`);
  await add.getByRole('button', { name: 'Add to team' }).click();
  await o.page.waitForTimeout(1500);
  const added = await findBy(DESK.mobile);
  const opens = (await o.api(`members/${added?.id}/apps`)).body?.data?.opens ?? [];
  check(JSON.stringify([...opens].sort()) === JSON.stringify(running.includes('khata') ? ['khata', 'library'] : ['library']), `${tag}: read back — the new member opens ${opens.join(', ')} only`);
  check((await o.api(`members/${added?.id}/access?app=library`)).body?.data?.group_id === desk.body?.data?.id, `${tag}: in Library desk`);
  check(o.errors.length === 0, `${tag}: no page error on the owner's side`);
  await o.ctx.close();
}

await clean();
await allApps();
const gone = await findBy(DESK.mobile);
if (gone) await owner.api(`members/${gone.id}/remove`, { method: 'POST' });
check(((await owner.api('access-groups?app=shop')).body?.data?.groups ?? []).length === 0, 'cleanup: no groups left, every member back to everything their role allows');
await owner.ctx.close();
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
