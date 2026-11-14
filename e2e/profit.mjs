/**
 * Revamp 09 §10.6 — the Profit report on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/profit.mjs [--shots=/tmp/e2e-shots/profit]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi, by item and by
 *    bill: no sideways scroll, no text cut, no figure broken across lines;
 *  * the figure line is the server's: sales, cost, profit, margin; the expenses
 *    line too;
 *  * on a phone: one card per server row on the page, each 44 px or more, its
 *    "Sold" and profit the server's, a loss said in words; the pager; no table;
 *  * from 1024: the table, no cards;
 *  * a card opens the row sheet, and its Open reaches the item or the bill;
 *  * the phone search asks the server and keeps its input.
 * Read-only: it writes nothing.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
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
const inr = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (clamped && el.scrollHeight > el.clientHeight + 1) cut.push(`clamped:${el.textContent.trim().slice(0, 30)}`);
    if (r.right > innerWidth + 1 && !el.closest('[data-testid="ub-grid-table-scroller"]'))
      cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const broken = [];
  for (const el of document.querySelectorAll('[data-testid="profit-figures"] span, [data-testid="profit-row"] span')) {
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
  const figure = (key) => document.querySelector(`[data-testid="profit-figure-${key}"]`)?.textContent ?? '';
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    broken,
    figures: { sales: figure('sales'), cost: figure('cost'), profit: figure('profit'), margin: figure('margin') },
    after: document.querySelector('[data-testid="profit-after-expenses"]')?.textContent ?? null,
    cards: [...document.querySelectorAll('[data-testid="profit-row"]')].map((c) => ({
      h: Math.round(c.getBoundingClientRect().height),
      label: c.getAttribute('aria-label'),
    })),
    table: Boolean(document.querySelector('[data-testid="ub-grid-table"]')),
    pager: /Page 1 of|पेज 1/.test(document.querySelector('main')?.textContent ?? ''),
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

  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const from = `${today.slice(0, 8)}01`;
  const served = (group) =>
    page.evaluate(async ([g, f, to]) => {
      const r = await fetch(`/api/v1/reports/profit?group=${g}&date_from=${f}&date_to=${to}&ordering=-profit`);
      return r.json();
    }, [group, from, today]);
  const item = await served('item');
  const totals = item.meta.totals;
  check('the QA book has profit this month', item.data.length > 0, `${item.meta.total} items`);

  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      for (const by of ['item', 'bill']) {
        await page.goto(`${base}/reports/profit?period=thisMonth${by === 'bill' ? '&by=bill' : ''}`, { waitUntil: 'networkidle' });
        await page.getByTestId('profit-figures').waitFor();
        const tag = `${width} ${locale} by ${by}`;
        const m = await page.evaluate(measure);
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no figure broken across lines`, m.broken.length === 0, m.broken.join(' | '));
        if (by === 'item' && locale === 'en' && (width === 390 || width === 1280)) {
          check(`${tag}: Sales is the server's`, near(rupees(m.figures.sales.replace(/\d+ bills?$/, '')), totals.sale_value), `${m.figures.sales} vs ${totals.sale_value}`);
          check(`${tag}: Cost is the server's`, near(rupees(m.figures.cost), totals.cost), `${m.figures.cost} vs ${totals.cost}`);
          check(`${tag}: Profit is the server's`, near(rupees(m.figures.profit), Math.abs(Number(totals.profit))), `${m.figures.profit} vs ${totals.profit}`);
          check(`${tag}: Margin is the server's`, m.figures.margin.includes(`${totals.margin_pct}%`), `${m.figures.margin} vs ${totals.margin_pct}`);
          if (totals.expenses !== null)
            check(`${tag}: after expenses is the server's`, m.after?.includes(inr(totals.expenses)) && m.after.includes(inr(Math.abs(Number(totals.net_profit)))), m.after);
        }
        if (width < 1024) {
          check(`${tag}: cards, no table`, m.cards.length > 0 && !m.table, `${m.cards.length} cards`);
          check(`${tag}: every card is a 44 px target`, m.cards.every((c) => c.h >= 44), JSON.stringify([...new Set(m.cards.map((c) => c.h))]));
          if (by === 'item' && locale === 'en' && width === 390) {
            check(`${tag}: one card per server row`, m.cards.length === item.data.length, `${m.cards.length} vs ${item.data.length}`);
            const wrong = item.data.filter((r, i) => {
              const label = m.cards[i]?.label ?? '';
              const loss = String(r.profit).startsWith('-');
              const word = r.profit === null ? 'Cost not known' : `${loss ? 'Loss' : 'Profit'} ₹${inr(Math.abs(Number(r.profit)))}`;
              return !label.includes(`Sold ₹${inr(r.sale_value)}`) || !label.includes(word);
            });
            check(`${tag}: every card's Sold and Profit/Loss are the server's`, wrong.length === 0, wrong.slice(0, 3).map((r) => r.name).join(', '));
            check(`${tag}: a pager under the cards`, item.meta.total_pages <= 1 || m.pager, String(item.meta.total_pages));
          }
        } else {
          check(`${tag}: the table, no cards`, m.table && m.cards.length === 0, `table=${m.table} cards=${m.cards.length}`);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${by}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }

  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/reports/profit?period=thisMonth`, { waitUntil: 'networkidle' });
  const first = item.data[0];
  await page.getByTestId('profit-row').first().click();
  const sheet = page.getByTestId('profit-row-sheet');
  await sheet.waitFor();
  const text = await sheet.innerText();
  check('the sheet carries sales, cost, profit and margin', [inr(first.sale_value), inr(first.cost), inr(Math.abs(Number(first.profit))), `${first.margin_pct}%`].every((v) => text.includes(v)), text.replace(/\n/g, ' ').slice(0, 140));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sheet-390.png` });
  await page.getByRole('link', { name: `Open ${first.name}` }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/items/'), { timeout: 15000 }).catch(() => undefined);
  check('Open reaches the item', page.url().includes(`/items/${first.id}`), page.url());

  // Search on a phone: asks the server, keeps the input focused.
  await page.goto(`${base}/reports/profit?period=thisMonth`, { waitUntil: 'networkidle' });
  const word = first.name.split(' ')[0];
  const box = page.getByPlaceholder('Search items');
  await box.fill(word);
  await page.waitForURL((u) => u.searchParams.get('q') === word, { timeout: 10000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('profit-row').first().waitFor({ timeout: 15000 }).catch(() => undefined);
  const labels = await page.getByTestId('profit-row').evaluateAll((cs) => cs.map((c) => c.getAttribute('aria-label')));
  check('the phone search asks the server', new URL(page.url()).searchParams.get('q') === word && labels.length > 0 && labels.every((l) => l.toLowerCase().includes(word.toLowerCase())), `${labels.length} cards for "${word}"`);
  check('the search box keeps focus', await box.evaluate((el) => el === document.activeElement));
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
