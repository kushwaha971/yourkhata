/**
 * Lending: pixel measurement against the approved design (R-DEC-50: "pixels are measured,
 * not eyeballed"). For each part of Lending's mocks (I8–I11) it reads the
 * computed size, spacing and type of the design's own element inside its
 * `[data-mock]`, and of the same part on the running screen, and fails on any
 * difference above 1 px (font weight exact).
 *
 *   node e2e/library-measure.mjs   (stack on :3005, round from e2e/lending_seed.py)
 */
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const design = new URL('../docs/revamp/design/shop-fixes-and-business-types.html', import.meta.url).href;
const PROPS = ['height', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'fontWeight', 'borderTopLeftRadius', 'rowGap', 'columnGap'];

const read = (loc, props) =>
  loc.first().evaluate((el, ps) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of ps) out[p] = p === 'height' ? `${el.getBoundingClientRect().height / (el.closest('[data-mock]') ? Number(getComputedStyle(el.closest('.fit') ?? el).getPropertyValue('--s') || 1) : 1)}px` : cs[p];
    return out;
  }, props);

// part: [label, mock, design selector, where, our path, our locator, props]
const PARTS = [
  ['phone page title', 'pNToday', '.ptitle', 'phone', '/lending', (p) => p.locator('main h1'), ['fontSize', 'fontWeight']],
  ['round card padding', 'pNToday', '.card.pad', 'phone', '/lending', (p) => p.getByTestId('lending-round'), ['paddingTop', 'paddingLeft', 'borderTopLeftRadius']],
  ['round figure', 'pNToday', 'b.num[style*="font-size:20px"]', 'phone', '/lending', (p) => p.getByTestId('lending-round').locator('> *').nth(1), ['fontSize', 'fontWeight']],
  ['stop chip', 'pNToday', '.chp.sm', 'phone', '/lending', (p) => p.getByRole('radio').first(), ['fontSize', 'paddingLeft']],
  ['stop row', 'pNToday', '.lst>.li', 'phone', '/lending', (p) => p.getByTestId('lending-stops').locator('li > div').first(), ['paddingTop', 'paddingLeft', 'columnGap']],
  ['stop button', 'pNToday', '.btn.sm', 'phone', '/lending', (p) => p.getByTestId('lending-collect').first(), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['desk page title', 'dNToday', '.phd h1', 'desk', '/lending', (p) => p.locator('main h1'), ['fontSize', 'fontWeight']],
  ['desk subtitle', 'dNToday', '.phd p', 'desk', '/lending', (p) => p.locator('[data-ub-page-subtitle]'), ['fontSize']],
  ['desk new-loan button', 'dNToday', '.phd .btn.cta', 'desk', '/lending', (p) => p.getByRole('button', { name: 'New loan' }).filter({ visible: true }), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['figure card', 'dNToday', '.card[style*="padding:10px 14px"]', 'desk', '/lending', (p) => p.getByTestId('lending-figures').locator(':scope > div').first(), ['paddingTop', 'paddingLeft', 'borderTopLeftRadius']],
  ['figure value', 'dNToday', '.card[style*="padding:10px 14px"] b', 'desk', '/lending', (p) => p.getByTestId('lending-figures').locator(':scope > div').first().locator('> *').nth(1), ['fontSize', 'fontWeight']],
  ['figures gap', 'dNToday', 'div[style*="repeat(4,minmax(0,1fr))"]', 'desk', '/lending', (p) => p.getByTestId('lending-figures'), ['columnGap']],
  ['badge', 'dNToday', '.badge', 'desk', '/lending', (p) => p.getByTestId('lending-stops-table').locator('tbody span.rounded-pill').filter({ hasText: /^Late$/ }).first(), ['fontSize', 'fontWeight', 'paddingLeft', 'paddingTop']],
  ['loan title', 'dNLoan', '.phd h1', 'desk', 'loan', (p) => p.locator('main h1'), ['fontSize', 'fontWeight']],
  ['loan figure card', 'dNLoan', '.card[style*="padding:10px 14px"]', 'desk', 'loan', (p) => p.getByTestId('lending-loan-figures').locator(':scope > div').first(), ['paddingTop', 'paddingLeft']],
  ['message chip', 'pNMsg', '.chp.sm', 'phone', '/lending/messages', (p) => p.getByRole('radio').first(), ['fontSize', 'paddingLeft']],
  ['message row', 'pNMsg', '.lst>.li', 'phone', '/lending/messages', (p) => p.getByTestId('lending-remind-list').locator('li > button, li > a, li > *').first(), ['minHeight', 'paddingTop', 'paddingLeft', 'columnGap']],
];
// R-DEC-32 (owner, 21 Oct): a chip's visible face is 32 px, the design's .chp.sm is 28 —
// the owner's rule wins and the height is not measured; listed in the round report.
// R-DEC-32 (owner, 21 Oct): a chip's visible face is 32 px, the design's .chp.sm is 28 —
// the owner's rule wins and the height is not measured; listed in the round report.

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const results = [];
const dctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const dp = await dctx.newPage();
await dp.goto(design, { waitUntil: 'load' });
await dp.waitForTimeout(800);
const designValues = {};
for (const [label, mock, sel, , , , props] of PARTS) {
  const loc = dp.locator(`[data-mock="${mock}"] ${sel}`);
  designValues[label] = (await loc.count()) ? await loc.first().evaluate((el, ps) => {
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of ps) o[p] = p === 'height' ? `${el.offsetHeight}px` : cs[p];
    return o;
  }, props) : null;
}

for (const width of [390, 1280]) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  let at = '';
  for (const [label, , , where, path, ours, props] of PARTS) {
    if ((where === 'phone') !== phone) continue;
    if (at !== path) {
      if (path === 'loan') {
        const sunil = (await (await ctx.request.get(`${base}/api/v1/lending/loans?q=Sunil`)).json()).data[0];
        await page.goto(`${base}/lending/loans/${sunil.id}`, { waitUntil: 'networkidle' });
      } else await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      at = path;
    }
    const want = designValues[label];
    const loc = ours(page);
    const got = (await loc.count().catch(() => 0))
      ? await loc.first().evaluate((el, ps) => {
          const cs = getComputedStyle(el);
          const o = {};
          for (const p of ps) o[p] = p === 'height' ? `${el.offsetHeight}px` : cs[p];
          return o;
        }, props)
      : null;
    if (!want || !got) {
      results.push(false);
      console.log(`FAIL ${width} ${label}: ${want ? '' : 'design part not found '}${got ? '' : 'our part not found'}`);
      continue;
    }
    const diffs = props.filter((p) => {
      const a = parseFloat(want[p]);
      const b = parseFloat(got[p]);
      if (Number.isNaN(a) || Number.isNaN(b)) return want[p] !== got[p];
      return p === 'fontWeight' ? a !== b : Math.abs(a - b) > 1;
    });
    results.push(diffs.length === 0);
    console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${width} ${label}${diffs.length ? ` — ${diffs.map((p) => `${p} design ${want[p]} ours ${got[p]}`).join('; ')}` : ''}`);
  }
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} parts measure as the design`);
process.exit(failed ? 1 : 0);
