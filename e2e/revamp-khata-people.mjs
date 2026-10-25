/** Udhaar register: read-only local QA, real server paging and measured phone/desktop states. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { measureCustomers } from './revamp-customers.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const locale = process.argv.find((arg) => arg.startsWith('--locale='))?.slice(9) ?? 'en';
const widths = locale === 'hi' ? [320, 1280] : [390, 320, 1024, 1280];
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const out = process.env.E2E_SHOTS ?? '/tmp/udhaar-people';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const results = [], failures = [];
try {
  const loginContext = await browser.newContext();
  const login = await loginContext.newPage();
  await login.goto(`${base}/login/email`);
  await login.fill('input[type=email]', 'scale@digikhaato.test');
  await login.fill('input[type=password]', 'Scale-Run-2026!');
  await login.click('button[type=submit]');
  await login.waitForURL((url) => !url.pathname.startsWith('/login'));
  const storageState = await loginContext.storageState();
  await loginContext.close();
  for (const width of widths) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ storageState, viewport: { width, height: width < 768 ? 844 : 800 }, isMobile: width < 768, hasTouch: width < 768 });
    if (locale === 'en' && width === 390 && theme === 'light') {
      await ctx.addInitScript(() => {
        Object.defineProperty(navigator, 'contacts', { configurable: true, value: { select: async () => [{ name: ['Radhe Krishna Enterprises'], tel: ['9794620535'] }] } });
      });
    }
    await ctx.addCookies([{ name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' }, { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' }]);
    const page = await ctx.newPage();
    const tag = `${width}-${theme}-${locale}`;
    const check = async (state) => {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const measure = await measureCustomers(page, 'main');
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid=ub-grid]');
        const region = grid?.querySelector('[data-testid=ub-grid-scroll-region]');
        const rect = region?.getBoundingClientRect();
        const chips = [...document.querySelectorAll('[data-testid=khata-people-toolbar] button[aria-pressed]')].map((button) => button.getBoundingClientRect().height);
        const firstCard = grid?.querySelector('[data-testid=ub-grid-card]');
        const firstCardText = firstCard?.textContent ?? '';
        const avatar = firstCard?.querySelector('button > [aria-hidden].rounded-pill')?.getBoundingClientRect();
        const title = firstCard?.querySelector('button > span.flex > span:first-child')?.getBoundingClientRect();
        const arrow = !!firstCard?.querySelector('svg.lucide-chevron-right');
        const titleVisible = !!document.querySelector('h1')?.getBoundingClientRect().height;
        return { pageY: Math.max(0, document.documentElement.scrollHeight - innerHeight), rowHeight: rect?.height ?? null, cardShare: rect?.height ? rect.height / (innerWidth < 768 ? innerHeight - 64 : innerHeight) : 0, chips, firstCardText, cardLayout: grid?.querySelector('[data-testid=ub-grid-cards]')?.getAttribute('data-card-layout'), avatarTitleOffset: avatar && title ? Math.abs(avatar.y - title.y) : null, arrow, titleVisible, cards: grid?.querySelectorAll('[data-testid=ub-grid-card]').length ?? 0, tables: [...(grid?.querySelectorAll('table') ?? [])].filter((table) => table.getBoundingClientRect().width > 0).length, pager: !!grid?.querySelector('[data-testid=ub-grid-pagination]'), searchFields: document.querySelectorAll('main input[type=search]').length, fab: !!document.querySelector('[data-ub-fab]') };
      });
      const row = { tag, state, ...measure, ...layout };
      results.push(row);
      await page.screenshot({ path: `${out}/${tag}-${state}.png`, fullPage: false });
      if (measure.overflow || measure.cut.length || measure.lowContrast.length || layout.pageY > 1) failures.push(row);
      if (state === 'ready') {
        if (width < 768 && (layout.cards < 1 || layout.pager || !layout.fab || !layout.arrow || layout.titleVisible || layout.cardLayout !== 'compact' || layout.avatarTitleOffset === null || layout.avatarTitleOffset > 24 || layout.searchFields !== 1 || layout.cardShare < 0.6 || layout.chips.length || /Remind|\+91|days ago/.test(layout.firstCardText))) failures.push(row);
        if (width >= 768 && (!layout.tables || !layout.pager)) failures.push(row);
      }
      console.log(tag, state, JSON.stringify({ cut: measure.cut.length, contrast: measure.lowContrast.length, ...layout }));
    };
    await page.goto(`${base}/khata`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid=ub-grid-card],[data-testid=ub-grid-row]').first().waitFor();
    const qs = new URL(page.url()).searchParams;
    if (qs.get('balance') !== 'due' || qs.get('status') !== 'active') failures.push(`${tag}: missing explicit Due URL ${page.url()}`);
    await check('ready');
    const body = await (await ctx.request.get(`${base}/api/v1/parties?balance=due&status=active&page=1`)).json();
    if (await page.locator('[data-testid=khata-people-summary]').count()) {
      const text = await page.getByTestId('khata-people-summary').innerText();
      if (!text.replace(/,/g, '').includes(String(body.meta.total))) failures.push(`${tag}: total does not match server`);
    }
    if (width < 768) {
      const region = page.getByTestId('ub-grid-scroll-region');
      let secondPages = 0;
      page.on('request', (request) => { const url = new URL(request.url()); if (url.pathname === '/api/v1/parties' && url.searchParams.get('page') === '2') secondPages++; });
      if (secondPages) failures.push(`${tag}: page2 requested before scroll`);
      const before = await page.getByTestId('ub-grid-card').count();
      const answer = page.waitForResponse((response) => { const url = new URL(response.url()); return url.pathname === '/api/v1/parties' && url.searchParams.get('page') === '2'; });
      await region.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await answer;
      await page.waitForLoadState('networkidle');
      if (await page.getByTestId('ub-grid-card').count() <= before) failures.push(`${tag}: appended cards missing`);
      await check('appended');
      if (width === 390 && theme === 'light') {
        await region.evaluate((node) => { node.scrollTop = node.scrollHeight; });
        const covered = await page.evaluate(() => {
          const row = [...document.querySelectorAll('[data-testid=ub-grid-card]')].at(-1)?.getBoundingClientRect();
          const fab = document.querySelector('[data-ub-fab] button')?.getBoundingClientRect();
          return !!row && !!fab && row.left < fab.right && row.right > fab.left && row.top < fab.bottom && row.bottom > fab.top;
        });
        if (covered) failures.push(`${tag}: floating Add covers the last card at the end of the list`);
      }
    }
    if (locale === 'en') {
      await page.getByTestId('filters-button').click();
      await page.getByRole('radiogroup', { name: 'Balance' }).getByRole('radio', { name: 'All' }).click();
      const allResponse = page.waitForResponse((response) => { const url = new URL(response.url()); return url.pathname === '/api/v1/parties' && !url.searchParams.has('balance'); });
      await page.getByTestId('filters-apply').click();
      await allResponse;
      await page.waitForURL((url) => url.searchParams.get('balance') === 'all');
      if (new URL(page.url()).searchParams.get('balance') !== 'all') failures.push(`${tag}: All URL not explicit`);
      await check('all');
      await page.getByTestId('filters-button').click();
      await page.getByRole('radiogroup', { name: 'Balance' }).getByRole('radio', { name: 'Due' }).click();
      await page.getByTestId('filters-apply').click();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('filters-button').click();
      await page.getByRole('dialog').waitFor();
      await check('filters');
      await page.keyboard.press('Escape');
      if (width === 390 && theme === 'light') {
        await page.getByRole('button', { name: 'Add person' }).last().click();
        const drawer = page.getByRole('dialog', { name: 'Add person' });
        await drawer.waitFor();
        if (!(await drawer.getByRole('radio', { name: 'Gave money' }).count()) || !(await drawer.getByRole('radio', { name: 'Got money' }).count())) failures.push(`${tag}: quick Add has no direction`);
        const pick = drawer.getByRole('button', { name: 'Choose from phone contacts' });
        await pick.waitFor();
        await pick.click();
        if (await drawer.getByLabel('Name').inputValue() !== 'Radhe Krishna Enterprises') failures.push(`${tag}: phone contact name did not fill`);
        await drawer.getByRole('button', { name: 'Mobile number (optional)' }).click();
        if (!(await drawer.getByRole('textbox', { name: 'Mobile number', exact: true }).inputValue()).includes('9794620535')) failures.push(`${tag}: phone contact number did not fill`);
        await check('quick-add');
        await page.keyboard.press('Escape');
      }
    }
    if (locale === 'en' && width === 320 && theme === 'light') {
      const empty = structuredClone(body);
      empty.data = [];
      empty.meta = { ...empty.meta, total: 0, total_pages: 0, has_any: true, totals: { ...empty.meta.totals, receivable: '0.00', payable: '0.00', count: 0 } };
      const scope = (route) => { const url = new URL(route.request().url()); return url.pathname === '/api/v1/parties' && url.searchParams.get('balance') === 'due'; };
      const emptyRoute = (route) => scope(route) ? route.fulfill({ status: 200, json: empty }) : route.continue();
      await page.route('**/api/v1/parties?**', emptyRoute);
      await page.goto(`${base}/khata?balance=due&status=active`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Show all people' }).waitFor();
      await check('empty-due');
      await page.unroute('**/api/v1/parties?**', emptyRoute);

      const stress = structuredClone(body);
      stress.data = [{ ...body.data[0], name: 'Radhe Krishna Enterprises — Electrical and Electronics Wholesale Division', balance: '1240378.00', tags: [] }];
      stress.meta = { ...stress.meta, total: 1, total_pages: 1, has_any: true, totals: { ...stress.meta.totals, receivable: '1240378.00', payable: '0.00', count: 1 } };
      const stressRoute = (route) => scope(route) ? route.fulfill({ status: 200, json: stress }) : route.continue();
      await page.route('**/api/v1/parties?**', stressRoute);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Radhe Krishna Enterprises — Electrical and Electronics Wholesale Division').waitFor();
      await check('long-name-money');
      await page.unroute('**/api/v1/parties?**', stressRoute);

      const errorRoute = (route) => scope(route) ? route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Could not load' } } }) : route.continue();
      await page.route('**/api/v1/parties?**', errorRoute);
      await page.reload({ waitUntil: 'networkidle' });
      await check('error');
      await page.unroute('**/api/v1/parties?**', errorRoute);
    }
    await ctx.close();
  }
} finally {
  writeFileSync(`${out}/results-${locale}.json`, JSON.stringify({ results, failures }, null, 2));
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify(failures)); process.exitCode = 1; }
