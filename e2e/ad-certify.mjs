// A–D certification (owner, 31 Oct 2026): roles × businesses, isolation,
// settings, switching and the two-tab race, on the live stack, against the
// isolated QA businesses of e2e/fixtures/ad_cert_people.py. Every check reads
// the SERVER (status codes, records by id), and the screen where it matters.
//
//   R  roles in QA Kirana — Owner, Admin, Staff, Accountant: what each may do
//      (API: create item, adjust stock, void a bill, see cost, settings,
//      team) and what the sidebar and a typed URL show
//   M  mixed roles — qa-mixed is Staff in QA Kirana and Owner of QA Mobile;
//      switching swaps permissions both ways and nothing carries over
//   I  isolation — a QA Medical item, customer and bill are invisible and
//      untouchable from QA Kirana (404 by id, absent from lists); a member of
//      one business cannot switch into another
//   K  kinds — Medical has Expiry and its words, Mobile has Find by IMEI,
//      Kirana has neither; nobody has jewellery features
//   C  role change — the owner makes qa-staff an Admin: the next request has
//      the new powers in QA Kirana only; back to Staff, they are gone
//   T  two tabs — a bill draft open in QA Kirana while another tab switches to
//      QA Medical: the save is refused (409), never written to the wrong book
//   S  session — signed out mid-draft, a save is refused and /login asks again
//
//   node e2e/ad-certify.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/ad-certify';
mkdirSync(dir, { recursive: true });
const PASSWORD = 'AdCert-Test-2026!';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

