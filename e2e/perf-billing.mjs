/**
 * The bill editor under a busy counter's load, on the live LOCAL QA stack:
 * thirty different items added through the search, timed from Enter to the
 * line on screen, and the slowest input event (INP-style, from the browser's
 * own Event Timing) while picking and while typing a quantity on a long bill.
 *
 *   NODE_PATH=$(npm root -g) node e2e/perf-billing.mjs [--lines=30]
 *
 * A phone is 390 px with the CPU slowed 4x (a mid-range Android); a laptop is
 * 1280 px unthrottled. Writes: drafts on the local QA tenant, deleted at the
 * end. Nothing is issued and nothing is sent.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const LINES = Number(arg('lines', '30'));
const out = `${process.env.E2E_SHOTS ?? '/tmp/claude-0'}/perf-billing-${new Date().toISOString().slice(0, 10)}.json`;

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const drafts = new Set();
const report = { lines: LINES, runs: [] };
let auth;
let csrf;
const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const p95 = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(0.95 * (s.length - 1))] : null;
};
try {
  auth = await browser.newContext();
  const p = await auth.newPage();
  await p.goto(`${base}/login/email`);
  await p.fill('input[type=email]', 'scale@digikhaato.test');
  await p.fill('input[type=password]', 'Scale-Run-2026!');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  csrf = (await auth.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const items = (await (await auth.request.get(`${base}/api/v1/items?status=active&page_size=60`)).json()).data
    .map((x) => x.name)
    .filter((name, i, all) => all.findIndex((y) => y.startsWith(name) || name.startsWith(y)) === i)
    .slice(0, LINES);
  if (items.length < LINES) throw Error(`only ${items.length} distinct items on the QA tenant`);
  const storageState = await auth.storageState();

  for (const { width, cpu } of [
    { width: 390, cpu: 4 },
    { width: 1280, cpu: 1 },
  ]) {
    const ctx = await browser.newContext({
      storageState,
      viewport: { width, height: width < 768 ? 844 : 900 },
      deviceScaleFactor: width < 768 ? 2 : 1,
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    const page = await ctx.newPage();
    page.on('response', (r) => {
      const path = new URL(r.url()).pathname;
      const m = /\/api\/v1\/sales\/invoices\/([0-9a-f-]{36})$/.exec(path);
      if (m && r.request().method() !== 'DELETE') drafts.add(m[1]);
      if (/\/api\/v1\/sales\/invoices$/.test(path) && r.request().method() === 'POST')
        r.json().then((b) => b?.data?.id && drafts.add(b.data.id), () => undefined);
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__events = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__events.push({ name: e.name, duration: e.duration, phase: window.__phase });
      }).observe({ type: 'event', durationThreshold: 16, buffered: false });
    });
    const search = page.getByRole('combobox', { name: 'Search items to add' });
    // The docked caption counts the bill's items ("12 items · includes GST"):
    // collapsed phone cards draw no cells to count.
    const named = () =>
      page.evaluate(() => Number(/^(\d+)/.exec(document.querySelector('[data-testid="total-dock-caption"]')?.textContent ?? '')?.[1] ?? 0));
    const picks = [];
    // Enter on a list that still answers an earlier term is the scanner's
    // path: a lookup round trip, not a pick. Counted so a timing is read right.
    let lookups = 0;
    page.on('request', (r) => {
      if (/\/items\/lookup/.test(r.url())) lookups += 1;
    });
    await page.evaluate(() => (window.__phase = 'pick'));
    for (const [i, name] of items.entries()) {
      await page.evaluate(() => (window.__phase = 'type'));
      await search.click();
      await search.fill(name);
      await page.getByRole('option', { selected: true }).first().waitFor();
      const before = await named();
      await page.evaluate(() => (window.__phase = 'pick'));
      const t0 = Date.now();
      await page.keyboard.press('Enter');
      const drawn = await page
        .waitForFunction(
          (n) => Number(/^(\d+)/.exec(document.querySelector('[data-testid="total-dock-caption"]')?.textContent ?? '')?.[1] ?? 0) > n,
          before,
          { polling: 'raf', timeout: 8000 }
        )
        .then(() => true, () => false);
      if (drawn) picks.push(Date.now() - t0);
      else console.log(`  pick ${i + 1} (${name}) did not add a line`);
    }
    // Typing a quantity on the last line of the long bill.
    await page.evaluate(() => (window.__phase = 'qty'));
    const qty = page.locator(`[data-line-cell][data-row="${items.length - 1}"][data-col="1"] input`);
    await qty.click();
    await qty.press('Control+a');
    await page.keyboard.type('125', { delay: 120 });
    await page.waitForTimeout(800);
    const events = await page.evaluate(() => window.__events);
    const worst = (phase) => Math.max(0, ...events.filter((e) => e.phase === phase).map((e) => e.duration));
    const run = {
      width,
      cpu,
      picks,
      pickMedian: median(picks),
      pickP95: p95(picks),
      lastFivePickMedian: median(picks.slice(-5)),
      slowestEventWhilePicking: worst('pick'),
      slowestEventTypingSearch: worst('type'),
      enterEvents: events.filter((e) => e.phase === 'pick' && e.name === 'keydown').map((e) => e.duration),
      slowestEventTypingQty: worst('qty'),
      linesOnBill: await named(),
      lookups,
      events,
    };
    report.runs.push(run);
    console.log(
      `${width}px cpu x${cpu}: Enter→line median ${run.pickMedian} ms, p95 ${run.pickP95}, last five ${run.lastFivePickMedian}; slowest event picking ${run.slowestEventWhilePicking} ms (Enter median ${median(run.enterEvents)}), typing the search ${run.slowestEventTypingSearch} ms, typing Qty ${run.slowestEventTypingQty} ms; ${run.linesOnBill} lines, ${run.lookups} scanner lookups`
    );
    await ctx.close();
  }
} finally {
  for (const id of drafts) {
    await auth?.request
      .delete(`${base}/api/v1/sales/invoices/${id}`, { headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() } })
      .catch(() => undefined);
  }
  writeFileSync(out, JSON.stringify(report, null, 2));
  await browser.close();
}
