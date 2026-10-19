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
 * Writes <dir>/<width>-<theme>-<locale>-<state>.png and results-<locale>.json.
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

    const check = async (state, { fullPage = false, target = page } = {}) => {
      // A frame is not verified merely because a PNG exists. Wait for its
      // actual root, then measure the same page that is being photographed.
      await target.locator('main').waitFor();
      await target.evaluate(() => document.fonts.ready);
      await target.waitForTimeout(250);
      const measure = await measureCustomers(target, 'main');
      results.push({ width, theme, locale, state, ...measure });
      await target.screenshot({ path: `${dir}/${tag}-${state}.png`, fullPage });
      console.log(`${tag} ${state}: overflow ${measure.overflow}px, cut ${measure.cut.length}, contrast ${measure.lowContrast.length}`);
      if (!baseline && (measure.overflow > 0 || measure.cut.length || measure.lowContrast.length)) {
        failures.push(`${tag} ${state}: ${JSON.stringify({ overflow: measure.overflow, cut: measure.cut, lowContrast: measure.lowContrast })}`);
      }
    };

    // Ready: the real figures.
    await page.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="dashboard-screen"]').waitFor({ timeout: 30_000 });
    if(await page.evaluate(()=>window.scrollY)>1)failures.push(`${tag}: Home unexpectedly scrolled on first load`);
    if(width<1024 && !baseline){
      const geometry=await page.getByTestId('home-figures').evaluate(el=>{const s=getComputedStyle(el),cells=[...el.children].filter(c=>getComputedStyle(c).display!=='none');return {radius:parseFloat(s.borderTopLeftRadius),gap:parseFloat(s.columnGap)||0,firstBottom:parseFloat(getComputedStyle(cells[0]).borderBottomWidth),firstRight:parseFloat(getComputedStyle(cells[0]).borderRightWidth)};});
      if(geometry.radius<8||geometry.gap>0||geometry.firstBottom<1||geometry.firstRight<1)failures.push(`${tag}: expected joined 2x2 figure card ${JSON.stringify(geometry)}`);
      const tabs=page.getByRole('tablist',{name:locale==='hi'?'होम के हिस्से':'Home sections'});if(await tabs.count()){
        const style=await tabs.evaluate(el=>({background:getComputedStyle(el).backgroundColor,radius:parseFloat(getComputedStyle(el).borderTopLeftRadius)}));if(style.radius<6||style.background==='rgba(0, 0, 0, 0)')failures.push(`${tag}: missing segmented mobile tabs`);
      }
    }
    await check('ready');
    await check('ready-full', { fullPage: true });
    // Tabs, when the new Home has them (the old screen has none).
    for (const [name, state] of [[/^(Follow-ups|फ़ॉलो-अप)/, 'tab-followups'], [/^(Insights|जानकारी)/, 'tab-insights']]) {
      const tab = page.getByRole('tab', { name }).filter({ visible: true }).first();
      if (await tab.count()) {
        await tab.click();
        await page.waitForLoadState('networkidle');
        if(state==='tab-insights') await page.getByTestId('home-daily').filter({visible:true}).first().waitFor();
        await check(state, { fullPage: true });
      } else if (!baseline) {
        failures.push(`${tag}: missing required Home tab ${state}`);
      }
    }

    const more=page.getByRole('button',{name:locale==='hi'?'अन्य रिपोर्ट और तुलना':'More reports and comparisons',exact:true});
    if(await more.count()){await more.click();await page.getByTestId('dashboard-charts').waitFor();await check('expanded-reports',{fullPage:true});}

    // Offline after a successful read: retained figures are explicitly dated.
    await ctx.setOffline(true);await page.waitForTimeout(200);
    await check('offline', {fullPage:true});await ctx.setOffline(false);

    const empty=await ctx.newPage();
    await rewriteDashboard(empty, data=>{
      data.recent_activity=[];data.top_debtors=[];data.top_creditors=[];data.low_stock_items=[];
      for(const tile of Object.values(data.tiles))if(tile&&typeof tile==='object'){
        if('amount' in tile)tile.amount='0.00';if('count' in tile)tile.count=0;
      }
    });
    await empty.goto(`${frontend}/dashboard`,{waitUntil:'networkidle'});
    await empty.getByTestId('shop-home-workspace').waitFor();await check('empty', {target:empty,fullPage:true});await empty.close();

    // Loading: the dashboard read is held, the page is reloaded.
    const held = await ctx.newPage();
    await held.route(DASHBOARD, async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.fallback(); });
    await held.route(DASHBOARD_BARE, async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.fallback(); });
    await held.goto(`${frontend}/dashboard`, { waitUntil: 'domcontentloaded' });
    await held.locator('[data-testid="dashboard-screen"] > [aria-busy="true"]').waitFor();
    await check('loading', { target: held });
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
    await check('part-failed', { target: broken, fullPage: true });
    await broken.close();

    // First use: the checklist and nothing else.
    const first = await ctx.newPage();
    await rewriteDashboard(first, (data) => {
      data.first_use = { has_party: false, has_item: false, has_document: false, has_upi: false };
    });
    await first.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await first.getByTestId('dashboard-first-use').waitFor();
    await check('first-use', { target: first, fullPage: true });
    await first.close();


    const stress=await ctx.newPage();
    await rewriteDashboard(stress,data=>{
      const long='Radhe Krishna Enterprises Electrical and Electronics Wholesale Private Limited';
      for(const row of [...data.top_debtors,...data.top_creditors]){row.name=long;row.balance='1240378.00';}
      if(data.tiles.today_sales)data.tiles.today_sales.amount='1240378.00';
      if(data.tiles.to_collect)data.tiles.to_collect.amount='1240378.00';
      if(data.tiles.to_pay)data.tiles.to_pay.amount='1240378.00';
    });
    await stress.route('**/api/v1/reports/dashboard/counter',async route=>{
      const response=await route.fetch();const body=await response.json();
      for(const key of ['customers','suppliers'])if(body.data[key]){
       body.data[key].total='1240378.00';for(const person of body.data[key].people){person.name='Radhe Krishna Enterprises Electrical and Electronics Wholesale Private Limited';person.amount='1240378.00';}
      }
      for(const source of body.data.repeat??[])source.name='Radhe Krishna Enterprises Electrical and Electronics Wholesale Private Limited';
      await route.fulfill({response,json:body});
    });
    await stress.goto(`${frontend}/dashboard`,{waitUntil:'networkidle'});
    await stress.getByTestId('shop-home-workspace').waitFor();
    await check('long-name-large-amount',{target:stress,fullPage:true});await stress.close();

    const errorPage=await ctx.newPage();
    await errorPage.route(DASHBOARD_BARE,route=>route.fulfill({status:500,json:{error:{code:'server_error',message:'Test: unable to load Home'}}}));
    await errorPage.goto(`${frontend}/dashboard`,{waitUntil:'networkidle'});
    await errorPage.getByRole('button',{name:locale==='hi'?'फिर कोशिश करें':'Try again',exact:true}).first().waitFor();
    await check('error',{target:errorPage});await errorPage.close();
    await ctx.close();
  }
  writeFileSync(`${dir}/results-${locale}.json`, JSON.stringify(results, null, 1));
  return results;
}
