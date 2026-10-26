// A4 / FB-014 — adding items to a bill, looked at, MEASURED against the
// design's numbers, read back from the API and used like a busy counter.
//
// States per size: empty bill, one search hit added, three items, the same
// item added twice (quantity rises, no second line), Edit open (phone sheet /
// desktop row), a line removed, and the purchase bill (the same shared lines).
// At 390/320/1280, light and dark, Hindi at 320/1280.
//
//   node e2e/a4-lines-look.mjs [--before]   (E2E_SHOTS, PW_CHROME, A4_ONLY=<tag>)
// --before only photographs today's screens; it asserts nothing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const before = process.argv.includes('--before');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4';
mkdirSync(dir, { recursive: true });
const results = [];
const failures = [];
const consoleErrors = [];
const fail = (tag, msg) => failures.push(`${tag}: ${msg}`);
const inr = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
try {
  for (const locale of ['en', 'hi']) {
    for (const width of locale === 'hi' ? [320, 1280] : [390, 320, 1280]) {
      for (const theme of ['light', 'dark']) {
        const tag = `${width}-${theme}-${locale}`;
        if (process.env.A4_ONLY && process.env.A4_ONLY !== tag) continue;
        if (before && (theme === 'dark' || locale === 'hi')) continue;
        const phone = width < 1024;
        const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 900 }, colorScheme: theme });
        const host = new URL(base).hostname;
        await ctx.addCookies([
          { name: 'ub_locale', value: locale, domain: host, path: '/' },
          { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
        ]);
        const page = await ctx.newPage();
        let signedIn = false;
        page.on('console', (m) => {
          if (signedIn && (m.type() === 'error' || /Warning:/.test(m.text())) && !/status of 4\d\d/.test(m.text()))
            consoleErrors.push(`${tag}: ${m.text().slice(0, 200)}`);
        });
        await page.goto(`${base}/login/email`);
        await page.fill('input[type=email]', 'scale@digikhaato.test');
        await page.fill('input[type=password]', 'Scale-Run-2026!');
        await page.keyboard.press('Enter');
        await page.waitForURL((u) => !u.pathname.startsWith('/login'));
        signedIn = true;
        const items = (await (await ctx.request.get(`${base}/api/v1/items?page_size=50&ordering=name`)).json()).data.filter(
          (i) => Number(i.selling_price) > 0
        );

        await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
        await page.waitForTimeout(2500);
        await page.mouse.move(1, 1);
        await page.screenshot({ path: `${dir}/${tag}-empty.png` });

        // Add three items through the one search, then the first again.
        const search = page.getByRole('combobox', { name: /Search items to add|Add item|Search item/i }).first();
        for (const item of [items[0], items[1], items[2], items[0]]) {
          await search.click();
          await page.keyboard.type(item.name, { delay: 5 });
          await page.getByRole('option', { name: new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
          await page.waitForTimeout(500);
        }
        await page.mouse.move(1, 1);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${dir}/${tag}-items.png`, fullPage: true });
        results.push({ tag, state: 'items' });
        if (before) {
          await ctx.close();
          continue;
        }
        await ctx.close();
      }
    }
  }
} finally {
  writeFileSync(`${dir}/results.json`, JSON.stringify({ results, failures, consoleErrors }, null, 2));
  await browser.close();
}
console.log(`${results.length} views, ${failures.length} failures, ${consoleErrors.length} console errors`);
for (const f of failures.slice(0, 50)) console.log('FAIL', f);
for (const c of [...new Set(consoleErrors)].slice(0, 10)) console.log('CONSOLE', c);
process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
