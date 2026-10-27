/** §5 Purchase register: real read journeys, explicit UI fixtures and measured viewport scrolling. Local QA only. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { measureCustomers } from './revamp-customers.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const locale = arg('locale', 'en'),
  out = arg('out', '/tmp/e2e-shots/revamp/purchase-register'),
  baseline = process.argv.includes('--baseline');
mkdirSync(out, { recursive: true });
const copy = JSON.parse(
  readFileSync(new URL(`../frontend/locales/${locale}.json`, import.meta.url), 'utf8')
);
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const captureStates=arg('states','').split(',').filter(Boolean);
const results = [],
  failures = [];
try {
  const auth = await browser.newContext();
  const login = await auth.newPage();
  await login.goto(`${base}/login/email`);
  await login.fill('input[type=email]', 'scale@digikhaato.test');
  await login.fill('input[type=password]', 'Scale-Run-2026!');
  await login.click('button[type=submit]');
  await login.waitForURL((u) => !u.pathname.startsWith('/login'));
  const storageState = await auth.storageState();
  await auth.close();
  for (const width of arg('widths', '390,320,1024,1280').split(',').map(Number))
    for (const theme of ['light', 'dark']) {
      const height = width < 768 ? 844 : 800;
      const ctx = await browser.newContext({
        storageState,
        viewport: { width, height },
        isMobile: width < 768,
        hasTouch: width < 768,
      });
      await ctx.addCookies([
        { name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' },
        { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' },
      ]);
      const page = await ctx.newPage();
      const tag = `${width}-${theme}-${locale}`;
      const runtime = [];
      page.on('pageerror', (e) => runtime.push(e.message));
      const check = async (state, dialog = false) => {
        if(captureStates.length && !captureStates.includes(state))return;
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        const m = await measureCustomers(page, dialog ? '[role="dialog"]' : 'main');
        const bounds = await page.evaluate(() => {
          const rows = document.querySelector('[data-testid="ub-grid-scroll-region"]'),
            pager = document.querySelector('[data-testid="ub-grid-pagination"]');
          const rect = (el) => {
            const r = el?.getBoundingClientRect();
            return r ? { top: r.top, bottom: r.bottom, height: r.height } : null;
          };
          const nav =
            document.querySelector('[data-testid="mobile-tab-bar"]') ??
            document.querySelector('nav.fixed');
          return {
            pageOverflow: Math.max(0, document.documentElement.scrollHeight - innerHeight),
            rows: rect(rows),
            pager: rect(pager),
            nav: rect(nav),
            canScroll: !!rows && rows.scrollHeight > rows.clientHeight + 1,
            chips: [...document.querySelectorAll('[data-testid="purchase-bills-screen"] [role="radio"]')].map(button=>{const r=button.getBoundingClientRect();return {height:r.height,visible:r.left>=0&&r.right<=innerWidth,touchClear:innerWidth>=640||[r.y+r.height/2-21,r.y+r.height/2+21].every(y=>button.contains(document.elementFromPoint(r.x+r.width/2,y)))};}),
            blockedPager: [...(pager?.querySelectorAll('button:not(:disabled)') ?? [])].filter(button=>{const r=button.getBoundingClientRect();return r.width && r.height && !button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}).map(button=>button.getAttribute('aria-label') ?? button.textContent),
            pagerWithin:
              !pager ||
              getComputedStyle(pager).display === 'none' ||
              pager.getBoundingClientRect().bottom <= innerHeight + 1,
          };
        });
        results.push({ width, theme, locale, state, ...m, ...bounds, runtime: [...runtime] });
        await page.screenshot({ path: `${out}/${tag}-${state}.png` });
        const bad =
          m.cut.length ||
          m.lowContrast.length ||
          m.overflow ||
          runtime.length ||
          (!dialog && (bounds.pageOverflow > 1 || !bounds.pagerWithin || bounds.blockedPager.length || bounds.chips.some(chip=>chip.height && (Math.abs(chip.height-32)>1 || (chip.visible&&!chip.touchClear)))));
        if (bad) failures.push(`${tag} ${state}: ${JSON.stringify(results.at(-1))}`);
        console.log(
          `${tag} ${state}: pageY${bounds.pageOverflow} cut${m.cut.length} contrast${m.lowContrast.length} scroll${bounds.canScroll}`
        );
      };
      await page.goto(`${base}/purchases/bills`, { waitUntil: 'networkidle' });
      await page
        .locator('[data-testid="ub-grid-card"],[data-testid="ub-grid-row"]')
        .first()
        .waitFor();
      await check('ready');
      if (baseline) {
        await ctx.close();
        continue;
      }
      const region = page.getByTestId('ub-grid-scroll-region'),
        pager = page.getByTestId('ub-grid-pagination');
      if (!(await region.count())) throw Error('Missing bounded row region');
      const pagerY = await pager.boundingBox();
      await region.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await check('rows-scrolled');
      const afterPager = await pager.boundingBox();
      if (Math.abs(pagerY.y - afterPager.y) > 1) throw Error('Rows moved the pager');
      await region.focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
      await check('keyboard-scroll');
      const next = locale === 'hi' ? 'अगला पेज' : 'Next page';
      const nextButton = pager.getByRole('button', { name: next, exact: true });
      // Label comes from the locale catalogue below when its established wording differs.
      const forward = (await nextButton.count()) ? nextButton : pager.locator('button').last();
      if (!(await forward.isDisabled())) {
        const response = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/purchases/bills?') &&
            new URL(r.url()).searchParams.get('page') === '2'
        );
        await forward.click();
        const b = await (await response).json();
        if (!b.data.length) throw Error('Page2 empty');
        await page.waitForURL(/page=2/);
        await page.waitForLoadState('networkidle');
        await check('page-two');
      }
      await page.goto(`${base}/purchases/bills`, { waitUntil: 'networkidle' });
      const sourceResponse = await ctx.request.get(
        `${base}/api/v1/purchases/bills?tab=unpaid&page_size=25`
      );
      if (!sourceResponse.ok()) throw Error(`Read source ${sourceResponse.status()}`);
      const source = await sourceResponse.json();
      if (!source.data.length) throw Error('No source purchase data');
      const supplier = source.data.find((r) => r.supplier_invoice_number)?.supplier_invoice_number;
      if (supplier) {
        const answer = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/purchases/bills?') &&
            new URL(r.url()).searchParams.get('q') === supplier
        );
        await page.getByRole('searchbox').fill(supplier);
        const b = await (await answer).json();
        if (!b.data.length || !b.data.some((x) => x.supplier_invoice_number === supplier))
          throw Error('Supplier paper-number search did not match');
        await page.waitForLoadState('networkidle');
        await check('search-paper');
        const oldUrl = page.url();
        const row = page
          .locator('[data-testid="ub-grid-card"] button,[data-testid="ub-grid-row"] button')
          .first();
        await row.click();
        await page.waitForURL((u) => /\/purchases\/bills\/[^/]+/.test(u.pathname));
        await page.getByTestId('purchase-lines').waitFor();
        await page.goBack({ waitUntil: 'networkidle' });
        await page.waitForURL(oldUrl);
        await page.getByTestId('purchase-bills-screen').waitFor();
        if (page.url() !== oldUrl || (await page.getByRole('searchbox').inputValue()) !== supplier)
          throw Error(
            `Back lost search: expected=${oldUrl} actual=${page.url()} input=${await page.getByRole('searchbox').inputValue()} expectedInput=${supplier}`
          );
        await check('back-keeps-search');
      }
      await page.goto(`${base}/purchases/bills`, { waitUntil: 'networkidle' });
      const group = page.getByRole('radiogroup', {
        name: locale === 'hi' ? 'स्थिति के अनुसार बिल' : 'Bills by status',
      });
      await group.waitFor();
      const unpaid = group.getByRole('radio', { name: locale === 'hi' ? /देना है/ : /To pay/ });
      const response = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/purchases/bills?') &&
          new URL(r.url()).searchParams.get('tab') === 'unpaid'
      );
      await unpaid.click();
      await response;
      await page.waitForLoadState('networkidle');
      await check('to-pay');
      if (width < 768) {
        await page.getByTestId('filters-button').click();
        await page.getByRole('dialog').waitFor();
        await check('filters', true);
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      let mode = 'stress';
      await page.route('**/api/v1/purchases/bills?*', async (route) => {
        if (mode === 'error')
          return route.fulfill({
            status: 500,
            json: { error: { code: 'server_error', message: 'Unable to load purchases' } },
          });
        if (mode === 'loading') await new Promise((r) => setTimeout(r, 4000));
        const response = await route.fetch();
        const body = await response.json();
        if (mode === 'stress') {
          body.data = Array.from({ length: 25 }, (_, i) => ({
            ...source.data[i % source.data.length],
            id: `${source.data[i % source.data.length].id}-${i}`,
            party: {
              ...source.data[0].party,
              name: 'Radhe Krishna Enterprises Electrical and Electronics Wholesale Private Limited',
            },
            supplier_invoice_number: 'RKE-ELECTRICAL-2026-1043',
            grand_total: '1240378.00',
            amount_due: '1240378.00',
            status: 'recorded',
              amount_paid: '0.00',
              document_date: '2026-09-01',
            is_overdue: true,
              due_on: '2026-10-01',
          }));
          body.meta.total = 75;
          body.meta.totals = { count:75, grand_total:'93028350.00', amount_due:'93028350.00' };
          body.meta.counts = {all:75,unpaid:75,overdue:75,paid:0,draft:0,void:0};
        }
        if (['empty', 'first'].includes(mode)) {
          body.data = [];
          body.meta.total = 0;
          body.meta.has_any = mode !== 'first';
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto(`${base}/purchases/bills`, { waitUntil: 'networkidle' });
      await check('long-name-large-money');
      await region.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await check('stress-scrolled');
      if (width < 768) {
        await page.setViewportSize({ width, height: 600 });
        await check('short-viewport');
        await page.setViewportSize({ width, height });
      }
      await ctx.setOffline(true);
      await check('offline');
      await ctx.setOffline(false);
      mode = 'empty';
      await page.goto(`${base}/purchases/bills?q=no-matching-electrical-bill`, {
        waitUntil: 'networkidle',
      });
      await check('filtered-empty');
      mode = 'empty';
      await page.goto(`${base}/purchases/bills?period=lastMonth`, { waitUntil: 'networkidle' });
      await check('period-empty');
      mode = 'stress';
      await page
        .getByRole('button', { name: copy['common.action.clearFilters'], exact: true })
        .click();
      await page.waitForLoadState('networkidle');
      await page.waitForURL((u) => !u.searchParams.has('period'));
      if (new URL(page.url()).searchParams.has('period'))
        throw Error('Clear retained the empty period');
      await page.locator('[data-testid="ub-grid-card"],[data-testid="ub-grid-row"]').first().waitFor();
      await check('period-cleared');
      mode = 'loading';
      await page.goto(`${base}/purchases/bills`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('ub-grid').locator('[aria-busy=true]').first().waitFor();
      await check('loading');
      await page.waitForLoadState('networkidle');
      mode = 'first';
      await page.reload({ waitUntil: 'networkidle' });
      await check('first-use');
      mode = 'error';
      await page.reload({ waitUntil: 'networkidle' });
      await check('error');
      mode = 'stress';
      await page
        .getByRole('button', {
          name: locale === 'hi' ? 'फिर कोशिश करें' : 'Try again',
          exact: true,
        })
        .click();
      await page.locator('[data-testid="ub-grid-card"],[data-testid="ub-grid-row"]').first().waitFor();
      await check('retried');
      await page.unroute('**/api/v1/purchases/bills?*');
      for (const [kind, path] of [
        ['orders', '/purchases/orders'],
        ['returns', '/purchases/debit-notes'],
      ]) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await check(kind);
      }
      await ctx.close();
    }
} finally {
  writeFileSync(`${out}/results-${locale}.json`, JSON.stringify({ results, failures }, null, 2));
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Purchase register acceptance passed');
