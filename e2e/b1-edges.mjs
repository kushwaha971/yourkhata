// B1 — edge cases from docs/testing/edge-case-catalogue.md that apply to
// sign-up step 1, each on a FRESH sign-up (console OTP, e2e API only) and each
// read back from the server:
//   E1  double / triple tap Continue → exactly ONE business for the person
//   E4  offline at Continue → nothing created, a message, then it works online
//   E15 a server refusal shows the server's own reason (forced 400)
//   E17 a 160-char name in Hindi + emoji → saved exactly, no overflow, no cut
//   E18 time from Continue to step 2
//
//   node e2e/b1-edges.mjs [--width=390]   (E2E_BASE, PW_CHROME)
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { assertE2eApi } from './lib/local.mjs';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const width = Number(process.argv.find((a) => a.startsWith('--width='))?.slice(8) ?? 390);
const LOG = `${process.env.UB_E2E_LOGS ?? '/tmp/claude-0'}/be-run.log`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const codeFor = async (mobile, from) => {
  for (let i = 0; i < 40; i += 1) {
    const hits = [...readFileSync(LOG, 'utf8').slice(from).matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits.at(-1)[2];
    await sleep(300);
  }
  throw new Error('no OTP in the e2e API log');
};

await assertE2eApi();
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let serial = Number(String(Date.now()).slice(-5)) + 300;

/** A fresh person on wizard step 1 with the form filled; returns {ctx, page}. */
const freshStep1 = async (name) => {
  serial += 1;
  const mobile = `96${String(serial).padStart(8, '0')}`.slice(0, 10);
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, isMobile: width < 1024, hasTouch: width < 1024 });
  const page = await ctx.newPage();
  await page.goto(`${base}/signup`, { waitUntil: 'networkidle' });
  const field = page.getByLabel(/Mobile number/).first();
  await field.click();
  await field.pressSequentially(mobile);
  const from = readFileSync(LOG, 'utf8').length;
  await page.getByRole('button', { name: /Send code/ }).click();
  await page.getByRole('textbox').first().waitFor();
  await sleep(500);
  await page.getByRole('textbox').first().focus();
  await page.keyboard.type(await codeFor(mobile, from));
  await page.waitForURL(/\/onboarding\/step\/1/, { timeout: 60000 });
  await page.getByLabel(/Business name/).fill(name);
  if (await page.getByLabel(/Your name/).count()) await page.getByLabel(/Your name/).fill('Asha Patil');
  await page.getByRole('combobox', { name: /State/ }).click();
  await page.getByPlaceholder(/Search/).fill('Maha');
  await page.getByRole('option', { name: /Maharashtra/ }).click();
  const shop = page.getByRole('checkbox', { name: /^Shop/ });
  if ((await shop.count()) && (await shop.getAttribute('aria-checked')) !== 'true') await shop.click();
  await page.locator('[data-kind=hardware]').first().click();
  return { ctx, page };
};
const myBusinesses = async (ctx) => ((await (await ctx.request.get(`${base}/api/v1/auth/me`)).json()).data.tenants ?? []);
const cont = (page) => page.getByRole('button', { name: 'Continue' });

// ── E1: triple tap ───────────────────────────────────────────────────────────
{
  const { ctx, page } = await freshStep1('Patil Hardware E1');
  const t0 = Date.now();
  // Three fast taps at the same spot, as a thumb does: the later ones land on
  // whatever is there next, which is step 2's Continue.
  const box = await cont(page).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.click(x, y);
    await sleep(120);
  }
  await page.waitForURL(/\/onboarding\/step\/[2-4]/, { timeout: 30000 });
  const ms = Date.now() - t0;
  await sleep(1500);
  check('E1 extra taps do not skip GST and address (stays on step 2)', /\/onboarding\/step\/2/.test(page.url()), page.url());
  const tenants = await myBusinesses(ctx);
  check('E1 three taps on Continue make ONE business', tenants.length === 1, `${tenants.length} businesses`);
  check('E18 Continue → step 2 under 3 s', ms < 3000, `${ms} ms`);
  await ctx.close();
}

// ── E4: offline at Continue ─────────────────────────────────────────────────
{
  const { ctx, page } = await freshStep1('Patil Hardware E4');
  await ctx.setOffline(true);
  await sleep(2500);
  // Offline, Continue is disabled (the degraded-network guard) and the page
  // says why; a tap does nothing and nothing is sent.
  const disabled = await cont(page).isDisabled();
  await cont(page).click({ force: true, timeout: 2000 }).catch(() => {});
  await sleep(1000);
  const stillOn1 = /\/onboarding\/step\/1/.test(page.url());
  const said = await page.evaluate(() => document.body.innerText.match(/offline|internet|connection|network|try again/i)?.[0] ?? '');
  check('E4 offline: Continue off, stays on step 1, says why', disabled && stillOn1 && Boolean(said), `disabled=${disabled} · ${page.url()} · "${said}"`);
  await ctx.setOffline(false);
  await sleep(1000);
  await cont(page).click();
  await page.waitForURL(/\/onboarding\/step\/2/, { timeout: 30000 }).catch(() => {});
  const tenants = await myBusinesses(ctx);
  check('E4 back online: Continue works, ONE business', /step\/2/.test(page.url()) && tenants.length === 1, `${page.url()} · ${tenants.length}`);
  await ctx.close();
}

// ── E15: the server refuses ─────────────────────────────────────────────────
{
  const { ctx, page } = await freshStep1('Patil Hardware E15');
  const reason = 'This business name is not allowed (test).';
  await page.route('**/api/v1/tenants', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'validation_error', message: reason, details: { name: [reason] } } }) })
      : route.continue()
  );
  await cont(page).click();
  await sleep(1500);
  const shown = await page.evaluate((r) => document.body.innerText.includes(r), reason);
  check('E15 a refusal shows the server\'s own reason', shown && /step\/1/.test(page.url()));
  await page.unroute('**/api/v1/tenants');
  await ctx.close();
}

// ── E17: long Hindi + emoji name ────────────────────────────────────────────
{
  const long = `पाटिल हार्डवेयर एंड पेंट्स 🛠️ ${'बहुत लंबा नाम '.repeat(12)}`.slice(0, 160).trim();
  const { ctx, page } = await freshStep1(long);
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cut: [...document.querySelectorAll('[data-kind] span, button')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length,
  }));
  check('E17 long Hindi + emoji name: no overflow, nothing cut', m.overflow <= 0 && m.cut === 0, JSON.stringify(m));
  await cont(page).click();
  await page.waitForURL(/\/onboarding\/step\/2/, { timeout: 30000 }).catch(() => {});
  const t = (await (await ctx.request.get(`${base}/api/v1/tenants/current`)).json()).data;
  check('E17 the name is saved exactly', t?.name === long, `${t?.name?.length} chars`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed @${width}`);
process.exitCode = failed ? 1 : 0;
