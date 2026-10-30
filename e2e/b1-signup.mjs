// B1 — a real sign-up, read back from the server (R-DEC-63, R-DEC-64).
//
// Signs up a fresh mobile (console OTP from the e2e API's own log), picks a
// shop kind on wizard step 1, finishes the wizard, and reads what the SERVER
// stored: the business type, `shop.wholesale`, and the preset defaults the
// last step seeded (favourite units, credit days). A tile that lights up is
// not a business that was saved, so every check reads the API.
//
//   node e2e/b1-signup.mjs [--skew]      (E2E_BASE, PW_CHROME)
//
// --skew expects deliberately wrong values: every read-back check must FAIL,
// which proves the checks can fail (H17/H27).
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { assertE2eApi } from './lib/local.mjs';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const LOG = `${process.env.UB_E2E_LOGS ?? '/tmp/claude-0'}/be-run.log`;
const skew = process.argv.includes('--skew');
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

const SCENARIOS = [
  // Hardware first (R-DEC-51 #4): its own preset.
  { id: 'hardware', name: 'Patil Hardware', tap: ['hardware'], type: 'hardware', wholesale: false, unitsStart: ['NOS', 'PCS', 'BOX', 'KGS', 'MTR', 'LTR'], due: 15 },
  // Wholesale + Kirana: kirana's units first, then wholesale's bulk ones; 15 days.
  // Other → Agri inputs (R-DEC-66 / G12): batch and expiry on from the kind,
  // the owner adds sizes; the server keeps exactly that.
  { id: 'other-agri', name: 'Patil Krishi Kendra', tap: ['other'], radio: /Agri inputs/, toggle: [/Sizes and colours/], type: 'agri', wholesale: false, unitsStart: ['KGS', 'BAG', 'LTR', 'NOS', 'PAC'], due: 30, features: { service_items: false, alt_units: false, batches: true, variants: true } },
  { id: 'wholesale-kirana', name: 'Patil Traders', tap: ['wholesale', 'kirana'], type: 'kirana', wholesale: true, unitsStart: ['NOS', 'KGS', 'GMS', 'LTR', 'PAC', 'BOX', 'BAG', 'QTL'], due: 15 },
];

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
let serial = Number(String(Date.now()).slice(-5));
for (const sc of SCENARIOS) {
  serial += 1;
  const mobile = `97${String(serial).padStart(8, '0')}`.slice(0, 10);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
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

    await page.getByLabel(/Business name/).fill(sc.name);
    if (await page.getByLabel(/Your name/).count()) await page.getByLabel(/Your name/).fill('Asha Patil');
    await page.getByRole('combobox', { name: /State/ }).click();
    await page.getByPlaceholder(/Search/).fill('Maha');
    await page.getByRole('option', { name: /Maharashtra/ }).click();
    const shop = page.getByRole('checkbox', { name: /^Business/ });
    if ((await shop.count()) && (await shop.getAttribute('aria-checked')) !== 'true') await shop.click();
    // The first tap is in "What do you sell?"; after Wholesale the kind is in
    // the "Wholesale of what?" list below it, which is the LAST grid.
    for (const kind of sc.tap) await page.locator(`[data-kind=${kind}]`).last().click();
    if (sc.radio) await page.getByRole('radio', { name: sc.radio }).click();
    for (const sw of sc.toggle ?? []) await page.getByRole('switch', { name: sw }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/onboarding\/step\/2/, { timeout: 30000 });
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.waitForURL(/\/onboarding\/step\/3/, { timeout: 30000 });
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.waitForURL(/\/onboarding\/step\/4/, { timeout: 30000 });
    await page.getByRole('button', { name: /Start using|Finish/ }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60000 });

    // ── Read back from the server ────────────────────────────────────────────
    const tenant = (await (await ctx.request.get(`${base}/api/v1/tenants/current`)).json()).data;
    const values = (await (await ctx.request.get(`${base}/api/v1/tenants/current/settings`)).json()).data.values;
    const want = skew
      ? { type: 'retail', wholesale: !sc.wholesale, units: ['XXX'], due: 99 }
      : { type: sc.type, wholesale: sc.wholesale, units: sc.unitsStart, due: sc.due };
    check(`${sc.id}: stored business type is ${want.type}`, tenant.business_type === want.type, tenant.business_type);
    check(`${sc.id}: shop.wholesale is ${want.wholesale}`, values['shop.wholesale']?.value === want.wholesale, JSON.stringify(values['shop.wholesale']));
    const units = values['inventory.favourite_units']?.codes ?? [];
    check(`${sc.id}: favourite units are ${want.units.join(',')}`, JSON.stringify(units.slice(0, want.units.length)) === JSON.stringify(want.units), units.join(','));
    check(`${sc.id}: credit days ${want.due}`, values['sales.default_due_days']?.days === want.due, JSON.stringify(values['sales.default_due_days']));
    if (sc.features) {
      const got = Object.fromEntries(Object.keys(sc.features).map((k) => [k, values[`shop.features.${k}`]?.value]));
      const want2 = skew ? Object.fromEntries(Object.entries(sc.features).map(([k, v]) => [k, !v])) : sc.features;
      check(`${sc.id}: features ${JSON.stringify(want2)}`, JSON.stringify(got) === JSON.stringify(want2), JSON.stringify(got));
    }
    check(`${sc.id}: no shop.extra_types (R-DEC-64)`, !skew ? !('shop.extra_types' in values) : 'shop.extra_types' in values);
  } catch (e) {
    check(`${sc.id}: sign-up ran`, false, e.message.slice(0, 200));
    await page.screenshot({ path: `/tmp/e2e-shots/b1/signup-${sc.id}-error.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: every check should FAIL)' : ''}`);
process.exitCode = skew ? (failed === results.length ? 0 : 1) : failed ? 1 : 0;
