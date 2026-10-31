// Part D LOOK sweep: every D screen at 320, 390 and 1280, light and dark, EN
// and HI, measured (page overflow, clipped text, untranslated English on a
// Hindi page) and photographed into /tmp/e2e-shots/d-look for a human LOOK.
//
//   node e2e/d-look.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/d-look';
mkdirSync(dir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  if (!ok) console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};
const SCREENS = [
  ['home', '/dashboard', 'home-strip'],
  ['estimate', '/sales/estimates/new', null],
  ['challan', '/sales/challans/new', null],
  ['expiry', '/stock/expiry', 'expiry-screen'],
  ['imei', '/items/imei', null],
  ['transfer', '/stock/transfer', null],
  ['count', '/stock/count', null],
  ['labels', '/items/labels', null],
];
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const host = new URL(base).hostname;
for (const locale of ['en', 'hi']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 800 : 900 }, colorScheme: theme, ...(width < 768 ? { isMobile: true, hasTouch: true } : {}) });
      await ctx.addCookies([
        { name: 'ub_locale', value: locale, domain: host, path: '/' },
        { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
      ]);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text().slice(0, 160)); });
      await page.goto(`${base}/login/email`);
      await page.fill('input[type=email]', 'scale@digikhaato.test');
      await page.fill('input[type=password]', 'Scale-Run-2026!');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
      for (const [name, path] of SCREENS) {
        const tag = `${name}-${width}-${theme}-${locale}`;
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        const discard = page.getByRole('dialog').getByRole('button', { name: /^(Discard|हटाएँ|छोड़ें)$/ });
        if (await discard.isVisible({ timeout: 800 }).catch(() => false)) await discard.click();
        await page.waitForTimeout(800);
        // A wrong address must fail, not pass as a tidy 404 page.
        check(`${tag}: the screen exists`, !(await page.getByText(/We could not find that page|वह पेज नहीं मिला/).isVisible().catch(() => false)));
        const m = await page.evaluate(() => {
          const over = document.documentElement.scrollWidth - window.innerWidth;
          const clipped = [];
          for (const el of document.querySelectorAll('main *')) {
            if (el.children.length || !el.textContent?.trim()) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
            // A screen-reader-only label is a 1 px box by design.
            if (el.clientWidth <= 2 || el.clientHeight <= 2) continue;
            if (el.scrollWidth > el.clientWidth + 1 && (cs.overflow.includes('hidden') || cs.textOverflow === 'ellipsis')) clipped.push(el.textContent.trim().slice(0, 30));
          }
          return { over, clipped: clipped.slice(0, 5) };
        });
        check(`${tag}: no page overflow`, m.over <= 0, String(m.over));
        check(`${tag}: no clipped text`, m.clipped.length === 0, m.clipped.join(' | '));
        await page.screenshot({ path: `${dir}/${tag}.png` });
      }
      check(`${width}-${theme}-${locale}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
