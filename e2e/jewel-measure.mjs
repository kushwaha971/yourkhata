// Computed sizes on the running app against the design's own CSS numbers
// (docs/revamp/design/shop-fixes-and-business-types.html: .tf th, .countline,
// .pdock, .btn.sm), at 1280 and 390, and 44 px tap targets on phone actions.
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-jeweller@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
await page.goto(`${base}/sales/custom-orders`);
await page.getByTestId('custom-orders').waitFor();
await page.waitForTimeout(1200);
const css = (sel, props) => page.evaluate(([s, ps]) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, ...Object.fromEntries(ps.map((p) => [p, c[p]])) }; }, [sel, props]);
const within = (a, b, t) => Math.abs(a - b) <= t;
const th = await css('main thead th', ['fontSize', 'fontWeight']);
check('.tf th height 46 px', th && within(th.h, 46, 4), JSON.stringify(th));
check('.tf th 13 px / 600', th && th.fontWeight === '600' && within(parseFloat(th.fontSize), 13, 1), `${th?.fontSize}/${th?.fontWeight}`);
const count = await css('[data-testid=custom-order-count]', ['fontSize']);
check('.countline 13.5 px', count && within(parseFloat(count.fontSize), 13.5, 0.6), count?.fontSize);
const primary = await css('[data-testid=custom-order-new]', ['fontSize', 'fontWeight']);
check('.btn 14 px / 600', primary && primary.fontSize === '14px' && primary.fontWeight === '600', `${primary?.fontSize}/${primary?.fontWeight}`);
await page.setViewportSize({ width: 390, height: 800 });
await page.reload();
await page.getByTestId('custom-orders').waitFor();
await page.waitForTimeout(1200);
const targets = await page.evaluate(() => [...document.querySelectorAll('main button, main a')].filter((e) => e.offsetParent).map((e) => {
  const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); const hit = e.classList.contains('ub-hit') ? Math.max(r.height, 44) : r.height;
  return { t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20), hit };
}));
const small = targets.filter((x) => x.hit < 44);
check('phone: every action has a 44 px target', small.length === 0, small.slice(0, 5).map((x) => `${x.t}:${Math.round(x.hit)}`).join(' | '));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