/** A signed-in person: their own browser context, API helpers that send what the app sends. */
const login = async (who, viewport = { width: 1280, height: 900 }) => {
  const ctx = await browser.newContext({ viewport, ...(viewport.width < 768 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', `${who}@adcert.test`);
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const call = async (method, path, data, extra = {}, retried = false) => {
    const r = await ctx.request.fetch(`${base}/api/v1${path}`, {
      method,
      data,
      headers: { 'X-CSRF-Token': await csrf(), ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}), ...extra },
    });
    // As the app's transport does: a 401 refreshes the session once and retries
    // (a role change re-issues the access token; that is how it takes effect).
    if (r.status() === 401 && !retried && !path.startsWith('/auth/')) {
      const refreshed = await ctx.request.post(`${base}/api/v1/auth/refresh`, { headers: { 'X-CSRF-Token': await csrf() } });
      if (refreshed.ok()) return call(method, path, data, extra, true);
    }
    let body = null;
    try { body = await r.json(); } catch { /* not JSON */ }
    return { status: r.status(), body, data: body?.data };
  };
  const me = async () => (await call('GET', '/auth/me')).data;
  const switchTo = async (name) => {
    const m = await me();
    const t = (m.tenants ?? []).find((x) => x.name === name);
    if (!t) return { status: 0 };
    return call('POST', '/auth/switch-tenant', { tenant_id: t.id });
  };
  return { ctx, page, call, me, switchTo };
};
const nosUnit = async (p) => (await p.call('GET', '/units')).data.find((u) => u.code === 'NOS');
const sidebar = async (page) =>
  (await page.locator('aside nav, nav[aria-label]').first().innerText().catch(() => '')).replace(/\s+/g, ' ');

// ── set-up: the owner, in QA Kirana; a stock item and an issued bill there ──
const owner = await login('qa-owner');
await owner.switchTo('QA Kirana');
const kNos = await nosUnit(owner);
const kItem = (await owner.call('POST', '/items', { name: `AD rice ${tag}`, unit_id: kNos.id, selling_price: '60', purchase_price: '45', opening_stock: { qty: '40', unit_cost: '45' } })).data;
const kDraft = (await owner.call('POST', '/sales/invoices', { lines: [{ item_id: kItem.id, qty: '1' }] })).data;
const kBill = (await owner.call('POST', `/sales/invoices/${kDraft.id}/issue`, { version: kDraft.version, payment: { mode_breakup: [{ mode: 'cash', amount: kDraft.grand_total }] } })).data;
check('set-up: QA Kirana has an item and an issued bill', !!kItem?.id && kBill?.status === 'paid', `${kItem?.id} · ${kBill?.status}`);

// ── R: roles in QA Kirana ──
// Expected from the role matrix (apps/common/permissions_registry.py):
//   item write, stock adjust, bill void, cost: owner/admin yes; staff/acct no
//   cost (reports.financial.read): owner/admin/acct yes; staff no
//   bills: owner/admin/staff write; acct read only
//   team (platform.members.manage): owner/admin; settings write: owner only
const ROLES = {
  'qa-owner': { item: true, adjust: true, void: true, cost: true, bill: true, team: true },
  'qa-admin': { item: true, adjust: true, void: true, cost: true, bill: true, team: true },
  'qa-staff': { item: false, adjust: false, void: false, cost: false, bill: true, team: false },
  'qa-acct': { item: false, adjust: false, void: false, cost: true, bill: false, team: false },
};
const roleSessions = {};
for (const [who, may] of Object.entries(ROLES)) {
  const p = who === 'qa-owner' ? owner : await login(who);
  roleSessions[who] = p;
  const m = await p.me();
  check(`R ${who}: signed in to QA Kirana`, m?.active_tenant?.name === 'QA Kirana', m?.active_tenant?.name);
  const itemTry = await p.call('POST', '/items', { name: `AD ${who} item ${tag}`, unit_id: kNos.id, selling_price: '10' });
  check(`R ${who}: create an item → ${may.item ? 'allowed' : 'refused'}`, may.item ? itemTry.status === 201 : itemTry.status === 403, String(itemTry.status));
  const adj = await p.call('POST', '/stock-adjustments', { reason: 'other', note: 'AD role test', lines: [{ item_id: kItem.id, qty: '0.000', unit_cost: '45' }] });
  check(`R ${who}: adjust stock → ${may.adjust ? 'not refused for permission' : 'refused (403)'}`, may.adjust ? adj.status !== 403 : adj.status === 403, String(adj.status));
  const draftTry = await p.call('POST', '/sales/invoices', { lines: [{ item_id: kItem.id, qty: '1' }] });
  check(`R ${who}: start a bill → ${may.bill ? 'allowed' : 'refused'}`, may.bill ? draftTry.status === 201 : draftTry.status === 403, String(draftTry.status));
  if (draftTry.data?.id) await p.call('DELETE', `/sales/invoices/${draftTry.data.id}`);
  const voidTry = await p.call('POST', `/sales/invoices/${kBill.id}/void`, { reason: 'AD role probe that must not land', version: -1 });
  // A permitted void with a wrong version answers 409/400 — never 403; a refused one answers 403.
  check(`R ${who}: void a bill → ${may.void ? 'permitted' : 'refused (403)'}`, may.void ? voidTry.status !== 403 : voidTry.status === 403, String(voidTry.status));
  const item = (await p.call('GET', `/items/${kItem.id}`)).data;
  const seesCost = item && 'purchase_price' in item && item.purchase_price !== null && item.purchase_price !== undefined;
  check(`R ${who}: cost price ${may.cost ? 'shown' : 'hidden'}`, seesCost === may.cost, JSON.stringify(item && item.purchase_price));
  const team = await p.call('GET', '/members');
  check(`R ${who}: team list → ${may.team ? 'allowed' : 'refused'}`, may.team ? team.status === 200 : team.status === 403, String(team.status));
  const settings = await p.call('PUT', '/tenants/current/settings', { values: { 'sales.default_due_days': { days: 7 } } });
  check(`R ${who}: change business settings → ${who === 'qa-owner' || who === 'qa-admin' ? 'not refused' : 'refused (403)'}`, who === 'qa-owner' || who === 'qa-admin' ? settings.status !== 403 : settings.status === 403, String(settings.status));
  // Screen: the sidebar and a typed URL.
  await p.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  const nav = await sidebar(p.page);
  check(`R ${who}: sidebar ${may.team ? 'shows' : 'hides'} Settings`, nav.includes('Settings') === may.team || (!may.team && !nav.includes('Team')), nav.slice(0, 120));
  await p.page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  await sleep(800);
  const teamPage = await p.page.locator('main').innerText().catch(() => '');
  const blocked = !/Add staff|Add member|qa-admin@adcert\.test|Qa Admin/.test(teamPage);
  check(`R ${who}: typing /settings/team ${may.team ? 'opens it' : 'shows nothing of the team'}`, may.team ? !blocked : blocked, teamPage.slice(0, 100).replace(/\n/g, ' / '));
  await p.page.screenshot({ path: `${dir}/R-${who}-team.png` });
}

// ── M: mixed roles ──
const mixed = await login('qa-mixed');
await mixed.switchTo('QA Kirana');
let mm = await mixed.me();
const kTry = await mixed.call('POST', '/items', { name: `AD mixed K ${tag}`, unit_id: kNos.id, selling_price: '10' });
check('M qa-mixed in QA Kirana (Staff): create item refused', mm.active_tenant?.name === 'QA Kirana' && kTry.status === 403, `${mm.active_tenant?.name} · ${kTry.status}`);
const sw = await mixed.switchTo('QA Mobile');
mm = await mixed.me();
const mNos = await nosUnit(mixed);
const mTry = await mixed.call('POST', '/items', { name: `AD mixed M ${tag}`, unit_id: mNos.id, selling_price: '10' });
check('M qa-mixed switches to QA Mobile (Owner): create item allowed', sw.status === 200 && mm.active_tenant?.name === 'QA Mobile' && mTry.status === 201, `${sw.status} · ${mm.active_tenant?.name} · ${mTry.status}`);
const mTeam = await mixed.call('GET', '/members');
check('M qa-mixed as Owner of QA Mobile: team list allowed', mTeam.status === 200, String(mTeam.status));
await mixed.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
const mNav = await sidebar(mixed.page);
await mixed.switchTo('QA Kirana');
const kTry2 = await mixed.call('POST', '/items', { name: `AD mixed K2 ${tag}`, unit_id: kNos.id, selling_price: '10' });
const kTeam2 = await mixed.call('GET', '/members');
check('M back in QA Kirana: Owner powers did not carry over (item 403, team 403)', kTry2.status === 403 && kTeam2.status === 403, `${kTry2.status} · ${kTeam2.status}`);
await mixed.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
const kNav = await sidebar(mixed.page);
check('M the sidebar follows the business (QA Mobile ≠ QA Kirana for qa-mixed)', mNav !== kNav, `${mNav.slice(0, 60)} | ${kNav.slice(0, 60)}`);
const mItemFromK = await mixed.call('GET', `/items/${mTry.data?.id}`);
check('I QA Mobile item is 404 from QA Kirana (same person, other business)', mTry.data?.id && mItemFromK.status === 404, String(mItemFromK.status));

// ── I: isolation ──
await owner.switchTo('QA Medical');
const dNos = await nosUnit(owner);
const dItem = (await owner.call('POST', '/items', { name: `AD Dolo ${tag}`, unit_id: dNos.id, selling_price: '30', opening_stock: { qty: '10', unit_cost: '20' } })).data;
const dParty = (await owner.call('POST', '/parties', { name: `AD Patient ${tag}`, type: 'customer', mobile: `97${tag}55`.slice(0, 10) })).data;
const dDraft = (await owner.call('POST', '/sales/invoices', { party_id: dParty?.id, lines: [{ item_id: dItem.id, qty: '1' }] })).data;
check('set-up: QA Medical has an item, a customer and a bill draft', !!dItem?.id && !!dParty?.id && !!dDraft?.id);
await owner.switchTo('QA Kirana');
const probes = [
  ['item', `/items/${dItem.id}`],
  ['customer', `/parties/${dParty?.id}`],
  ['bill', `/sales/invoices/${dDraft?.id}`],
];
for (const [what, path] of probes) {
  const r = await owner.call('GET', path);
  check(`I the QA Medical ${what} is 404 from QA Kirana`, r.status === (skew ? 200 : 404), String(r.status));
}
const patch = await owner.call('PATCH', `/items/${dItem.id}`, { selling_price: '1', version: 1 });
check('I editing the QA Medical item from QA Kirana: 404', patch.status === 404, String(patch.status));
const delBill = await owner.call('DELETE', `/sales/invoices/${dDraft?.id}`);
check('I deleting the QA Medical bill draft from QA Kirana: 404', delBill.status === 404, String(delBill.status));
const kList = (await owner.call('GET', `/items?q=${encodeURIComponent(`AD Dolo ${tag}`)}`)).data ?? [];
check('I QA Kirana item search does not find the QA Medical item', kList.length === 0, String(kList.length));
const kParties = (await owner.call('GET', `/parties?q=${encodeURIComponent(`AD Patient ${tag}`)}`)).data ?? [];
check('I QA Kirana customer search does not find the QA Medical customer', kParties.length === 0, String(kParties.length));
const crossLine = await owner.call('POST', '/sales/invoices', { lines: [{ item_id: dItem.id, qty: '1' }] });
check('I a QA Kirana bill cannot use the QA Medical item', crossLine.status >= 400 && crossLine.status < 500, String(crossLine.status));
const crossParty = await owner.call('POST', '/sales/invoices', { party_id: dParty?.id, lines: [{ item_id: kItem.id, qty: '1' }] });
check('I a QA Kirana bill cannot name the QA Medical customer', crossParty.status >= 400 && crossParty.status < 500, String(crossParty.status));
const staff = roleSessions['qa-staff'];
const medicalId = ((await owner.me()).tenants ?? []).find((t) => t.name === 'QA Medical')?.id;
const sneak = await staff.call('POST', '/auth/switch-tenant', { tenant_id: medicalId });
const staffMe = await staff.me();
check('I qa-staff (QA Kirana only) cannot switch into QA Medical', sneak.status >= 400 && staffMe.active_tenant?.name === 'QA Kirana', `${sneak.status} · ${staffMe.active_tenant?.name}`);
check('I qa-staff lists only the business they belong to', (staffMe.tenants ?? []).map((t) => t.name).join(',') === 'QA Kirana', (staffMe.tenants ?? []).map((t) => t.name).join(','));
await staff.page.goto(`${base}/items/${dItem.id}`, { waitUntil: 'networkidle' });
await sleep(800);
const leak = (await staff.page.locator('main').innerText().catch(() => '')).includes(`AD Dolo ${tag}`);
check('I typing the QA Medical item URL as qa-staff shows nothing of it', !leak);

// ── K: kinds ──
const kinds = {};
for (const name of ['QA Kirana', 'QA Medical']) {
  await owner.switchTo(name);
  const m = await owner.me();
  await owner.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  kinds[name] = { features: m.active_tenant?.features ?? [], words: m.active_tenant?.words?.en ?? {}, nav: await sidebar(owner.page) };
}
await mixed.switchTo('QA Mobile');
await mixed.page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
kinds['QA Mobile'] = { features: (await mixed.me()).active_tenant?.features ?? [], nav: await sidebar(mixed.page) };
check('K Medical: Expiry in the menu and batches on', kinds['QA Medical'].nav.includes('Expiry') && kinds['QA Medical'].features.includes('batches'), kinds['QA Medical'].features.join(','));
check('K Medical: its own words (Distributors)', kinds['QA Medical'].words['nav.suppliers'] === 'Distributors', String(kinds['QA Medical'].words['nav.suppliers']));
check('K Kirana: no Expiry, no batches, no IMEI', !kinds['QA Kirana'].nav.includes('Expiry') && !kinds['QA Kirana'].features.includes('batches') && !kinds['QA Kirana'].nav.includes('IMEI'), kinds['QA Kirana'].features.join(','));
check('K Mobile: Find by IMEI in the menu, no Expiry', /IMEI/.test(kinds['QA Mobile'].nav) && !kinds['QA Mobile'].nav.includes('Expiry'), kinds['QA Mobile'].nav.slice(0, 200));
// D3 per kind: the item form's own group, from the screen, read back by API.
for (const [who, biz, group, toggle, extra] of [
  [owner, 'QA Medical', 'item-tracking-batch', 'Track batch and expiry', null],
  [mixed, 'QA Mobile', 'item-tracking-serial', 'Track IMEI / serial', 'Warranty'],
]) {
  await who.switchTo(biz);
  await who.page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await who.page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click();
  const dlg = who.page.getByRole('dialog');
  const name = `AD ${biz} tracked ${tag}`;
  await dlg.getByLabel('Item name').fill(name);
  const grp = who.page.getByTestId(group);
  const shown = await grp.isVisible().catch(() => false);
  await grp.getByText(toggle).click().catch(() => {});
  await sleep(300);
  const openingHidden = !(await dlg.getByLabel('Opening stock').isVisible().catch(() => false));
  if (extra) {
    await grp.getByRole('combobox', { name: extra }).click().catch(() => {});
    await who.page.getByRole('option', { name: '12 months' }).click().catch(() => {});
  }
  await who.page.screenshot({ path: `${dir}/K-${biz.replace(/ /g, '')}-form.png` });
  await dlg.getByRole('button', { name: /^Save( item)?$/ }).last().click();
  await sleep(2500);
  const saved = ((await who.call('GET', `/items?q=${encodeURIComponent(name)}`)).data ?? [])[0];
  const want = group.endsWith('batch') ? 'batch' : 'serial';
  check(`K ${biz}: the item form shows "${toggle}" and saves it (tracking ${want})`, shown && saved?.tracking === want && (!extra || saved?.warranty_months === 12), JSON.stringify(saved && { t: saved.tracking, w: saved.warranty_months }));
  check(`K ${biz}: a tracked item hides Opening stock (it comes through a purchase)`, openingHidden);
}
await owner.switchTo('QA Kirana');
await owner.page.goto(`${base}/items`, { waitUntil: 'networkidle' });
await owner.page.getByRole('button', { name: /^(Add item|New item)$/ }).first().click();
await sleep(600);
check('K QA Kirana: the item form has neither group', !(await owner.page.getByTestId('item-tracking-batch').isVisible().catch(() => false)) && !(await owner.page.getByTestId('item-tracking-serial').isVisible().catch(() => false)));
await owner.page.keyboard.press('Escape');
check('K nobody has jewellery screens (G is not built)', Object.values(kinds).every((k) => !/Today's rate|Old gold|Karigar/i.test(k.nav)));

// ── C: role change takes effect at once, in one business only ──
await owner.switchTo('QA Kirana');
const members = (await owner.call('GET', '/members')).data ?? [];
const staffRow = members.find((x) => (x.user?.email ?? x.email) === 'qa-staff@adcert.test');
const up = await owner.call('PATCH', `/members/${staffRow?.id}`, { role: 'admin' });
const afterUp = await staff.call('POST', '/items', { name: `AD promoted ${tag}`, unit_id: kNos.id, selling_price: '10' });
check('C owner makes qa-staff an Admin: their next request may create an item', up.status === 200 && afterUp.status === 201, `${up.status} · ${afterUp.status}`);
const down = await owner.call('PATCH', `/members/${staffRow?.id}`, { role: 'staff' });
const afterDown = await staff.call('POST', '/items', { name: `AD demoted ${tag}`, unit_id: kNos.id, selling_price: '10' });
check('C back to Staff: refused again at once', down.status === 200 && afterDown.status === 403, `${down.status} · ${afterDown.status}`);
await mixed.switchTo('QA Mobile');
const mStill = await mixed.call('POST', '/items', { name: `AD mixed M2 ${tag}`, unit_id: mNos.id, selling_price: '10' });
check('C a role change in QA Kirana leaves qa-mixed Owner of QA Mobile', mStill.status === 201, String(mStill.status));

// ── T: two tabs, two businesses ──
{
  await owner.switchTo('QA Kirana');
  const tabA = owner.page;
  await tabA.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const discard = tabA.getByRole('dialog').getByRole('button', { name: 'Discard' });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click();
  await tabA.getByRole('combobox', { name: 'Search items to add' }).fill(`AD rice ${tag}`);
  await tabA.getByRole('option', { name: new RegExp(`AD rice ${tag}`) }).first().click({ timeout: 10000 }).catch(() => {});
  await sleep(600);
  const tabB = await owner.ctx.newPage();
  await tabB.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  const sw2 = await owner.switchTo('QA Medical');
  const responses = [];
  tabA.on('response', (r) => { if (/\/sales\/invoices/.test(r.url()) && r.request().method() !== 'GET') responses.push(r.status()); });
  await tabA.getByRole('button', { name: /^Save draft$/ }).first().click().catch(() => {});
  await sleep(3000);
  const medDrafts = ((await owner.call('GET', `/sales/invoices?status=draft&page_size=50`)).data ?? []).filter((d) => (d.lines_preview ?? d.description ?? '').includes?.(`AD rice ${tag}`));
  const medHasRice = (await Promise.all(((await owner.call('GET', `/sales/invoices?status=draft&page_size=20`)).data ?? []).map(async (d) => (await owner.call('GET', `/sales/invoices/${d.id}`)).data))).some((d) => (d?.lines ?? []).some((l) => l.item_id === kItem.id));
  check('T a QA Kirana draft saved after another tab switched to QA Medical is NOT written to QA Medical', sw2.status === 200 && !medHasRice && medDrafts.length === 0, `switch ${sw2.status} · writes ${responses.join(',') || 'none'}`);
  check('T and the stale tab is told (409 tenant_context_changed, or no write sent)', responses.every((s) => s === 409) , responses.join(',') || 'no write');
  await tabA.screenshot({ path: `${dir}/T-stale-tab.png` });
  await tabB.close();
  await owner.switchTo('QA Kirana');
}

// ── S: session ends mid-draft ──
{
  const p = await login('qa-admin');
  await p.page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  await p.ctx.clearCookies();
  const r = await p.ctx.request.post(`${base}/api/v1/sales/invoices`, { data: { lines: [] }, headers: { 'Idempotency-Key': randomUUID() } });
  check('S signed out: a write is refused (401/403)', r.status() === 401 || r.status() === 403, String(r.status()));
  await p.page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  check('S signed out: the bill screen sends you to sign in', /\/login/.test(p.page.url()), p.page.url());
  await p.ctx.close();
}

for (const p of Object.values(roleSessions)) await p.ctx.close().catch(() => {});
await mixed.ctx.close();
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('failed:\n' + failed.map((f) => `  - ${f.name}`).join('\n'));
process.exitCode = failed.length ? 1 : 0;
