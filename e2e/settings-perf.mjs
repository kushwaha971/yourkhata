/**
 * Settings and Your profile — the P0 performance figures, on the live build:
 * for each Settings page, at 390 and 1280: time to content, API requests on
 * opening (and any asked twice), long main-thread tasks, and JS heap; then the
 * requests one save makes (profile name, UPI QR switch). Budgets: content
 * under 1.5 s, no request repeated on opening, at most 1 write per save,
 * long tasks under 200 ms in total per page.
 *
 *   node e2e/settings-perf.mjs
 */
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const PAGES = [
  ['/settings', 'main a[href="/settings/me"]'],
  ['/settings/me', 'input[name=fullName]'],
  ['/settings/profile', 'form'],
  ['/settings/branding', '#bill-terms'],
  ['/settings/devices', 'main'],
  ['/settings/activity', 'main'],
  ['/settings/plan', 'main'],
  ['/settings/data', 'main'],
];
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 1280]) {
  const phone = width < 768;
  const ctx = await b.newContext({ viewport: { width, height: phone ? 844 : 900 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  // The page sign-in lands on must settle first, or its late requests are
  // counted against the first Settings page (16 Nov 2026).
  await page.waitForLoadState('networkidle');
  await page.addInitScript(() => {
    window.__long = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => { window.__long += e.duration; })).observe({ type: 'longtask', buffered: true });
  });
  let calls = [];
  page.on('request', (r) => { if (r.url().includes('/api/v1/')) calls.push(`${r.method()} ${new URL(r.url()).pathname.replace('/api/v1', '')}`); });
  for (const [path, ready] of PAGES) {
    calls = [];
    const t0 = Date.now();
    await page.goto(`${base}${path}`);
    await page.locator(ready).first().waitFor();
    const ms = Date.now() - t0;
    await page.waitForLoadState('networkidle');
    const gets = calls.filter((c) => c.startsWith('GET'));
    const twice = [...new Set(gets.filter((c, i) => gets.indexOf(c) !== i))];
    const { long, heap } = await page.evaluate(() => ({ long: Math.round(window.__long), heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e5) / 10 }));
    console.log(`     ${width} ${path}: content ${ms} ms · ${gets.length} reads (${[...new Set(gets)].join(', ')}) · long tasks ${long} ms · heap ${heap} MB`);
    check(ms < 1500, `${width} ${path}: content in ${ms} ms (< 1500)`);
    check(twice.length === 0, `${width} ${path}: no read asked twice on opening (${twice.join(', ')})`);
    check(long < 200, `${width} ${path}: long tasks ${long} ms (< 200)`);
  }
  // Requests per save.
  await page.goto(`${base}/settings/me`);
  await page.locator('input[name=fullName]').waitFor();
  const before = await page.locator('input[name=fullName]').inputValue();
  await page.locator('input[name=fullName]').fill(`${before} x`);
  calls = [];
  await page.getByRole('button', { name: 'Save' }).first().click();
  await page.getByText('Your profile is saved.').first().waitFor();
  await page.waitForLoadState('networkidle');
  const writes = calls.filter((c) => !c.startsWith('GET'));
  console.log(`     ${width} save name: ${calls.length} requests (${calls.join(', ')})`);
  check(writes.length === 1, `${width} save name: one write (${writes.length})`);
  await page.locator('input[name=fullName]').fill(before);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await page.waitForTimeout(800);
  await page.goto(`${base}/settings/branding`);
  await page.locator('#bill-terms').waitFor();
  calls = [];
  const qr = page.getByRole('switch', { name: /Show the UPI QR/ });
  await qr.click();
  await page.waitForTimeout(1500);
  const qrWrites = calls.filter((c) => !c.startsWith('GET'));
  console.log(`     ${width} UPI QR tap: ${calls.length} requests (${calls.join(', ')})`);
  check(qrWrites.length === 1, `${width} UPI QR tap: one write (${qrWrites.length})`);
  await qr.click();
  await page.waitForTimeout(1500);
  await ctx.close();
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
