/**
 * revamp-home.mjs — `--piece=home` for revamp-shots.mjs (R-DEC-16, Shop Home).
 *
 * Every width × theme × locale is photographed on the live stack in the states
 * Home has: ready (top of page and whole page), each tab, loading (the dashboard
 * read held), one part failed (the server's own `unavailable` list, injected on
 * the real response), and the first-use checklist (the real response with
 * `first_use` cleared). Each frame is measured — page overflow, text cut by its
 * own box, and computed contrast of every text node against the colours behind
 * it — and any finding fails the run unless `--baseline` records the old screen.
 *
 * Writes <dir>/<width>-<theme>-<locale>-<state>.png and results.json.
 */
import { writeFileSync } from 'node:fs';

import { measureCustomers } from './revamp-customers.mjs';

const DASHBOARD = '**/api/v1/reports/dashboard?*';
const DASHBOARD_BARE = '**/api/v1/reports/dashboard';

/** Rewrite the real dashboard response; the figures stay the server's. */
async function rewriteDashboard(page, change) {
  const handler = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    change(body.data);
    await route.fulfill({ response, json: body });
  };
  await page.route(DASHBOARD, handler);
  await page.route(DASHBOARD_BARE, handler);
}

export async function shootHome({ signedInContext, widths, themes, locale, dir, frontend, failures, baseline }) {
  const results = [];
  for (const width of widths) for (const theme of themes) {
    const ctx = await signedInContext(width, theme);
    const tag = `${width}-${theme}-${locale}`;
    const page = await ctx.newPage();

    const check = async (state, { fullPage = false } = {}) => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const measure = await measureCustomers(page, 'main');
      results.push({ width, theme, locale, state, ...measure });
      await page.screenshot({ path: `${dir}/${tag}-${state}.png`, fullPage });
      console.log(`${tag} ${state}: overflow ${measure.overflow}px, cut ${measure.cut.length}, contrast ${measure.lowContrast.length}`);
      if (!baseline && (measure.overflow > 0 || measure.cut.length || measure.lowContrast.length)) {
        failures.push(`${tag} ${state}: ${JSON.stringify({ overflow: measure.overflow, cut: measure.cut, lowContrast: measure.lowContrast })}`);
      }
    };

    // Ready: the real figures.
    await page.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="dashboard-screen"]').waitFor({ timeout: 30_000 });
    await check('ready');
    await check('ready-full', { fullPage: true });

    // Tabs, when the new Home has them (the old screen has none).
    for (const [name, state] of [[/^(Follow-ups|फ़ॉलो-अप)/, 'tab-followups'], [/^(Insights|जानकारी)/, 'tab-insights']]) {
      const tab = page.getByRole('tab', { name }).filter({ visible: true }).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForLoadState('networkidle');
        await check(state, { fullPage: true });
      }
    }

    // Loading: the dashboard read is held, the page is reloaded.
    const held = await ctx.newPage();
    await held.route(DASHBOARD, async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.fallback(); });
    await held.route(DASHBOARD_BARE, async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.fallback(); });
    await held.goto(`${frontend}/dashboard`, { waitUntil: 'domcontentloaded' });
    await held.waitForTimeout(1500);
    await held.screenshot({ path: `${dir}/${tag}-loading.png` });
    await held.close();

    // One part failed: the server's own mechanism, on its real response.
    const broken = await ctx.newPage();
    await rewriteDashboard(broken, (data) => {
      data.unavailable = ['top_creditors', 'supplier_bills'];
      data.top_creditors = [];
      delete data.tiles.supplier_bills;
    });
    await broken.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await broken.locator('[data-testid="dashboard-screen"]').waitFor({ timeout: 30_000 });
    await broken.evaluate(() => document.fonts.ready);
    const brokenMeasure = await measureCustomers(broken, 'main');
    results.push({ width, theme, locale, state: 'part-failed', ...brokenMeasure });
    await broken.screenshot({ path: `${dir}/${tag}-part-failed.png`, fullPage: true });
    if (!baseline && (brokenMeasure.overflow > 0 || brokenMeasure.cut.length || brokenMeasure.lowContrast.length)) {
      failures.push(`${tag} part-failed: ${JSON.stringify(brokenMeasure)}`);
    }
    await broken.close();

    // First use: the checklist and nothing else.
    const first = await ctx.newPage();
    await rewriteDashboard(first, (data) => {
      data.first_use = { has_party: false, has_item: false, has_document: false, has_upi: false };
    });
    await first.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await first.waitForTimeout(800);
    await first.screenshot({ path: `${dir}/${tag}-first-use.png`, fullPage: true });
    await first.close();

    await ctx.close();
  }
  writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 1));
  return results;
}
