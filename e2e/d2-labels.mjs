// D P2 — Print labels on the live stack (design D9).
//
//   item   /items/labels?item=<id>: one row with the item's code, 1 label;
//          raise it to 3 → "Print 3 labels"; preview shows the business name,
//          the item, bars and "code · ₹price"; Show price off drops the price
//   bars   the printed label's bars decode back to the item's code (the same
//          Code 128 the page drew, re-read from the SVG's rects)
//   print  emulated print media: the page's controls are hidden and exactly
//          3 labels are on paper
//   phone  no overflow at 390
//
//   node e2e/d2-labels.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d2-labels';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
};
const headers = async (ctx, extra = {}) => ({
  'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '',
  ...extra,
});

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await signIn(ctx);
const nos = (await (await ctx.request.get(`${base}/api/v1/units`)).json()).data.find((u) => u.code === 'NOS');
const item = (await (await ctx.request.post(`${base}/api/v1/items`, {
  headers: await headers(ctx, { 'Idempotency-Key': randomUUID() }),
  data: { name: `D2 label shirt ${tag}`, unit_id: nos.id, selling_price: '599' },
})).json()).data;
const code = item.barcode || item.sku;

await page.goto(`${base}/items/labels?item=${item.id}`, { waitUntil: 'networkidle' });
await sleep(1200);
const row = await page.getByTestId('labels-row').first().innerText().catch(() => '');
check('item: one row with the item and its code', row.includes(item.name) && row.includes(code), row.replace(/\n/g, ' / '));
await page.getByLabel(`Labels, ${item.name}`).fill('3');
await sleep(300);
check('item: "Print 3 labels"', (await page.getByTestId('labels-print').innerText()).includes('Print 3 labels'));
const label = await page.getByTestId('labels-preview').getByTestId('barcode-label').first().innerText();
check('preview: business, item and "code · ₹599.00"', label.includes(item.name) && label.includes(`${code} · ₹599.00`), label.replace(/\n/g, ' / '));

// Decode the drawn bars back to text: widths from the rects' x positions.
const decoded = await page.evaluate(() => {
  const svg = document.querySelector('[data-testid="labels-preview"] svg');
  const rects = [...svg.querySelectorAll('rect')].map((r) => [Number(r.getAttribute('x')), Number(r.getAttribute('width'))]);
  const widths = [];
  rects.forEach(([x, w], i) => {
    if (i > 0) widths.push(x - (rects[i - 1][0] + rects[i - 1][1]));
    widths.push(w);
  });
  const P = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232'];
  const syms = [];
  for (let i = 0; i + 6 <= widths.length - 7; i += 6) syms.push(P.indexOf(widths.slice(i, i + 6).join('')));
  return syms.slice(1, -1).map((v) => String.fromCharCode(v + 32)).join('');
});
check('bars: the label decodes to the item code', decoded === code, `${decoded} vs ${code}`);
await page.screenshot({ path: `${dir}/1280.png` });

await page.getByRole('switch', { name: /Show price/ }).click();
await sleep(300);
const noPrice = await page.getByTestId('labels-preview').getByTestId('barcode-label').first().innerText();
check('Show price off: no price on the label', !noPrice.includes('₹'), noPrice.replace(/\n/g, ' / '));

await page.emulateMedia({ media: 'print' });
const onPaper = await page.evaluate(() => [...document.querySelectorAll('.ub-print-only [data-testid="barcode-label"]')].filter((el) => el.getBoundingClientRect().height > 0).length);
const controls = await page.getByTestId('labels-print').isVisible();
check('print: 3 labels on paper and no controls', onPaper === 3 && !controls, `${onPaper} labels, controls ${controls}`);
await page.screenshot({ path: `${dir}/1280-print.png` });
await page.emulateMedia({ media: 'screen' });

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/items/labels?item=${item.id}`, { waitUntil: 'networkidle' });
await sleep(1200);
await p2.screenshot({ path: `${dir}/390.png` });
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('phone: no overflow', over <= 0, String(over));
await phone.close();
await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
