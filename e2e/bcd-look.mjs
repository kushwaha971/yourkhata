/**
 * Shop round (11 Nov 2026) — the B/C/D screens that had no Hindi or dark
 * check: Stock count, Find by IMEI, Print labels and Expiry, each in the shop
 * kind that has it, at 320/390/1280 × light/dark × English/Hindi.
 *
 * Measures, does not read: sideways scroll, a text node wider than its box,
 * a raw message key on screen, and that a "dark" case really drew dark (H37:
 * the theme is the person's `ub_theme_choice`, not the browser's scheme).
 *
 *   node e2e/bcd-look.mjs [--shots=/tmp/e2e-shots/bcd-look]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const shops = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8'));
const SCREENS = [
  { name: 'count', path: '/stock/count', shop: 'kirana' },
  { name: 'imei', path: '/items/imei', shop: 'mobile' },
  { name: 'labels', path: '/items/labels', shop: 'garments' },
  { name: 'expiry', path: '/stock/expiry', shop: 'medical' },
];
const RAW = /\b(common|sales|stock|items|inventory|reports)\.[a-z][A-Za-z]+\.[A-Za-z.]+/;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    // A screen-reader-only label is a 1 px box by design, not cut text.
    if (el.clientWidth <= 1 || el.closest('.sr-only')) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis')
      cut.push(el.textContent.trim().slice(0, 30));
    const r = el.getBoundingClientRect();
    // Past the edge inside a row that scrolls sideways (the owner's phone
    // toolbar, Expiry's chip row) is reachable; anywhere else it is lost.
    let reachable = false;
    for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
      const o = getComputedStyle(up).overflowX;
      if ((o === 'auto' || o === 'scroll') && up.scrollWidth > up.clientWidth) { reachable = true; break; }
    }
    if (r.width > 1 && r.right > innerWidth + 1 && !reachable) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    text: document.querySelector('main')?.innerText ?? '',
    theme: document.documentElement.dataset.theme,
    bgLight: (bg[0] + bg[1] + bg[2]) / 3,
  };
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const screen of SCREENS) {
    const shop = shops[screen.shop];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    for (const theme of ['light', 'dark']) {
      for (const locale of ['en', 'hi']) {
        await ctx.addCookies([
          { name: 'ub_theme_choice', value: theme, url: base },
          { name: 'ub_locale', value: locale, url: base },
        ]);
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: width >= 1024 ? 860 : 780 });
          await page.goto(`${base}${screen.path}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(400);
          // H65: a check against a not-found page proves nothing.
          check(`${screen.name} ${width} ${theme} ${locale}: the screen opened`, new URL(page.url()).pathname === screen.path && !/404|could not find that page/i.test(await page.locator('main').innerText().catch(() => '404')));
          const tag = `${screen.name} ${width} ${theme} ${locale}`;
          const m = await page.evaluate(measure);
          check(`${tag}: the page drew ${theme}`, m.theme === theme && (theme === 'dark' ? m.bgLight < 80 : m.bgLight > 200), `${m.theme} body ${Math.round(m.bgLight)}`);
          check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
          check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
          check(`${tag}: no raw message key`, !RAW.test(m.text), m.text.match(RAW)?.[0]);
          if (locale === 'hi') check(`${tag}: Hindi on screen`, /[ऀ-ॿ]/.test(m.text));
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/${screen.name}-${width}-${theme}-${locale}.png`, fullPage: true });
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
