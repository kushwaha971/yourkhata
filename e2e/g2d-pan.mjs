// G2d — a jeweller's PAN at ₹2 lakh, and no cash limit (design G2 dJewelBill side column;
// report docs/performance/2026-11-02-shop-g2-jewellery-bill.md).
//
// QA Jewellery, owner qa-jeweller. A tag at ₹15,000/g with 12% making is
// 12.340 × 15,000 × 1.12 = ₹2,07,312 — over ₹2 lakh. Checks:
//   B   a bill under ₹2 lakh shows no PAN box and no cash notice;
//   N1  over ₹2 lakh: the PAN box with "Needed because the bill is ₹2 lakh or
//       more."; no cash notice and "Paid cash" stays on (owner: no cash limit);
//   N2  a wrong PAN is refused under the box; the right one is kept by the
//       server, upper-cased (--skew expects another PAN: it must then fail);
//   N3  the whole bill issued in cash, the PAN kept on the bill;
//   L   390 light and 320 dark: nothing wider than the screen, no text cut.
//
//   node e2e/g2d-pan.mjs [--skew]
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g2d';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
let consoleErrors = 0;
const watch = (p) =>
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|status of 400/.test(m.text())) {
      consoleErrors += 1;
      console.log(`console: ${m.text().slice(0, 160)}`);
    }
  });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
watch(page);
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-jeweller@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });

const api = `${base}/api/v1`;
const hdr = async (extra = {}) => ({
  'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '',
  ...extra,
});
const get = async (path) => (await (await ctx.request.get(`${api}${path}`)).json()).data;
const setRate = async (r) => ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: r } });
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const makePiece = async (tagNo) =>
  ctx.request.post(`${api}/items`, {
    headers: await hdr({ 'Idempotency-Key': randomUUID() }),
    data: {
      name: `G2d chain ${tagNo}`,
      unit_id: nos.id,
      selling_price: '0',
      tracking: 'serial',
      tag: { tag_no: tagNo, purity: 'gold_22k', gross_g: '12.900', stone_g: '0.560', net_g: '12.340', making_type: 'pct', making_value: '12', wastage_pct: '0', huid: '7K2P9X' },
    },
  });
const tags = ['S', 'A', 'B', 'C'].map((x) => `GD-${run}${x}`);
for (const tag of tags) await makePiece(tag);

const scanInto = async (p, code) => {
  const box = p.getByPlaceholder(/Search or scan item|Search item or scan/).first();
  await box.waitFor({ timeout: 20000 });
  await box.click();
  await box.fill(code);
  await box.press('Enter');
  await p.getByTestId('line-jewel').first().waitFor({ timeout: 10000 }).catch(() => undefined);
};
const draftOf = async (tag) => {
  for (const row of (await get('/sales/invoices?tab=draft&page_size=8')) ?? []) {
    const doc = await get(`/sales/invoices/${row.id}`);
    if (doc?.lines?.some((l) => l.jewel?.tag_no === tag)) return doc;
  }
  return null;
};

// ── B: under ₹2 lakh ─────────────────────────────────────────────────────────
await setRate('11650');
await page.goto(`${base}/sales/invoices/new`);
await page.getByRole('button', { name: 'Quick sale', exact: true }).first().click().catch(() => undefined);
await scanInto(page, tags[0]);
await page.waitForTimeout(500);
check('B: ₹1,61,012 asks no PAN', (await page.getByTestId('jewel-pan').count()) === 0);
// Let the draft save before leaving, or the next bill asks about it first.
await page.waitForTimeout(4000);

