/**
 * Settings and Your profile against the approved design (docs/revamp/design/
 * settings-and-profile.html), every case the P0 standard names: 390, 320 and
 * 1280; light and dark; English and Hindi; and after an error. For each shot:
 *   - nothing wider than the screen; no text cut by an ellipsis; no raw ids;
 *   - the theme and language really applied (html data-theme / lang);
 *   - for the error case, the error is visible and the page still fits.
 * Shots go to /tmp/e2e-shots/settings-design, named <w>-<theme>-<lang>-<page>.png,
 * for e2e/design-compare.mjs to pair with the design's own mocks.
 *
 *   node e2e/settings-design.mjs
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const OUT = '/tmp/e2e-shots/settings-design';
mkdirSync(OUT, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  ok ? (pass += 1) : (fail += 1);
  if (!ok) console.log(`FAIL ${label}`);
};
const PAGES = [
  ['hub', '/settings', 'text=Apps'],
  ['me', '/settings/me', 'input[name=fullName]'],
  ['mobile', '/settings/me/mobile', 'input[type=tel]'],
  ['business', '/settings/profile', 'form'],
  ['bills', '/settings/branding', 'form'],
  ['devices', '/settings/devices', 'main'],
  ['activity', '/settings/activity', 'main'],
  ['plan', '/settings/plan', 'main'],
  ['data', '/settings/data', 'main'],
  ['apps', '/apps', 'main'],
];

const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 320, 1280]) {
  for (const theme of ['light', 'dark']) {
    for (const lang of ['en', 'hi']) {
      const tag = `${width}-${theme}-${lang}`;
      const phone = width < 768;
      const ctx = await b.newContext({ viewport: { width, height: phone ? 844 : 900 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
      await page.goto(`${base}/login/email`);
      await page.fill('input[type=email]', 'scale@digikhaato.test');
      await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      const host = new URL(base).hostname;
      await ctx.addCookies([
        { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
        { name: 'ub_locale', value: lang, domain: host, path: '/' },
      ]);
      const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
      await ctx.request.post(`${base}/api/v1/auth/switch-app`, { headers: { 'X-CSRF-Token': csrf }, data: { app: 'shop' } });
      for (const [name, path, ready] of PAGES) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await page.locator(ready).first().waitFor({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(400);
        const facts = await page.evaluate(() => ({
          wide: document.documentElement.scrollWidth - window.innerWidth,
          theme: document.documentElement.getAttribute('data-theme'),
          lang: document.documentElement.getAttribute('lang'),
          cut: [...document.querySelectorAll('main *')]
            .filter((n) => n.children.length === 0 && n.textContent.trim() && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow === 'ellipsis')
            .map((n) => n.textContent.trim().slice(0, 30)).slice(0, 3),
          raw: [...new Set((document.querySelector('main')?.innerText ?? '').match(/\b(?:settings|tenant|plan|team|sessions|branding|audit|data|calendar|common|nav)\.[a-zA-Z]+(?:\.[a-zA-Z]+)+\b/g) ?? [])].slice(0, 3),
        }));
        check(facts.wide <= 0, `${tag} ${name}: runs ${facts.wide}px off the screen`);
        check(facts.cut.length === 0, `${tag} ${name}: words cut (${facts.cut.join(' | ')})`);
        check(facts.raw.length === 0, `${tag} ${name}: raw ids (${facts.raw.join(', ')})`);
        check(facts.theme === theme, `${tag} ${name}: theme is ${facts.theme}`);
        check(facts.lang === lang, `${tag} ${name}: language is ${facts.lang}`);
        await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true });
      }
      // After an error: an empty name refused on Your profile.
      await page.goto(`${base}/settings/me`, { waitUntil: 'networkidle' });
      await page.locator('input[name=fullName]').fill('');
      await page.locator('main button[type=submit]').first().click();
      await page.waitForTimeout(500);
      const shown = await page.locator('[aria-invalid=true]').count();
      check(shown > 0, `${tag} error: the refused name is marked`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${tag} error: the page still fits (${wide}px)`);
      await page.screenshot({ path: `${OUT}/${tag}-me-error.png`, fullPage: true });
      check(errors.length === 0, `${tag}: no page error ${errors.join(' | ')}`);
      await ctx.close();
    }
  }
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
