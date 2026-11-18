// G2b — a jeweller's bill by weight (design G2 dJewelBill, D2 jewellery line,
// D14 print; report docs/performance/2026-11-02-shop-g2-jewellery-bill.md).
//
// QA Jewellery (e2e/fixtures/ad_cert_people.py), owner qa-jeweller. Checks:
//   S1  scanning a tag label on a new bill adds ONE line with its weight caption;
//       the saved draft's price is the server's: 12.340 g × ₹11,650 + 12% =
//       ₹1,61,012.32 (--skew expects a paisa more: it must then fail);
//   S2  the same tag scanned again is said, not added;
//   S3  phone: the line sheet shows the weights and the parts; making changed
//       to ₹850/g reprices the line on screen and on the server (₹1,54,250.00);
//   S4  issued: the tag is sold, a second lookup is 404, and a rate changed
//       afterwards does not move the bill;
//   P   the A4 print has "Net wt · Purity", the line's weight, purity and HUID,
//       and "Rates used: 22K 916 ₹11,650.00/g";
//   L   the sheet at 390 and 320, light and dark: nothing wider than the screen,
//       no text cut.
//
//   node e2e/g2b-bill.mjs [--skew]
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g2b';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
let consoleErrors = 0;

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
    consoleErrors += 1;
    console.log(`console: ${m.text().slice(0, 160)}`);
  }
});
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
const setRate = async (gold22) =>
  ctx.request.put(`${api}/metal-rates/today`, { headers: await hdr(), data: { gold_22k: gold22 } });

// ── set-up: today's rate and two pieces, each its own item with one tag ──────
await setRate('11650');
const nos = (await get('/units')).find((u) => u.code === 'NOS');
const makePiece = async (tagNo) => {
  const res = await ctx.request.post(`${api}/items`, {
    headers: await hdr({ 'Idempotency-Key': randomUUID() }),
    data: {
      name: `G2b chain ${tagNo}`,
      unit_id: nos.id,
      selling_price: '0',
      tracking: 'serial',
      tag: { tag_no: tagNo, purity: 'gold_22k', gross_g: '12.900', stone_g: '0.560', net_g: '12.340', making_type: 'pct', making_value: '12', wastage_pct: '0', huid: '7K2P9X' },
    },
  });
  return (await res.json()).data;
};
const tagA = `GB-${run}A`;
const tagB = `GB-${run}B`;
await makePiece(tagA);
await makePiece(tagB);
check('set-up: two tagged pieces in stock', (await ctx.request.get(`${api}/jewel-tags/lookup?tag=${tagA}`)).ok());

const newestDraft = async () => {
  const rows = (await get('/sales/invoices?tab=draft&page_size=5')) ?? [];
  for (const row of rows) {
    const doc = await get(`/sales/invoices/${row.id}`);
    if (doc?.lines?.some((l) => l.jewel?.tag_no === tagA || l.jewel?.tag_no === tagB)) return doc;
  }
  return null;
};
const scanInto = async (p, code) => {
  // The item search, by its words (the customer picker is a combobox too).
  const box = p.getByPlaceholder(/Search or scan item|Search item or scan/).first();
  await box.waitFor({ timeout: 20000 });
  await box.click();
  await box.fill(code);
  await box.press('Enter');
};

