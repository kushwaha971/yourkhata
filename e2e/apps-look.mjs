/**
 * Apps round (16 Nov 2026) — every top-level screen of Library, Lending and the
 * Money book at 320/390/1280 × light/dark × English/Hindi, for the QA owner.
 * Measures: sideways scroll, text wider than its box, raw message keys, Hindi
 * on screen, and that dark really drew dark. Copied from bcd-look.mjs.
 *
 *   node e2e/apps-look.mjs [--shots=/tmp/e2e-shots/apps-look]
 */
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const APPS = {
  library: ['/library', '/library/students', '/library/seats', '/library/fees', '/library/attendance', '/library/messages', '/library/money', '/library/expenses', '/library/books', '/library/counter', '/library/settings'],
  lending: ['/lending', '/lending/borrowers', '/lending/loans', '/lending/loans/new', '/lending/messages', '/lending/routes', '/lending/settings'],
  khata: ['/money-book', '/money-book/reminders', '/money-book/report', '/money-book/old-dues'],
};
const RAW = /\b(common|library|lending|moneybook|khata|ledger|tenant|nav|settings)\.[a-z][A-Za-z]+\.[A-Za-z.]+/;

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
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = async () => (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  for (const [app, paths] of Object.entries(APPS)) {
    await ctx.request.post(`${base}/api/v1/auth/switch-app`, { data: { app }, headers: { 'X-CSRF-Token': await csrf() } });
    for (const path of paths) {
      for (const theme of ['light', 'dark']) {
        for (const locale of ['en', 'hi']) {
          await ctx.addCookies([
            { name: 'ub_theme_choice', value: theme, url: base },
            { name: 'ub_locale', value: locale, url: base },
          ]);
          for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: width >= 1024 ? 860 : 780 });
            await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(400);
            const tag = `${path} ${width} ${theme} ${locale}`;
            check(`${tag}: the screen opened`, new URL(page.url()).pathname === path && !/could not find that page/i.test(await page.locator('main').innerText().catch(() => '404')), new URL(page.url()).pathname);
            const m = await page.evaluate(measure);
            check(`${tag}: drew ${theme}`, m.theme === theme && (theme === 'dark' ? m.bgLight < 80 : m.bgLight > 200), `${m.theme} body ${Math.round(m.bgLight)}`);
            check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
            check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
            check(`${tag}: no raw message key`, !RAW.test(m.text), m.text.match(RAW)?.[0]);
            if (locale === 'hi') check(`${tag}: Hindi on screen`, /[\u0900-\u097F]/.test(m.text));
            if (SHOTS) await page.screenshot({ path: `${SHOTS}/${path.slice(1).replaceAll('/', '_')}-${width}-${theme}-${locale}.png`, fullPage: true });
          }
        }
      }
    }
  }
  await ctx.close();
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
