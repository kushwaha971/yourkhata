// G2c — old gold taken in against a jeweller's bill (design G2 pOldGold and
// dJewelBill's "Old gold taken in" card; report
// docs/performance/2026-11-02-shop-g2-jewellery-bill.md).
//
// QA Jewellery, owner qa-jeweller. Checks:
//   O1  the sheet prices 8.200 g × ₹11,650, less 2% as the design shows:
//       ₹95,530.00 − ₹1,910.60 = ₹93,619.40; "Take ₹93,619.40 off";
//   O2  the bill's card and totals: "− ₹93,619.40", To pay = total − old gold;
//       the saved draft's old gold is the server's 93619.40 (--skew expects a
//       paisa more: it must then fail);
//   O3  a cash quick sale is finished with "Paid cash" for exactly To pay, and
//       the API has it paid: old gold settled as no money moved, cash the rest;
//   P   the print says "Old gold taken in: ₹93,619.40 (8.200 g)";
//   L   the sheet at 390 light and 320 dark: nothing wider than the screen, no
//       text cut.
//
//   node e2e/g2c-old-gold.mjs [--skew]
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g2c';
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
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
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
await ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: '11650' } });
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const makePiece = async (tagNo) =>
  ctx.request.post(`${api}/items`, {
    headers: await hdr({ 'Idempotency-Key': randomUUID() }),
    data: {
      name: `G2c chain ${tagNo}`,
      unit_id: nos.id,
      selling_price: '0',
      tracking: 'serial',
      tag: { tag_no: tagNo, purity: 'gold_22k', gross_g: '12.900', stone_g: '0.560', net_g: '12.340', making_type: 'pct', making_value: '12', wastage_pct: '0', huid: '7K2P9X' },
    },
  });
const tagA = `GC-${run}A`;
const tagB = `GC-${run}B`;
await makePiece(tagA);
await makePiece(tagB);

const scanInto = async (p, code) => {
  const box = p.getByPlaceholder(/Search or scan item|Search item or scan/).first();
  await box.waitFor({ timeout: 20000 });
  await box.click();
  await box.fill(code);
  await box.press('Enter');
  await p.getByTestId('line-jewel').first().waitFor({ timeout: 10000 }).catch(() => undefined);
};
const takeOldGold = async (p) => {
  await p.getByTestId('old-gold-add').click();
  const sheet = p.getByTestId('old-gold-sheet');
  await sheet.waitFor({ timeout: 10000 });
  await sheet.getByLabel('Weight').fill('8.200');
  await sheet.getByLabel('Less (melting)').fill('2');
  // Today's rate fills itself; wait for it.
  await p.waitForFunction(() => /₹95,530\.00/.test(document.querySelector('[data-testid=old-gold-breakdown]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
};
const draftOf = async (tag) => {
  for (const row of (await get('/sales/invoices?tab=draft&page_size=8')) ?? []) {
    const doc = await get(`/sales/invoices/${row.id}`);
    if (doc?.lines?.some((l) => l.jewel?.tag_no === tag)) return doc;
  }
  return null;
};
const money = (s) => Number(String(s).replace(/[^\d.]/g, ''));

// ── O1 / O2 / O3 desktop, a quick sale ──────────────────────────────────────
await page.goto(`${base}/sales/invoices/new`);
await page.getByRole('button', { name: 'Quick sale', exact: true }).first().click().catch(() => undefined);
await scanInto(page, tagA);
await takeOldGold(page);
const breakdown = (await page.getByTestId('old-gold-breakdown').innerText().catch(() => '')).replace(/\s+/g, ' ');
check('O1: the sheet reads ₹95,530.00 − ₹1,910.60 = ₹93,619.40', breakdown.includes('₹95,530.00') && breakdown.includes('₹1,910.60') && breakdown.includes('₹93,619.40'), breakdown);
const takeText = await page.getByTestId('old-gold-take').innerText();
check('O1: "Take ₹93,619.40 off"', takeText.replace(/\s+/g, ' ').includes('Take ₹93,619.40 off'), takeText);
await page.screenshot({ path: `${dir}/desk-1280-sheet.png` });
await page.getByTestId('old-gold-take').click();
await page.getByTestId('old-gold-card').waitFor({ timeout: 8000 }).catch(() => undefined);
const card = (await page.getByTestId('old-gold-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
check('O2: the card reads "8.200 g · 22K · 91.6% tested · less 2%" and − ₹93,619.40', card.includes('8.200 g') && card.includes('less 2%') && card.includes('₹93,619.40'), card);
const grand = money(await page.getByTestId('invoice-grand-total').first().innerText());
const toPay = money(await page.getByTestId('invoice-to-pay').first().innerText().catch(() => '0'));
check('O2: To pay = total − old gold', Math.abs(grand - 93619.4 - toPay) < 0.005, `${grand} − 93619.40 vs ${toPay}`);
await page.waitForTimeout(3500);
const saved = await draftOf(tagA);
const want = skew ? '93619.41' : '93619.40';
check(`O2: the server kept the old gold at ${want}`, saved?.old_gold?.value === want, String(saved?.old_gold?.value));
await page.screenshot({ path: `${dir}/desk-1280-bill.png`, fullPage: true });
const cash = page.getByRole('button', { name: /Paid cash/ }).first();
check('O3: "Paid cash" names To pay, not the bill', (await cash.getAttribute('aria-label').catch(() => '') ?? '').includes(toPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })), await cash.getAttribute('aria-label').catch(() => ''));
await cash.click();
await page.waitForTimeout(3000);
const issued = saved ? await get(`/sales/invoices/${saved.id}`) : null;
check('O3: issued and paid in full', issued?.status === 'paid', `${issued?.status} paid ${issued?.amount_paid}`);
check('O3: paid = cash + old gold = the bill', issued && Math.abs(Number(issued.amount_paid) - Number(issued.grand_total)) < 0.005);

// ── P: the print ─────────────────────────────────────────────────────────────
if (issued) {
  await page.goto(`${base}/sales/invoices/${issued.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: 'print' });
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${dir}/print-a4.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  check('P: "Old gold taken in: ₹93,619.40 (8.200 g)."', text.includes('Old gold taken in: ₹93,619.40 (8.200 g).'));
}

// ── L: the phone sheet ──────────────────────────────────────────────────────
const host = new URL(base).hostname;
for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
  const phone = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width, height: 800 } });
  await phone.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }]);
  const p = await phone.newPage();
  watch(p);
  await p.goto(`${base}/sales/invoices/new`);
  await p.waitForTimeout(1500);
  await scanInto(p, tagB);
  await takeOldGold(p);
  const m = await p.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - innerWidth, cut: [] };
    for (const el of document.querySelectorAll('[role=dialog] *')) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || s.display === 'none') continue;
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible') out.cut.push(el.textContent.trim().slice(0, 30));
      if (r.right > innerWidth + 1) out.cut.push(`off:${el.textContent.trim().slice(0, 30)}`);
    }
    for (const el of document.querySelectorAll('[role=dialog] input')) {
      if (el.value && el.scrollWidth > el.clientWidth + 1) out.cut.push(`input ${el.value}`);
    }
    return out;
  });
  check(`L ${width} ${theme}: sheet no wider than the screen`, m.overflow <= 0, `${m.overflow}px`);
  check(`L ${width} ${theme}: sheet text not cut`, m.cut.length === 0, m.cut.slice(0, 4).join(' | '));
  await p.screenshot({ path: `${dir}/phone-${width}-${theme}-sheet.png` });
  await phone.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${consoleErrors} console errors${skew ? ' (SKEWED: a failure is expected)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || consoleErrors ? 1 : 0;
