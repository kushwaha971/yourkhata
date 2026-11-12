/**
 * Adding staff confirms their number with a code (owner, 12 Nov 2026), on the
 * live stack at 390 and 1280: Add to team stays off until the code is in; the
 * code the server sent (read from the console provider's API log) adds the
 * member; a wrong code does not; the member is read back from GET /members.
 *
 *   API_LOG=/tmp/api.log node e2e/staff-code.mjs --shots=/tmp/e2e-shots/staff-code
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/staff-code');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const LOG = process.env.API_LOG ?? '/tmp/api.log';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const logSize = () => { try { return readFileSync(LOG, 'utf8').length; } catch { return 0; } };
const codeFromLog = async (last3, from) => {
  for (let i = 0; i < 20; i += 1) {
    let log = '';
    try { log = readFileSync(LOG, 'utf8').slice(from); } catch { /* not yet */ }
    const hits = [...log.matchAll(/to=\+91…(\d{3}) body=(\d{4,6})/g)].filter((m) => m[1] === last3);
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 1280]) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const national = `7${String(Date.now()).slice(-9)}`;
  const name = `Staff ${national.slice(-4)}`;
  await page.goto(`${base}/settings/team`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add member/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Full name/i).fill(name);
  await dialog.getByLabel(/Mobile number/i).first().fill(national);
  const add = dialog.getByRole('button', { name: /Add to team/i });
  check(await add.isDisabled(), `${width}: Add to team is off before any code`);

  let from = logSize();
  await dialog.getByRole('button', { name: /Send code to this number/i }).click();
  await dialog.getByText(/Code sent/).waitFor();
  const code = await codeFromLog(national.slice(-3), from);
  check(Boolean(code), `${width}: a code was sent to the new number (${code ? 'read from the API log' : 'none found'})`);
  await page.screenshot({ path: `${SHOTS}/${width}-1-code-sent.png` });

  // A wrong code: the member is not added.
  const boxes = dialog.getByRole('group', { name: /Code from their phone/i }).locator('input');
  await boxes.first().click();
  await page.keyboard.type(code === '0000' ? '1111' : '0000');
  check(await add.isEnabled(), `${width}: Add to team turns on with four digits`);
  await add.click();
  await page.waitForTimeout(1200);
  let members = (await (await ctx.request.get(`${base}/api/v1/members?page_size=200`)).json()).data ?? [];
  check(!members.some((m) => m.full_name === name), `${width}: a wrong code adds nobody`);
  await page.screenshot({ path: `${SHOTS}/${width}-2-wrong-code.png` });

  // The real code (a fresh one, as the wrong guess spent nothing on a refusal? send again to be sure).
  await boxes.first().click();
  await page.keyboard.press('Control+A').catch(() => undefined);
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Backspace');
  await boxes.first().click();
  await page.keyboard.type(code ?? '');
  await add.click();
  await page.waitForTimeout(2000);
  members = (await (await ctx.request.get(`${base}/api/v1/members?page_size=200`)).json()).data ?? [];
  const added = members.find((m) => m.full_name === name);
  check(Boolean(added) && added.mobile === `+91${national}`, `${width}: the right code adds ${name} with +91${national}`);
  await page.screenshot({ path: `${SHOTS}/${width}-3-added.png` });
  check(errors.length === 0, `${width}: no page error${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
