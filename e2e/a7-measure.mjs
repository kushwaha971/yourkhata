// A7 — tables and the count line, measured against the design's own CSS
// (docs/revamp/design/shop-fixes-and-business-types.html §A7; .tf, .countline;
// report docs/performance/2026-10-28-shop-a7-tables-count.md, T1–T9).
//
// For Customers and Suppliers at 390, 320 and 1280, light and dark, EN and HI:
//   T1  the frame: 12 px corners, a 1 px line, children clipped (the grey
//       header's corner pixel is the PAGE, not grey);
//   T2  header row: 46 px tall, 13 px / 600 words, 14 px side padding;
//   T3  cells: 10 px 14 px padding;
//   T4  ONE line between the last row and the pager;
//   T5  the count line: 13.5 px, gaps 16 px, at least 24 px tall, its words;
//   T6  while a search loads (the API held 1.5 s): the count line keeps its
//       place, its numbers are grey bars, the rows dim, the table never moves;
//   T7  no match: "0 of N customers", the count line still there, no jump;
//   T8  the figures are the API's (matches, all, to collect), with a self-test;
//   T9  no text cut, no page wider than the screen.
//
//   node e2e/a7-measure.mjs [--width=390,320,1280] [--tag=now] [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const widths = arg('width', '390,320,1024,1280').split(',').map(Number);
const tag = arg('tag', 'now');
const skew = process.argv.includes('--skew');
const only = arg('only', '');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a7';
mkdirSync(dir, { recursive: true });

const failures = [];
const fail = (k, m) => failures.push(`${k}: ${m}`);
let consoleErrors = 0;
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

