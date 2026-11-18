// Owner, 14 Nov 2026: phone orders for every kind of shop, Sites for an
// electrical shop, and "Quotation" for hardware and electrical shops.
// Signs up a fresh business of each kind, reads what the SERVER gave it, then
// looks at the menu on a desktop and a phone. Shots in /tmp/e2e-shots/kind-features.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const FE = process.env.E2E_BASE ?? 'http://localhost:3005';
const BE = 'http://localhost:8000/api/v1';
const OUT = '/tmp/e2e-shots/kind-features';
mkdirSync(OUT, { recursive: true });
const stamp = Date.now();
let fails = 0, passes = 0;
const check = (ok, what) => { ok ? passes++ : fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const api = async (m, p, b, t, extra = {}) => {
  const r = await fetch(BE + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Client': 'api', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const KINDS = [
  ['electronics', { phone: true, sites: true, quote: true }],
  ['hardware', { phone: true, sites: true, quote: true }],
  ['medical', { phone: true, sites: false, quote: false }],
  ['garments', { phone: true, sites: false, quote: false }],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
for (const [kind, want] of KINDS) {
  const email = `kind-${kind}-${stamp}@shop.test`, password = 'Dukaan2026x';
  let r = await api('POST', '/auth/register', { email, password, full_name: `Kind ${kind}` });
  const t0 = r.body?.data?.access_token;
  r = await api('POST', '/tenants', { name: `${kind} test shop`, business_type: kind, state_code: '27' }, t0, { 'Idempotency-Key': `t-${kind}-${stamp}` });
  check(r.status === 201 || r.status === 200, `${kind}: business created (${r.status})`);
  r = await api('POST', '/auth/login', { email, password });
  const token = r.body?.data?.access_token;
  r = await api('GET', '/auth/me', null, token);
  const at = r.body?.data?.active_tenant ?? {};
  const feats = at.features ?? [];
  check(feats.includes('phone_orders') === want.phone, `${kind}: server phone_orders = ${want.phone}`);
  check(feats.includes('sites') === want.sites, `${kind}: server sites = ${want.sites}`);
  const words = (at.words && (at.words.en ?? at.words)) || {};
  check((words['nav.estimates'] === 'Quotations') === want.quote, `${kind}: server says ${words['nav.estimates'] ?? 'Estimates'}`);
  r = await api('GET', '/sales/phone-orders', null, token);
  check(r.status === 200, `${kind}: phone orders list answers 200 (${r.status})`);

  for (const [size, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${FE}/login/email`, { waitUntil: 'domcontentloaded' });
    await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', password);
    await p.click('button[type="submit"]'); await p.waitForTimeout(3000);
    // A fresh business has not finished the set-up steps, so the dashboard
    // redirects there; /more and a sales page both draw the menu.
    await p.goto(`${FE}/${size === 'phone' ? 'more' : 'sales/invoices'}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    const text = await p.locator('body').innerText();
    check(/Phone orders/.test(text) === want.phone, `${kind} ${size}: menu shows Phone orders = ${want.phone}`);
    check(/\bSites\b/.test(text) === want.sites, `${kind} ${size}: menu shows Sites = ${want.sites}`);
    check(/Quotations/.test(text) === want.quote && /\bEstimates\b/.test(text) === !want.quote, `${kind} ${size}: menu says ${want.quote ? 'Quotations' : 'Estimates'}`);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(over <= 0, `${kind} ${size}: no sideways overflow (${over})`);
    check(errs.length === 0, `${kind} ${size}: no page errors ${errs.join(' | ')}`);
    await p.screenshot({ path: `${OUT}/${kind}-${size}.png`, fullPage: size === 'phone' });
    if (want.quote && size === 'desktop') {
      await p.goto(`${FE}/sales/estimates`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
      const t = await p.locator('body').innerText();
      check(/Quotations/.test(t) && /New quotation/.test(t) && !/[Ee]stimate/.test(t.replace(/Estimated/g, '')), `${kind}: the list page says Quotation everywhere`);
      await p.screenshot({ path: `${OUT}/${kind}-quotations.png` });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
