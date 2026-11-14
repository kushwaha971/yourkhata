/**
 * Shop round (11 Nov 2026) — the design pass the round scored 0: every Shop
 * screen every kind has, plus the bill and purchase editors, at 320/390/1280 ×
 * light/dark × English/Hindi, and AFTER AN ERROR (the screen's data requests
 * answered 500) at 390/1280 in both languages.
 *
 * Measures, does not read: the page opened (not a 404, H65), the theme really
 * drew (H37), no sideways scroll, no text cut or pushed off screen except
 * inside a row that scrolls, no raw message key, Hindi on screen in Hindi —
 * and in the error case, that the screen SAYS so in the person's language
 * instead of showing an empty page or zeros as if they were true.
 *
 *   node e2e/shop-look.mjs [--shots=/tmp/e2e-shots/shop-look] [--only=/items,/payments]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '');
const ONLY = arg('only', '');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
// Money book round (11 Nov): `--app=khata` sweeps the Money book (list, a person,
// their statement) as the scale owner, whose private book has people in it.
const MONEY_BOOK = arg('app', '') === 'khata';
// Library round (12 Nov): `--app=library` sweeps every Members & Fees screen as the
// scale owner, whose business has the design's room seeded (e2e/library_seed.py).
const LIBRARY = arg('app', '') === 'library';
// Lending round (12 Nov): `--app=lending` sweeps every Loans & Collections screen (e2e/lending_seed.py).
const LENDING = arg('app', '') === 'lending';
const shop = MONEY_BOOK || LIBRARY || LENDING
  ? { email: 'scale@digikhaato.test', password: process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!' }
  : JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).kirana;
const ALL = [
  '/dashboard', '/sales/invoices', '/sales/invoices/new', '/sales/estimates', '/customers', '/suppliers',
  '/items', '/stock/summary', '/stock/low', '/stock/count', '/stock/transfer',
  '/purchases/bills', '/purchases/bills/new', '/purchases/orders', '/payments', '/expenses',
  '/reports', '/reports/day-book', '/reports/aging', '/reports/sales-register',
  '/reports/purchase-register', '/reports/gst-summary', '/reports/profit',
];
let SCREENS = ONLY ? ONLY.split(',') : ALL;
const RAW = /\b(lending|library|common|sales|stock|items|inventory|reports|payments|purchases|parties|expenses|shell|ledger)\.[a-z][A-Za-z]+\.[A-Za-z.]+/;
// The requests that keep a person signed in and the shell drawn; everything
// else is "the screen's data", which the error case answers with a 500.
const SHELL_API = /\/api\/v1\/(auth|tenants|notifications|session|me\b|onboarding|platform|apps|business)/;
const ERROR_WORDS = /could not load|went wrong|try again|लोड नहीं|गड़बड़|फिर से/i;
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
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    if (MONEY_BOOK) {
      const person = (await (await ctx.request.get(`${base}/api/v1/moneybook/people?balance=get&page_size=1`)).json()).data[0];
      SCREENS = ['/money-book', `/money-book/${person.id}`, '/money-book/report', '/money-book/reminders', '/money-book/old-dues'];
    }
    if (LIBRARY) {
      const late = (await (await ctx.request.get(`${base}/api/v1/library/students?fee=over&page_size=1`)).json()).data[0];
      SCREENS = ['/library', '/library/seats', '/library/students', `/library/students/${late.id}`, '/library/fees',
        '/library/counter', '/library/attendance', '/library/messages', '/library/money', '/library/expenses',
        '/library/books', '/library/settings'];
    }
    if (LENDING) {
      const loan = (await (await ctx.request.get(`${base}/api/v1/lending/remind?kind=late`)).json()).data[0];
      const b = (await (await ctx.request.get(`${base}/api/v1/lending/borrowers`)).json()).data[0];
      SCREENS = ['/lending', '/lending/loans', `/lending/loans/${loan.id}`, '/lending/loans/new', '/lending/borrowers',
        `/lending/borrowers/${b.id}`, '/lending/routes', '/lending/messages', '/lending/settings'];
    }
    const cases = [];
    for (const theme of ['light', 'dark'])
      for (const locale of ['en', 'hi'])
        for (const width of [320, 390, 1280]) cases.push({ theme, locale, width, error: false });
    for (const locale of ['en', 'hi'])
      for (const width of [390, 1280]) cases.push({ theme: 'light', locale, width, error: true });
    for (const path of SCREENS) {
      const screen = { name: path, path };
      for (const { theme, locale, width, error } of cases) {
        await ctx.addCookies([
          { name: 'ub_theme_choice', value: theme, url: base },
          { name: 'ub_locale', value: locale, url: base },
        ]);
        if (error)
          await page.route('**/api/v1/**', (route) =>
            route.request().method() === 'GET' && !SHELL_API.test(route.request().url())
              ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'server_error', message: 'Something went wrong.', details: {} } }) })
              : route.continue()
          );
        await page.setViewportSize({ width, height: width >= 1024 ? 860 : 780 });
        await page.goto(`${base}${screen.path}`, { waitUntil: 'networkidle' }).catch(() => undefined);
        await page.waitForTimeout(error ? 1200 : 400);
        const tag = `${screen.name} ${width} ${theme} ${locale}${error ? ' ERROR' : ''}`;
        // H65: a check against a not-found page proves nothing.
        check(`${tag}: the screen opened`, new URL(page.url()).pathname === screen.path && !/could not find that page/i.test(await page.locator('main').innerText().catch(() => 'could not find that page')));
        const m = await page.evaluate(measure);
        check(`${tag}: the page drew ${theme}`, m.theme === theme && (theme === 'dark' ? m.bgLight < 80 : m.bgLight > 200), `${m.theme} body ${Math.round(m.bgLight)}`);
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no raw message key`, !RAW.test(m.text), m.text.match(RAW)?.[0]);
        if (locale === 'hi') check(`${tag}: Hindi on screen`, /[\u0900-\u097F]/.test(m.text));
        // /reports is a fixed menu that loads no data, so it has nothing to fail.
        if (error && screen.path !== '/reports') {
          const toasts = await page.locator('[role=alert],[role=status]').allInnerTexts();
          const said = ERROR_WORDS.test(m.text) || toasts.some((x) => ERROR_WORDS.test(x));
          check(`${tag}: the screen says it could not load`, said, m.text.replace(/\s+/g, ' ').slice(0, 90));
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${screen.name.replace(/\//g, '_')}-${width}-${theme}-${locale}${error ? '-error' : ''}.png`, fullPage: true });
        if (error) await page.unroute('**/api/v1/**');
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