// ── N1 / N2 / N3: over ₹2 lakh ───────────────────────────────────────────────
await setRate('15000');
await page.goto(`${base}/sales/invoices/new`);
await page.getByRole('button', { name: 'Quick sale', exact: true }).first().click().catch(() => undefined);
await scanInto(page, tags[1]);
const pan = page.getByTestId('jewel-pan');
await pan.waitFor({ timeout: 8000 }).catch(() => undefined);
check('N1: the PAN box appears at ₹2 lakh', (await pan.count()) === 1);
check('N1: "Needed because the bill is ₹2 lakh or more."', (await page.getByText('Needed because the bill is ₹2 lakh or more.').count()) >= 1);
check('N1: no cash notice (owner: no cash limit anywhere)', (await page.getByText(/Cash over ₹1,99,999/).count()) === 0);
check('N1: "Paid cash" stays on', !(await page.getByRole('button', { name: /Paid cash/ }).first().isDisabled().catch(() => true)));
await page.screenshot({ path: `${dir}/desk-1280-over.png`, fullPage: true });
await pan.fill('ABC12');
await page.waitForTimeout(4000);
check('N2: a wrong PAN is refused under the box', (await pan.getAttribute('aria-invalid')) === 'true' || (await page.getByText('Enter the 10-character PAN, like ABCPK1234L.').count()) >= 1);
await pan.fill('abcpk1234l');
await page.waitForTimeout(4000);
const saved = await draftOf(tags[1]);
const want = skew ? 'ABCPK9999L' : 'ABCPK1234L';
check(`N2: the server kept PAN ${want}`, saved?.pan === want, String(saved?.pan));
if (saved) {
  const whole = await ctx.request.post(`${api}/sales/invoices/${saved.id}/issue`, {
    headers: await hdr({ 'Idempotency-Key': randomUUID() }),
    data: { version: saved.version, payment: { mode_breakup: [{ mode: 'cash', amount: saved.grand_total }] } },
  });
  check('N3: the whole bill may be taken in cash', whole.ok(), String(whole.status()));
  const after = await get(`/sales/invoices/${saved.id}`);
  check('N3: the issued bill keeps the PAN', after?.pan === 'ABCPK1234L', String(after?.pan));
}

// ── L: phone ─────────────────────────────────────────────────────────────────
const host = new URL(base).hostname;
for (const [width, theme, tag] of [[390, 'light', tags[2]], [320, 'dark', tags[3]]]) {
  const phone = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width, height: 800 } });
  await phone.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }]);
  const p = await phone.newPage();
  watch(p);
  await p.goto(`${base}/sales/invoices/new`);
  await p.waitForTimeout(1500);
  await scanInto(p, tag);
  await p.getByTestId('jewel-pan').scrollIntoViewIfNeeded().catch(() => undefined);
  const m = await p.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - innerWidth, cut: [] };
    for (const el of document.querySelectorAll('main *')) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || s.display === 'none' || el.closest('[role=tablist]')) continue;
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible' && (/Cash over/.test(el.textContent) || el.closest('[data-testid=jewel-pan]'))) out.cut.push(el.textContent.trim().slice(0, 30));
    }
    // The phone row's rate caption: "12.340 g · ₹15,000/g", never cut.
    for (const el of document.querySelectorAll('[data-part=rate]')) {
      if (el.scrollWidth > el.clientWidth + 1) out.cut.push(`rate:${el.textContent.trim().slice(0, 30)}`);
    }
    out.rate = document.querySelector('[data-part=rate]')?.textContent ?? '';
    return out;
  });
  check(`L ${width} ${theme}: the row reads its weight and rate per gram`, /12\.340 g · ₹15,000\/g/.test(m.rate), m.rate);
  check(`L ${width} ${theme}: page no wider than the screen`, m.overflow <= 0, `${m.overflow}px`);
  check(`L ${width} ${theme}: PAN and row not cut`, m.cut.length === 0, m.cut.join(' | '));
  check(`L ${width} ${theme}: PAN box shown`, (await p.getByTestId('jewel-pan').count()) === 1);
  await p.screenshot({ path: `${dir}/phone-${width}-${theme}.png`, fullPage: true });
  await phone.close();
}
await setRate('11650');

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${consoleErrors} console errors${skew ? ' (SKEWED: a failure is expected)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || consoleErrors ? 1 : 0;
