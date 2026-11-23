// A–D certification: one person adds a business of EVERY kind ("Add a
// business", POST /tenants as the wizard sends it, then its last step), and
// each new business is read back from the server and LOOKED at: its own
// features, its own words, its own menu, nothing of another kind; the list of
// businesses grows by one each time; switching lands in the right one.
//
//   node e2e/ad-onboard.mjs   (E2E_BASE, PW_CHROME; e2e/fixtures/ad_cert_people.py first)
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const tag = Date.now().toString().slice(-6);
// kind → what it must have, and what it must not.
const KINDS = {
  kirana: { has: [], hasNav: [], not: ['Expiry', 'Find by IMEI', "Today's rate"] },
  medical: { has: ['batches'], hasNav: ['Expiry'], not: ['Find by IMEI', 'Sales orders'], word: ['nav.suppliers', 'Distributors'] },
  electronics: { has: ['serials', 'orders'], hasNav: ['Find by IMEI', 'Sales orders'], not: ['Expiry'] },
  garments: { has: ['variants'], hasNav: [], not: ['Expiry', 'Find by IMEI'] },
  auto_parts: { has: ['part_numbers', 'orders'], hasNav: ['Sales orders'], not: ['Expiry', 'Find by IMEI'] },
  hardware: { has: ['orders'], hasNav: ['Delivery challans'], not: ['Expiry', 'Find by IMEI'] },
  food: { has: ['addons'], hasNav: [], not: ['Expiry', 'Find by IMEI', 'Sales orders'] },
  jewellery: { has: ['rates'], hasNav: ["Today's rate"], not: ['Expiry', 'Find by IMEI'] },
};

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-owner@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
const api = async (method, path, data) => {
  const r = await ctx.request.fetch(`${base}/api/v1${path}`, { method, data, headers: { 'X-CSRF-Token': await csrf(), 'Idempotency-Key': randomUUID() } });
  let body = null;
  try { body = await r.json(); } catch { /* none */ }
  return { status: r.status(), data: body?.data };
};
const before = ((await api('GET', '/auth/me')).data.tenants ?? []).length;
let count = before;
for (const [kind, want] of Object.entries(KINDS)) {
  const name = `AD ${kind} ${tag}`;
  const made = await api('POST', '/tenants', { name, business_type: kind, state_code: '27', apps: ['shop'] });
  // The wizard's last step seeds the kind's preset and finishes set-up.
  let done = { status: 0 };
  for (const step of [2, 3, 4]) done = await api('PATCH', '/tenants/current', { onboarding_step: step });
  const me = (await api('GET', '/auth/me')).data;
  count += 1;
  check(`${kind}: created and active (${made.status}/${done.status})`, made.status === 201 && me.active_tenant?.name === name, me.active_tenant?.name);
  check(`${kind}: the list of businesses grew by one`, (me.tenants ?? []).length === count, String((me.tenants ?? []).length));
  const features = me.active_tenant?.features ?? [];
  check(`${kind}: its features ${want.has.join(', ') || '(none extra)'}`, want.has.every((f) => features.includes(f)) && (kind !== 'kirana' || !features.some((f) => ['batches', 'serials', 'variants', 'addons', 'part_numbers'].includes(f))), features.join(','));
  if (want.word) check(`${kind}: its own word ${want.word[1]}`, me.active_tenant?.words?.en?.[want.word[0]] === want.word[1], String(me.active_tenant?.words?.en?.[want.word[0]]));
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  const nav = (await page.locator('aside nav, nav[aria-label]').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  check(`${kind}: menu has ${want.hasNav.join(', ') || 'the shared rows'} and not ${want.not.join(', ')}`, want.hasNav.every((x) => nav.includes(x)) && want.not.every((x) => !nav.includes(x)), nav.slice(-200));
  await page.screenshot({ path: `/tmp/e2e-shots/ad-certify/onboard-${kind}.png` });
}
// Switching between two of them keeps each one's own context.
const all = (await api('GET', '/auth/me')).data.tenants ?? [];
const med = all.find((t) => t.name === `AD medical ${tag}`);
const mob = all.find((t) => t.name === `AD electronics ${tag}`);
await api('POST', '/auth/switch-tenant', { tenant_id: med?.id });
const m1 = (await api('GET', '/auth/me')).data;
await api('POST', '/auth/switch-tenant', { tenant_id: mob?.id });
const m2 = (await api('GET', '/auth/me')).data;
check('switch: medical then mobile, each with its own features', m1.active_tenant?.features?.includes('batches') && !m1.active_tenant?.features?.includes('serials') && m2.active_tenant?.features?.includes('serials') && !m2.active_tenant?.features?.includes('batches'), `${m1.active_tenant?.features} | ${m2.active_tenant?.features}`);
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
