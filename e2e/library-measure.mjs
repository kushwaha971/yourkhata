/**
 * Pixel measurement against the approved design (R-DEC-50: "pixels are measured,
 * not eyeballed"). For each part of the Library's mocks (I4–I7) it reads the
 * computed size, spacing and type of the design's own element inside its
 * `[data-mock]`, and of the same part on the running screen, and fails on any
 * difference above 1 px (font weight exact).
 *
 *   node e2e/library-measure.mjs   (stack on :3005, room from e2e/library_seed.py)
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

// part: [label, mock, design selector, our path (phone|desk), our locator, props]
const PARTS = [
  ['phone page title', 'pLHome', '.ptitle', 'phone', '/library', (p) => p.locator('main h1'), ['fontSize', 'fontWeight']],
  ['phone card padding', 'pLHome', '.card.pad', 'phone', '/library', (p) => p.getByTestId('library-home-seats'), ['paddingTop', 'paddingLeft', 'borderTopLeftRadius']],
  ['phone big button', 'pLHome', '.btn.lg', 'phone', '/library', (p) => p.getByRole('button', { name: 'Counter' }).filter({ visible: true }), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['phone list row', 'pLHome', '.lst>.li', 'phone', '/library', (p) => p.getByTestId('library-student-row'), ['minHeight', 'paddingTop', 'paddingLeft', 'columnGap']],
  ['phone row name', 'pLHome', '.li .t b', 'phone', '/library', (p) => p.getByTestId('library-student-row').locator('span, p, div').filter({ hasText: /^Rahul Gaikwad$/ }), ['fontSize', 'fontWeight']],
  ['phone row caption', 'pLHome', '.li .t small', 'phone', '/library', (p) => p.getByTestId('library-student-row').locator('span, p, div').filter({ hasText: /^Seat 14/ }), ['fontSize']],
  ['badge', 'pLHome', '.badge', 'phone', '/library', (p) => p.getByTestId('library-student-row').getByText('Overdue', { exact: true }), ['fontSize', 'fontWeight', 'paddingLeft', 'paddingTop']],
  ['desk page title', 'dLHome', '.phd h1', 'desk', '/library', (p) => p.locator('main h1'), ['fontSize', 'fontWeight']],
  ['desk subtitle', 'dLHome', '.phd p', 'desk', '/library', (p) => p.locator('[data-ub-page-subtitle]'), ['fontSize']],
  ['desk button', 'dLHome', '.phd .btn', 'desk', '/library', (p) => p.getByRole('button', { name: 'Counter' }).filter({ visible: true }), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['figure card', 'dLHome', '.card[style*="padding:10px 14px"]', 'desk', '/library', (p) => p.getByTestId('library-figures').locator(':scope > div').first(), ['paddingTop', 'paddingLeft', 'borderTopLeftRadius']],
  ['figure label', 'dLHome', '.card[style*="padding:10px 14px"] small', 'desk', '/library', (p) => p.getByTestId('library-figures').locator(':scope > div').first().locator('> *').first(), ['fontSize', 'fontWeight']],
  ['figure value', 'dLHome', '.card[style*="padding:10px 14px"] b', 'desk', '/library', (p) => p.getByTestId('library-figures').locator(':scope > div').first().locator('> *').nth(1), ['fontSize', 'fontWeight']],
  ['figures gap', 'dLHome', 'div[style*="repeat(4,minmax(0,1fr))"]', 'desk', '/library', (p) => p.getByTestId('library-figures'), ['columnGap']],
  ['seat cell (desk)', 'dLSeats', 'span[style*="height:44px"]', 'desk', '/library/seats', (p) => p.getByTestId('library-seat'), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['seat cell (phone)', 'pLSeats', 'span[style*="height:40px"]', 'phone', '/library/seats', (p) => p.getByTestId('library-seat'), ['height', 'fontSize', 'fontWeight', 'borderTopLeftRadius']],
  ['seat grid gap', 'dLSeats', 'div[style*="repeat(12,minmax(0,1fr))"]', 'desk', '/library/seats', (p) => p.getByTestId('library-seat-grid'), ['rowGap', 'columnGap']],
  ['kv row', 'dLSeats', '.kv', 'desk', '/library/seats', (p) => p.getByTestId('library-seat-panel').locator('div').filter({ hasText: /^Paid to/ }).last(), ['fontSize']],
  ['fees chip (phone)', 'pLFees', '.chp.sm', 'phone', '/library/fees', (p) => p.getByRole('radio').first(), ['fontSize', 'paddingLeft']],
  // I6 — the Collect sheet, opened on Rahul (path 'collect' opens it).
  ['collect chip', 'pLStudent', '.chp.sm', 'phone', 'collect', (p) => p.getByRole('dialog').getByRole('radio').first(), ['fontSize', 'paddingLeft']],
  ['cash / UPI switch', 'pLStudent', '.segc span', 'phone', 'collect', (p) => p.getByRole('dialog').getByRole('button', { name: 'Cash', exact: true }), ['height', 'fontSize', 'fontWeight']],
  ['save button', 'pLStudent', '.btn.cta.lg', 'phone', 'collect', (p) => p.getByTestId('library-collect-save'), ['height', 'fontSize', 'fontWeight']],
  ['fee due amount', 'pLStudent', '.amt', 'phone', 'collect', (p) => p.getByTestId('library-fee-due').locator('> *').nth(1), ['fontSize']],
];
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
      if (path === 'collect') {
        const rahul = (await (await ctx.request.get(`${base}/api/v1/library/students?q=Rahul`)).json()).data[0];
        await page.goto(`${base}/library/students/${rahul.id}`, { waitUntil: 'networkidle' });
        await page.getByTestId('library-collect-phone').click();
        await page.getByRole('dialog').getByTestId('library-collect-after').filter({ hasText: 'Paid to' }).waitFor();
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