/** In the page: the register's numbers, read from what is drawn. */
const inspect = () => {
  const R = (e) => e.getBoundingClientRect();
  // What the eye sees: an element's opacity times every ancestor's.
  const seen = (e) => {
    let o = 1;
    for (let x = e; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
    return String(Math.round(o * 100) / 100);
  };
  const cs = (e, k) => getComputedStyle(e)[k];
  const visible = (e) => e && R(e).width > 0 && R(e).height > 0;
  const deepest = (e) => {
    let cur = e;
    for (;;) {
      const kids = [...cur.children].filter((k) => visible(k) && k.textContent.trim());
      if (kids.length !== 1) return cur;
      cur = kids[0];
    }
  };
  const grid = document.querySelector('[data-testid=ub-grid]');
  const line = document.querySelector('[data-testid=count-line]') ?? document.querySelector('[data-testid=count-line]');
  const out = { wide: document.documentElement.scrollWidth > innerWidth + 1 };
  if (line) {
    const b = R(line);
    const firstText = [...line.querySelectorAll('*')].find((e) => visible(e) && e.children.length === 0 && e.textContent.trim()) ?? line;
    out.line = {
      top: Math.round(b.top),
      h: Math.round(b.height),
      font: cs(firstText, 'fontSize'),
      gap: cs(line, 'columnGap'),
      text: line.innerText.replace(/\s+/g, ' ').trim(),
      bars: [...line.querySelectorAll('[data-part=value]')].filter((e) => cs(e, 'color') === 'rgba(0, 0, 0, 0)').length,
      values: [...line.querySelectorAll('[data-part=value]')].length,
    };
  }
  if (!grid) return out;
  const table = grid.querySelector('table');
  out.gridTop = Math.round(R(grid).top);
  out.cut = [...grid.querySelectorAll('th, td, [role=columnheader], [role=cell], li')]
    .filter((e) => visible(e) && e.scrollWidth > e.clientWidth + 1 && cs(e, 'overflow') !== 'visible' && cs(e, 'textOverflow') === 'ellipsis')
    .map((e) => e.textContent.trim().slice(0, 24));
  if (!table) {
    const list = grid.querySelector('[role=list], ul');
    out.rowsOpacity = list ? seen(list) : null;
    out.listTop = list ? Math.round(R(list).top) : null;
    return out;
  }
  const frame = table.closest('[class*=rounded]') ?? table.parentElement;
  const th = [...table.querySelectorAll('thead th')].find((e) => R(e).width > 60 && e.textContent.trim());
  const thText = th && deepest(th);
  const td = [...table.querySelectorAll('tbody td')].find((e) => R(e).width > 60);
  const rows = [...table.querySelectorAll('tbody tr')];
  const lastTd = rows.at(-1)?.querySelector('td');
  const pager = grid.querySelector('[data-testid=ub-grid-pagination]') ?? [...grid.querySelectorAll('nav, div')].find((e) => /of \d|का/.test(e.textContent) && e.querySelector('button') && R(e).height < 80);
  out.frame = {
    radius: cs(frame, 'borderTopLeftRadius'),
    overflow: cs(frame, 'overflow'),
    border: cs(frame, 'borderTopWidth'),
    box: [Math.round(R(frame).left), Math.round(R(frame).top), Math.round(R(frame).width), Math.round(R(frame).bottom)],
  };
  out.head = th && {
    h: Math.round(R(th).height),
    font: `${cs(thText, 'fontSize')}/${cs(thText, 'fontWeight')}`,
    padL: cs(th, 'paddingLeft'),
    bg: cs(th, 'backgroundColor') === 'rgba(0, 0, 0, 0)' ? cs(th.parentElement, 'backgroundColor') : cs(th, 'backgroundColor'),
  };
  out.cell = td && { pad: `${cs(td, 'paddingTop')} ${cs(td, 'paddingLeft')}` };
  // T4: lines between the last row's bottom and the pager's top.
  let lines = 0;
  if (lastTd && pager) {
    if (parseFloat(cs(lastTd, 'borderBottomWidth')) > 0) lines += 1;
    if (parseFloat(cs(pager, 'borderTopWidth')) > 0) lines += 1;
    // anything else drawn between them (a wrapper's border)
    for (let e = pager.previousElementSibling; e; e = e.previousElementSibling) {
      if (e.contains(table)) {
        if (parseFloat(cs(e, 'borderBottomWidth')) > 0) lines += 1;
        break;
      }
    }
  }
  out.pager = pager ? { lines, inFrame: frame.contains(pager), top: Math.round(R(pager).top) } : null;
  out.rowsOpacity = table.tBodies[0] ? seen(table.tBodies[0]) : null;
  out.tableTop = Math.round(R(table).top);
  return out;
};

const signIn = async (ctx) => {
  const page = await ctx.newPage();
  let signedIn = false;
  page.on('console', (m) => {
    if (m.type() === 'error' && signedIn) {
      consoleErrors += 1;
      if (consoleErrors <= 3) console.log('console error:', m.text().slice(0, 160));
    }
  });
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  signedIn = true;
  return page;
};

const api = async (ctx, path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json());
const digits = (s) => s.replace(/[^\d]/g, '');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
for (const width of widths) {
  for (const theme of ['light', 'dark']) {
    for (const locale of ['en', 'hi']) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 800 : 860 }, colorScheme: theme });
      await ctx.addCookies([{ name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' }]);
      const page = await signIn(ctx);
      for (const kind of ['customers', 'suppliers']) {
        if (only && only !== kind) continue;
        const key = `${width}-${theme}-${locale}-${kind}`;
        try {
          await page.goto(`${base}/${kind}`, { waitUntil: 'load' });
          await page.getByTestId('ub-grid').waitFor({ timeout: 10000 });
          await page.waitForTimeout(1500);
          const r = await page.evaluate(inspect);
          await page.screenshot({ path: `${dir}/${tag}-${key}.png` });
          const desk = width >= 1024;
          if (r.wide) fail(key, 'T9 page wider than the screen');
          if (r.cut?.length) fail(key, `T9 cut text: ${r.cut.join(' | ')}`);
          if (desk) {
            if (!r.frame || r.frame.radius !== '12px' || r.frame.overflow !== 'clip' || r.frame.border !== '1px') fail(key, `T1 frame ${JSON.stringify(r.frame)}`);
            if (!r.head || !near(r.head.h, 46) || r.head.font !== '13px/600' || r.head.padL !== '14px') fail(key, `T2 header ${JSON.stringify(r.head)}`);
            if (!r.cell || r.cell.pad !== '10px 14px') fail(key, `T3 cells ${JSON.stringify(r.cell)}`);
            if (!r.pager || r.pager.lines !== 1) fail(key, `T4 lines under the table ${JSON.stringify(r.pager)}`);
          }
          if (!r.line) fail(key, 'T5 no count line');
          else {
            if (r.line.font !== '13.5px') fail(key, `T5 count line font ${r.line.font}`);
            if (r.line.h < 24) fail(key, `T5 count line ${r.line.h} px tall`);
            if (desk && r.line.gap !== '16px') fail(key, `T5 count line gap ${r.line.gap}`);
          }
          // T8: figures from the API.
          if (locale === 'en' && r.line) {
            const role = kind === 'customers' ? 'customer' : 'supplier';
            const meta = (await api(ctx, `/parties?type=${role}&book=shop&status=active&page_size=1`)).meta;
            const all = String(skew ? meta.total + 1 : meta.total);
            const want = `of ${Number(all).toLocaleString('en-IN')}`;
            if (!r.line.text.includes(want)) fail(key, `T8 count line "${r.line.text}" lacks "${want}"`);
          }
          // T6: a slow search keeps the line and the table in place.
          if (locale === 'en' && theme === 'light') {
            await page.route('**/api/v1/parties?*', async (route) => {
              const u = new URL(route.request().url());
              if (u.searchParams.get('q')) await new Promise((res) => setTimeout(res, 1500));
              await route.continue();
            });
            const before = await page.evaluate(inspect);
            const box = page.getByRole('searchbox').or(page.getByPlaceholder(/Name or mobile/)).first();
            await box.fill('sha');
            await page.waitForTimeout(700);
            const during = await page.evaluate(inspect);
            await page.screenshot({ path: `${dir}/${tag}-${key}-loading.png` });
            if (!during.line) fail(key, 'T6 the count line disappears while a search loads');
            else {
              if (before.line && !near(during.line.top, before.line.top)) fail(key, `T6 count line moved ${before.line.top} → ${during.line.top}`);
              if (!during.line.values || during.line.bars !== during.line.values) fail(key, `T6 loading look: ${during.line.bars}/${during.line.values} values greyed`);
            }
            const tTop = (x) => x.tableTop ?? x.listTop;
            if (!near(tTop(during) ?? -1, tTop(before) ?? -2)) fail(key, `T6 the rows moved ${tTop(before)} → ${tTop(during)}`);
            if (during.rowsOpacity !== '0.5') fail(key, `T6 rows opacity while loading ${during.rowsOpacity}`);
            await page.waitForTimeout(2200);
            const settled = await page.evaluate(inspect);
            const meta = (await api(ctx, `/parties?type=${kind === 'customers' ? 'customer' : 'supplier'}&book=shop&status=active&q=sha&page_size=1`)).meta;
            if (settled.line && !digits(settled.line.text).includes(String(meta.total))) fail(key, `T8 after the search "${settled.line.text}" lacks ${meta.total}`);
            // T7: no match.
            await box.fill('zzqq-no-such-name');
            await page.waitForTimeout(2600);
            const none = await page.evaluate(inspect);
            await page.screenshot({ path: `${dir}/${tag}-${key}-nomatch.png` });
            if (!none.line) fail(key, 'T7 the count line disappears with no match');
            else {
              // The "of" is the WHOLE list, read from the API without the search
              // (the first version accepted "0 of 0", which is what it showed).
              const book = (await api(ctx, `/parties?type=${kind === 'customers' ? 'customer' : 'supplier'}&book=shop&status=active&page_size=1`)).meta.total;
              const wantNone = `0 of ${book.toLocaleString('en-IN')}`;
              if (!none.line.text.includes(wantNone)) fail(key, `T7 no-match line "${none.line.text}" lacks "${wantNone}"`);
            }
            if (before.line && none.line && !near(none.line.top, before.line.top)) fail(key, `T7 count line moved ${before.line.top} → ${none.line.top}`);
            await page.unroute('**/api/v1/parties?*');
          }
          console.log(key, JSON.stringify({ line: r.line, head: r.head, cell: r.cell, pager: r.pager, frame: r.frame?.radius }));
        } catch (e) {
          fail(key, `error ${e.message.split('\n')[0]}`);
        }
      }
      await ctx.close();
    }
  }
}
// ── The other Shop registers (variant "register"): the frame, header, cells
// and the one line under the table changed for all of them, so each is
// measured too (R-DEC-30: a shared change is checked on every screen it reaches).
const REGISTERS = ['/sales/invoices', '/sales/estimates', '/payments', '/purchases/bills', '/expenses'];
for (const width of widths.filter((w) => w >= 1024)) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 } });
  const page = await signIn(ctx);
  for (const path of REGISTERS) {
    const key = `${width}-register-${path}`;
    try {
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      await page.getByTestId('ub-grid').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(inspect);
      await page.screenshot({ path: `${dir}/${tag}-${width}-register${path.replaceAll('/', '-')}.png` });
      if (r.wide) fail(key, 'T9 page wider than the screen');
      if (!r.frame && !r.head) {
        // An empty register (no rows in this shop) draws its empty state, not a
        // table; the same component is measured on the registers that have rows.
        console.log(`${key} skipped: no rows to measure`);
        continue;
      }
      if (!r.frame || r.frame.radius !== '12px' || r.frame.overflow !== 'clip') fail(key, `T1 frame ${JSON.stringify(r.frame)}`);
      if (!r.head || !near(r.head.h, 46) || r.head.font !== '13px/600' || r.head.padL !== '14px') fail(key, `T2 header ${JSON.stringify(r.head)}`);
      if (!r.cell || r.cell.pad !== '10px 14px') fail(key, `T3 cells ${JSON.stringify(r.cell)}`);
      if (r.pager && r.pager.lines !== 1) fail(key, `T4 lines under the table ${JSON.stringify(r.pager)}`);
      console.log(key, JSON.stringify({ head: r.head, cell: r.cell, pager: r.pager }));
    } catch (e) {
      fail(key, `error ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(failures.join('\n'));
console.log(`${widths.length * 8} views, ${failures.length} failures, ${consoleErrors} console errors${skew ? ' (SKEWED: failures expected)' : ''}`);
process.exit(skew ? (failures.length ? 0 : 1) : failures.length || consoleErrors ? 1 : 0);
