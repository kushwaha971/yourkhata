/**
 * Settings and Your profile — the edge-case catalogue (docs/testing/edge-case-
 * catalogue.md), as the owner at 390 and 1280, on the live stack:
 *   E26 Your profile opens with nothing red before any Save;
 *   E1  a double tap on Save sends ONE save;
 *   E15 an empty name is refused with the reason, and nothing is sent;
 *   E7  a 200-letter name is stopped at the limit (the box holds 120);
 *   E17 a long Hindi + emoji name saves and nothing runs off the screen or is cut;
 *   E2  after a save, reload and Back keep it; an unsaved draft is not saved;
 *   E4  offline, Save says so and nothing changes on the server;
 *   E5  two tabs: the terms line saved in one, the other is told and not lost;
 *   E18 time to content of /settings and /settings/me.
 * Every change is read back from /auth/me or the settings, then restored.
 *
 *   node e2e/settings-edges.mjs
 */
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });

const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
};
const csrf = async (ctx) => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
const meName = async (ctx) => (await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data?.user?.full_name;
const setName = async (ctx, name) => ctx.request.patch(`${base}/api/v1/auth/me`, { headers: { 'X-CSRF-Token': await csrf(ctx) }, data: { full_name: name } });

for (const width of [390, 1280]) {
  const tag = `owner ${width}`;
  const phone = width < 768;
  const ctx = await b.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await signIn(ctx);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const original = await meName(ctx);
  const patches = [];
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().endsWith('/api/v1/auth/me')) patches.push(r.url()); });

  // E18 — time to content.
  for (const path of ['/settings', '/settings/me']) {
    const t0 = Date.now();
    await page.goto(`${base}${path}`);
    await page.locator(path === '/settings' ? 'text=Your profile' : 'input[name=fullName]').first().waitFor();
    const ms = Date.now() - t0;
    check(ms < 3000, `${tag} E18: ${path} shows its content in ${ms} ms (< 3000)`);
  }

  // E26 — nothing red on opening.
  await page.waitForTimeout(500);
  check((await page.locator('[aria-invalid=true]').count()) === 0, `${tag} E26: Your profile opens with no field marked wrong`);

  const name = page.locator('input[name=fullName]');
  const save = page.getByRole('button', { name: 'Save' }).first();

  // E15 — empty name.
  await name.fill('');
  patches.length = 0;
  await save.click();
  await page.waitForTimeout(500);
  check(await page.getByText('Enter your name.').isVisible(), `${tag} E15: an empty name says "Enter your name."`);
  check(patches.length === 0, `${tag} E15: nothing sent for an empty name (${patches.length})`);

  // E7 — too long.
  await name.fill('क'.repeat(200));
  const held = (await name.inputValue()).length;
  check(held <= 120, `${tag} E7: the name box holds at most 120 letters (${held})`);

  // E1 + E17 — a long Hindi + emoji name, Save tapped twice.
  const longName = `रामेश्वर प्रसाद शर्मा 🙏 ${'किराना '.repeat(12)}`.slice(0, 118).trim();
  await name.fill(longName);
  patches.length = 0;
  await save.dblclick();
  await page.waitForTimeout(1500);
  check(patches.length === 1, `${tag} E1: a double tap on Save sent ${patches.length} save(s)`);
  const saved = await meName(ctx);
  check(saved === longName.replace(/\s+/g, ' ').trim(), `${tag} E17: the Hindi + emoji name read back`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, `${tag} E17: nothing runs off the screen (${wide}px)`);
  await page.goto(`${base}/settings`);
  await page.locator('text=Your profile').first().waitFor();
  const wide2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide2 <= 0, `${tag} E17: the Settings list with that name fits (${wide2}px)`);
  await page.screenshot({ path: `/tmp/e2e-shots/settings-edges-${width}-longname.png`, fullPage: true });

  // E2 — reload and Back keep a save; an unsaved draft is not saved.
  await page.goto(`${base}/settings/me`);
  await name.waitFor();
  await page.reload();
  await name.waitFor();
  check((await name.inputValue()) === saved, `${tag} E2: after reload the saved name is shown`);
  await name.fill('Not saved draft');
  await page.goBack();
  await page.waitForTimeout(800);
  check((await meName(ctx)) === saved, `${tag} E2: leaving with an unsaved draft saves nothing`);

  // E4 — offline.
  await page.goto(`${base}/settings/me`);
  await name.waitFor();
  await name.fill('Offline try');
  await ctx.setOffline(true);
  await save.click();
  await page.waitForTimeout(1500);
  const told = await page.getByText(/offline|no internet|could not save|connection/i).count();
  await ctx.setOffline(false);
  check(told > 0, `${tag} E4: offline, the screen says the save did not go through`);
  check((await meName(ctx)) === saved, `${tag} E4: nothing changed on the server while offline`);

  // E5 — two tabs on Bills and print's terms line.
  const settingsNow = async () => (await (await ctx.request.get(`${base}/api/v1/tenants/current/settings`)).json()).data?.values ?? {};
  const termsBefore = (await settingsNow())['documents.terms']?.text ?? '';
  const a = await ctx.newPage();
  const bTab = await ctx.newPage();
  await a.goto(`${base}/settings/branding`);
  await bTab.goto(`${base}/settings/branding`);
  await a.locator('#bill-terms').waitFor();
  await bTab.locator('#bill-terms').waitFor();
  await a.locator('#bill-terms').fill('Tab A terms');
  await a.getByRole('button', { name: 'Save', exact: true }).last().click();
  await a.waitForTimeout(1200);
  await bTab.locator('#bill-terms').fill('Tab B terms');
  await bTab.getByRole('button', { name: 'Save', exact: true }).last().click();
  await bTab.waitForTimeout(1500);
  const after = (await settingsNow())['documents.terms']?.text;
  const bTold = await bTab.getByText(/changed elsewhere/i).count();
  check(after === 'Tab A terms', `${tag} E5: the first tab's save is kept (server: "${after}")`);
  check(bTold > 0, `${tag} E5: the second tab is told its save was refused because Settings changed elsewhere (${bTold})`);
  check(after !== '' , `${tag} E5: neither save was lost into nothing`);
  await ctx.request.put(`${base}/api/v1/tenants/current/settings`, { headers: { 'X-CSRF-Token': await csrf(ctx), 'If-Match': (await (await ctx.request.get(`${base}/api/v1/tenants/current/settings`)).json()).data?.etag ?? '*' }, data: { values: { 'documents.terms': { text: termsBefore } } } });
  check(((await settingsNow())['documents.terms']?.text ?? '') === termsBefore, `${tag} E5: terms line put back`);
  await a.close();
  await bTab.close();

  await setName(ctx, original);
  check((await meName(ctx)) === original, `${tag}: the owner's name put back`);
  check(errors.length === 0, `${tag}: no page error ${errors.join(' | ')}`);
  await ctx.close();
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
