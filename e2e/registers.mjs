/**
 * Revamp 09 §10.3/§10.4 — the Sales and Purchase registers on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/registers.mjs [--shots=/tmp/e2e-shots/registers]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi, for both books: no
 *    sideways scroll, no text cut, no bill number or figure broken across
 *    lines (09 §10.0's measuring check);
 *  * the figure line is the server's: bills, taxable, GST and total over the
 *    filtered set;
 *  * on a phone: a band per date whose total is the sum of that date's live
 *    bills on the server's page, cards at least 44 px tall, no table; a tap
 *    opens the row sheet with the tax breakup, and its Open reaches the bill;
 *  * from 1024: the table, no cards;
 *  * By item: a card per line, titled by the server's item name.
 * Read-only: it writes nothing.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const rupees = (text) => Number(String(text).replace(/‑/g, '-').replace(/[^\d.-]/g, ''));
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    // The desktop table may scroll sideways inside itself (allowHorizontalScroll);
    // a cell's own truncation is still a cut.
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (clamped && el.scrollHeight > el.clientHeight + 1) cut.push(`clamped:${el.textContent.trim().slice(0, 30)}`);
    if (r.right > innerWidth + 1 && !el.closest('[data-testid="ub-grid-table"]'))
      cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const broken = [];
  for (const el of document.querySelectorAll('[data-testid="register-row-number"]'))
    if (el.getClientRects().length > 1) broken.push(el.textContent.trim());
  for (const el of document.querySelectorAll('[data-testid="register-figures"] span, [data-testid="register-row"] .ds-num, [data-testid="register-band"] .ds-num')) {
    if (el.children.length) continue;
    for (const m of el.textContent.matchAll(/[-‑]?₹[\d,.]+/g)) {
      const node = el.firstChild;
      if (!node || node.nodeType !== 3) continue;
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      if (range.getClientRects().length > 1) broken.push(m[0]);
    }
  }
  const figure = (key) => document.querySelector(`[data-testid="register-figure-${key}"]`)?.textContent ?? '';
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    broken,
    figures: { bills: figure('bills'), taxable: figure('taxable'), tax: figure('tax'), total: figure('total') },
    cards: [...document.querySelectorAll('[data-testid="register-row"]')].map((c) => ({
      h: Math.round(c.getBoundingClientRect().height),
      what: c.querySelector('.line-clamp-2')?.textContent ?? '',
    })),
    table: Boolean(document.querySelector('[data-testid="ub-grid-table"]')),
    // The last column is reachable: either it fits, or the table scrolls sideways inside itself.
    lastReachable: (() => {
      const scroller = document.querySelector('[data-testid="ub-grid-table-scroller"]');
      const last = document.querySelector('[data-testid="ub-grid-table"] thead th:last-child');
      if (!scroller || !last) return null;
      const fits = last.getBoundingClientRect().right <= scroller.getBoundingClientRect().right + 1;
      return fits || getComputedStyle(scroller).overflowX === 'auto';
    })(),
    bands: [...document.querySelectorAll('[data-testid="register-band"]')].map((b) => ({
      heading: b.querySelector('h2')?.textContent,
      money: b.querySelector('h2')?.nextElementSibling?.textContent,
      rows: b.querySelectorAll('[data-testid="register-row"]').length,
    })),
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const api = (path) =>
    page.evaluate(async (path) => {
      const r = await fetch(`/api/v1${path}`);
      return { status: r.status, body: await r.json().catch(() => null) };
    }, path);
  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  // This month, or last month as well when the QA book is quiet early in a month.
  const from = `${today.slice(0, 8)}01`;
  const served = async (bookName, level) => {
    const r = await api(`/reports/${bookName}-register?date_from=${from}&date_to=${today}&page_size=100&level=${level}`);
    return { rows: r.body?.data ?? [], meta: r.body?.meta ?? {} };
  };

  const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  for (const bookName of ['sales', 'purchase']) {
    const server = await served(bookName, 'document');
    const totals = server.meta.totals ?? {};
    check(`${bookName}: the QA book has bills this month`, server.rows.length > 0, `${server.meta.total} bills`);
    for (const locale of ['en', 'hi']) {
      await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
      for (const width of [320, 360, 390, 1024, 1280]) {
        await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
        await page.goto(`${base}/reports/${bookName}-register?period=thisMonth`, { waitUntil: 'networkidle' });
        await page.getByTestId('register-figures').waitFor();
        const tag = `${bookName} ${width} ${locale}`;
        const m = await page.evaluate(measure);
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no number or figure broken across lines`, m.broken.length === 0, m.broken.join(' | '));
        if (locale === 'en' && (width === 390 || width === 1280)) {
          check(`${tag}: Bills is the server's count`, rupees(m.figures.bills) === server.meta.total, `${m.figures.bills} vs ${server.meta.total}`);
          check(`${tag}: Taxable is the server's`, near(rupees(m.figures.taxable), totals.taxable_total), `${m.figures.taxable} vs ${totals.taxable_total}`);
          check(`${tag}: GST is the server's`, near(rupees(m.figures.tax), totals.tax), `${m.figures.tax} vs ${totals.tax}`);
          check(`${tag}: Total is the server's`, near(rupees(m.figures.total), totals.grand_total), `${m.figures.total} vs ${totals.grand_total}`);
        }
        if (width < 1024) {
          check(`${tag}: cards, no table`, m.cards.length > 0 && !m.table, `${m.cards.length} cards`);
          check(`${tag}: every card is a 44 px target`, m.cards.every((c) => c.h >= 44), JSON.stringify([...new Set(m.cards.map((c) => c.h))]));
          if (locale === 'en' && width === 390) {
            check(`${tag}: one card per bill on the page`, m.cards.length === server.rows.length, `${m.cards.length} vs ${server.rows.length}`);
            const dates = [...new Set(server.rows.map((r) => r.date))];
            check(`${tag}: a band per date`, m.bands.length === dates.length, `${m.bands.length} vs ${dates.length}`);
            const wrong = m.bands.filter((band) => {
              const date = dates.find((d) => band.heading?.startsWith(dmy(d)));
              if (!date) return true;
              const sum = server.rows
                .filter((r) => r.date === date && r.status !== 'void')
                .reduce((a, r) => a + Number(r.grand_total), 0);
              const rows = server.rows.filter((r) => r.date === date).length;
              return !near(rupees(band.money.replace(/^[^₹‑-]*/, '')), sum) || band.rows !== rows;
            });
            check(`${tag}: each band's total is its live bills' on the server`, wrong.length === 0, wrong.map((b) => `${b.heading} ${b.money}`).join(' | '));
          }
        } else {
          check(`${tag}: the table, no cards`, m.table && m.cards.length === 0, `table=${m.table} cards=${m.cards.length}`);
          check(`${tag}: the last column (Due) can be reached`, m.lastReachable === true, String(m.lastReachable));
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${bookName}-${width}-${locale}.png`, fullPage: true });
      }
    }

    // The row sheet and its Open, on a phone.
    await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${base}/reports/${bookName}-register?period=thisMonth`, { waitUntil: 'networkidle' });
    const first = server.rows[0];
    await page.getByTestId('register-row').first().click();
    const sheet = page.getByTestId('register-row-sheet');
    await sheet.waitFor();
    const text = await sheet.innerText();
    check(`${bookName}: the sheet names the bill`, text.includes(first.number), first.number);
    check(`${bookName}: the sheet carries the tax breakup`, ['Taxable', 'CGST', 'SGST', 'IGST', 'Place of supply'].every((w) => text.includes(w)), text.replace(/\n/g, ' ').slice(0, 120));
    check(`${bookName}: the sheet's total is the server's`, text.includes(Number(first.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })), first.grand_total);
    if (bookName === 'purchase') check('purchase: the sheet shows the supplier’s bill', text.includes('Supplier’s bill'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${bookName}-sheet-390.png` });
    await page.getByRole('link', { name: `Open ${first.number}` }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/reports'), { timeout: 15000 }).catch(() => undefined);
    await page.getByText(first.number).first().waitFor({ timeout: 15000 }).catch(() => undefined);
    check(`${bookName}: Open reaches the bill`, !page.url().includes('/reports') && (await page.getByText(first.number).count()) > 0, page.url());

    // By item.
    const lines = await served(bookName, 'line');
    await page.goto(`${base}/reports/${bookName}-register?period=thisMonth&level=line`, { waitUntil: 'networkidle' });
    await page.getByTestId('register-figures').waitFor();
    const lm = await page.evaluate(measure);
    check(`${bookName} by item: a card per line`, lm.cards.length === lines.rows.length, `${lm.cards.length} vs ${lines.rows.length}`);
    check(`${bookName} by item: titled by the server's item names`, lm.cards.every((c, i) => c.what === (lines.rows[i]?.item_name || '—')), `${lm.cards[0]?.what} vs ${lines.rows[0]?.item_name}`);
    check(`${bookName} by item 390: nothing cut, no sideways scroll`, lm.cut.length === 0 && lm.overflow <= 0, lm.cut.join(' | '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${bookName}-lines-390.png`, fullPage: true });
  }
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
