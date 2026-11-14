/**
 * Revamp 09 §10.5 — the GST summary on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/gst-summary.mjs [--shots=/tmp/e2e-shots/gst-summary]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi, on each of GSTR-1,
 *    GSTR-3B and Details for last month: no sideways scroll, no text cut, no
 *    figure broken across lines (09 §10.0's measuring check);
 *  * the figure line is the server's: net to pay, output GST, input GST, and
 *    taxable sales, net first;
 *  * on a phone: section rows are cards (no grid cards, no table) whose
 *    taxable values are the server's; the 3B boxes are a stacked list;
 *  * from 1024: tables, the official 3B grid, and every table's last column
 *    reachable;
 *  * the JSON download: labelled, "For the GST offline tool", downloads for
 *    last month; disabled with "Available after the month closes" for this one;
 *  * a sales-by-rate row opens the register lines behind it.
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

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    if (el.closest('[data-testid="ub-grid-table-scroller"]')) {
      // Inside a table that scrolls sideways a cell may sit past the edge; it
      // must still not be cut within its own box.
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflow !== 'visible')
        cut.push(el.textContent.trim().slice(0, 30));
      continue;
    }
    const s = getComputedStyle(el);
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (clamped && el.scrollHeight > el.clientHeight + 1) cut.push(`clamped:${el.textContent.trim().slice(0, 30)}`);
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const broken = [];
  for (const el of document.querySelectorAll('[data-testid="gst-figures"] span, [data-testid$="-row"] .ds-num')) {
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
  const figure = (key) => document.querySelector(`[data-testid="gst-figure-${key}"]`)?.textContent ?? '';
  const scrollers = [...document.querySelectorAll('[data-testid="ub-grid-table-scroller"]')];
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    broken,
    order: [...document.querySelectorAll('[data-testid^="gst-figure-"]')].map((el) => el.dataset.testid.slice(11)),
    figures: { net: figure('net'), output: figure('output'), itc: figure('itc'), taxable: figure('taxable') },
    natureCards: [...document.querySelectorAll('[data-testid="gst-nature-row"]')].map((c) => c.textContent),
    rows: document.querySelectorAll('[data-testid$="-row"]').length,
    gridCards: document.querySelectorAll('[data-testid="ub-grid-cards"]').length,
    tables: document.querySelectorAll('[data-testid="ub-grid-table"]').length,
    boxes: document.querySelectorAll('[data-testid="gstr3b-box"]').length,
    grid3b: Boolean(document.querySelector('[data-testid="gstr3b-grid"] [data-testid="ub-grid-table"]')),
    unreachable: scrollers.filter((sc) => {
      const last = sc.querySelector('thead th:last-child');
      if (!last) return false;
      const fits = last.getBoundingClientRect().right <= sc.getBoundingClientRect().right + 1;
      return !fits && getComputedStyle(sc).overflowX !== 'auto';
    }).length,
    json: document.querySelector('[data-testid="gst-json"]')?.textContent ?? null,
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const first = new Date(`${today.slice(0, 8)}01T00:00:00Z`);
  const lastEnd = new Date(first.getTime() - 86_400_000).toISOString().slice(0, 10);
  const lastFrom = `${lastEnd.slice(0, 8)}01`;
  const served = await page.evaluate(async ([from, to]) => {
    const r = await fetch(`/api/v1/reports/gst-summary?date_from=${from}&date_to=${to}`);
    const body = await r.json();
    return { ...body.data, meta: body.meta };
  }, [lastFrom, lastEnd]);
  const net = served?.gstr3b?.net_payable ?? {};
  check('the QA book has last month\'s GST', Number(served?.meta?.document_count) > 0, `${served?.meta?.document_count} documents`);

  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      for (const view of ['gstr1', 'gstr3b', 'details']) {
        await page.goto(`${base}/reports/gst-summary?period=lastMonth&view=${view}`, { waitUntil: 'networkidle' });
        await page.getByTestId('gst-figures').waitFor();
        const tag = `${width} ${locale} ${view}`;
        const m = await page.evaluate(measure);
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no figure broken across lines`, m.broken.length === 0, m.broken.join(' | '));
        if (view === 'gstr1' && locale === 'en' && (width === 390 || width === 1280)) {
          check(`${tag}: net to pay first`, m.order.join(',') === 'net,output,itc,taxable', m.order.join(','));
          check(`${tag}: net is the server's`, near(rupees(m.figures.net), Math.abs(Number(net.total))), `${m.figures.net} vs ${net.total}`);
          check(`${tag}: output GST is the server's`, near(rupees(m.figures.output), net.output_tax), `${m.figures.output} vs ${net.output_tax}`);
          check(`${tag}: input GST is the server's`, near(rupees(m.figures.itc), net.itc), `${m.figures.itc} vs ${net.itc}`);
          check(`${tag}: taxable sales is the server's`, near(rupees(m.figures.taxable), served.outward.by_rate.total.taxable_value), `${m.figures.taxable} vs ${served.outward.by_rate.total.taxable_value}`);
        }
        if (width < 1024) {
          check(`${tag}: cards, no grid cards, no table`, m.gridCards === 0 && m.tables === 0 && (view === 'gstr3b' ? m.boxes > 0 : m.rows > 0), `rows=${m.rows} boxes=${m.boxes} grid=${m.gridCards} tables=${m.tables}`);
          if (view === 'gstr1' && locale === 'en' && width === 390) {
            const applicable = served.outward.by_nature.rows.filter((r) => r.applicable);
            const wrong = applicable.filter((r) => !m.natureCards.some((c) => c.includes(`GSTR-1 · ${r.gstr1_table}`) && c.includes(Number(r.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 }))));
            check(`${tag}: each sales-by-type card carries the server's taxable value`, wrong.length === 0, wrong.map((r) => r.nature).join(','));
            check(`${tag}: the JSON download is labelled for the offline tool`, m.json?.includes('Download GSTR-1 JSON') && m.json.includes('For the GST offline tool'), m.json);
          }
        } else {
          check(`${tag}: tables, every last column reachable`, m.tables > 0 && m.unreachable === 0, `tables=${m.tables} unreachable=${m.unreachable}`);
          if (view === 'gstr3b') check(`${tag}: the official 3B grid`, m.grid3b && m.boxes === 0, `grid=${m.grid3b} boxes=${m.boxes}`);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${view}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }

  // The file: last month downloads, this month says why not.
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/reports/gst-summary?period=lastMonth&view=gstr1`, { waitUntil: 'networkidle' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
    page.getByRole('button', { name: 'Download GSTR-1 JSON' }).click(),
  ]);
  check('last month: the GSTR-1 file downloads', Boolean(download), download?.suggestedFilename() ?? 'no download');
  await page.goto(`${base}/reports/gst-summary?period=thisMonth&view=gstr3b`, { waitUntil: 'networkidle' });
  await page.getByTestId('gst-json').waitFor();
  const button = page.getByRole('button', { name: 'Download GSTR-3B JSON' });
  check('this month: the file is not offered yet, and says why', (await button.isDisabled()) && (await page.getByTestId('gst-json').innerText()).includes('Available after the month closes'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/json-open-month-390.png`, fullPage: true });

  // A sales-by-rate row opens the register lines behind it.
  await page.goto(`${base}/reports/gst-summary?period=lastMonth&view=details`, { waitUntil: 'networkidle' });
  await page.getByTestId('gst-outward-row').first().click();
  await page.waitForURL((u) => u.pathname.includes('sales-register'), { timeout: 15000 }).catch(() => undefined);
  check('a rate row opens the register lines behind it', page.url().includes('sales-register') && page.url().includes('level=line'), page.url());
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