// ── S1 / S2 desktop ──────────────────────────────────────────────────────────
await page.goto(`${base}/sales/invoices/new`);
await page.getByTestId('invoice-lines').waitFor({ timeout: 20000 }).catch(() => undefined);
await scanInto(page, tagA.toLowerCase());
const caption = page.getByTestId('line-jewel').first();
await caption.waitFor({ timeout: 10000 }).catch(() => undefined);
// Desktop, design dJewelBill: Tag · item | Net wt | Rate | Making | Amount.
const row = (await page.getByTestId('invoice-line').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
const head = (await page.locator('thead').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
const headHasGst = /\bGST\b/.test(head);
check('S1: the scan adds the tag line (tag · HUID under the name)', (await caption.innerText().catch(() => '')).includes(`${tagA} · HUID 7K2P9X`));
check('S1: jeweller columns Tag · item, Net wt, Rate, Making', ['Tag · item', 'Net wt', 'Rate', 'Making'].every((w) => head.includes(w)) && !head.includes('Disc.'), head);
check('S1: the row reads 12.340 g · ₹11,650.00/g · 12%', row.includes('12.340 g') && row.includes('₹11,650.00/g') && row.includes('12%'), row);
await scanInto(page, tagA);
await page.waitForTimeout(800);
check('S2: the same tag again is said, not added', (await page.getByTestId('line-jewel').count()) === 1, `${await page.getByTestId('line-jewel').count()} lines`);
check('S2: …in words', (await page.getByText(`Tag ${tagA} is already on this bill.`).count()) >= 1);
await page.waitForTimeout(3500); // autosave
let draft = await newestDraft();
const want = skew ? '161012.3300' : '161012.3200';
const priced = draft?.lines?.[0]?.unit_price;
check(`S1: the server priced it ${want}`, priced === want, String(priced));
await page.screenshot({ path: `${dir}/desk-1280-line.png`, fullPage: true });

// ── S4 / P: issue it, then read the print ────────────────────────────────────
if (draft) {
  const issued = await ctx.request.post(`${api}/sales/invoices/${draft.id}/issue`, {
    headers: await hdr({ 'Idempotency-Key': randomUUID() }),
    data: { version: draft.version, payment: { mode_breakup: [{ mode: 'upi', amount: draft.grand_total }] } },
  });
  check('S4: the bill issues', issued.ok(), String(issued.status()));
  check('S4: the tag is no longer in stock', (await ctx.request.get(`${api}/jewel-tags/lookup?tag=${tagA}`)).status() === 404);
  await setRate('12000');
  const after = await get(`/sales/invoices/${draft.id}`);
  check('S4: a later rate does not move the bill', after.lines[0].jewel.rate === '11650.00' && after.lines[0].unit_price === '161012.3200', after.lines[0].jewel.rate);
  await setRate('11650');
  await page.goto(`${base}/sales/invoices/${draft.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: 'print' });
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${dir}/print-a4.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  check('P: "Net wt · Purity" column', text.includes('Net wt · Purity'));
  check('P: the line reads "12.340 g · 22K 916 · HUID 7K2P9X"', text.includes('12.340 g · 22K 916 · HUID 7K2P9X'));
  check('P: "Rates used: 22K 916 ₹11,650.00/g"', text.includes('Rates used: 22K 916 ₹11,650.00/g'));
}

// ── S3 / L: phone, the line sheet ───────────────────────────────────────────
const host = new URL(base).hostname;
for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
  const phone = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width, height: 800 } });
  await phone.addCookies([{ name: 'ub_theme_choice', value: theme, domain: host, path: '/' }]);
  const p = await phone.newPage();
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) consoleErrors += 1;
  });
  await p.goto(`${base}/sales/invoices/new`);
  await p.waitForTimeout(1500);
  await scanInto(p, tagB);
  await p.getByTestId('line-jewel').first().waitFor({ timeout: 10000 }).catch(() => undefined);
  await p.getByRole('button', { name: /^Edit/ }).first().click();
  const sheet = p.getByTestId('jewel-line');
  await sheet.waitFor({ timeout: 10000 }).catch(() => undefined);
  const key = `L ${width} ${theme}`;
  if (width === 390) {
    await p.getByTestId('jewel-line').getByRole('button', { name: '₹ per g' }).click();
    const making = p.getByTestId('jewel-line').getByLabel('Making', { exact: true });
    await making.fill('850');
    await p.waitForTimeout(300);
    const breakdown = (await p.getByTestId('jewel-breakdown').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const gst = p.getByTestId('jewel-line').getByLabel('GST');
    // The picker follows the bill's own rule: shown wherever the bill charges
    // GST (a registered business), hidden on a business that charges none.
    check('S3: the GST picker follows the bill (shown when the bill shows GST)', ((await gst.count()) > 0) === headHasGst, `picker ${await gst.count()}, bill GST ${headHasGst}`);
    check('S3: the sheet never states a fixed GST', !(await p.getByTestId('jewel-line').innerText()).includes('GST 3%'));
    check('S3: the sheet shows the parts at ₹850/g', breakdown.includes('₹1,43,761.00') && breakdown.includes('₹10,489.00') && breakdown.includes('₹1,54,250.00'), breakdown);
  }
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
  check(`${key}: sheet no wider than the screen`, m.overflow <= 0, `${m.overflow}px`);
  check(`${key}: sheet text not cut`, m.cut.length === 0, m.cut.slice(0, 4).join(' | '));
  await p.screenshot({ path: `${dir}/phone-${width}-${theme}-sheet.png` });
  if (width === 390) {
    await p.getByRole('button', { name: 'Done' }).click();
    await p.waitForTimeout(3500);
    draft = await newestDraft();
    const line = draft?.lines?.find((l) => l.jewel?.tag_no === tagB);
    check('S3: the server repriced it to 154250.0000', line?.unit_price === '154250.0000', String(line?.unit_price));
  }
  await phone.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${consoleErrors} console errors${skew ? ' (SKEWED: a failure is expected)' : ''}`);
process.exitCode = skew ? (failed ? 0 : 1) : failed || consoleErrors ? 1 : 0;
