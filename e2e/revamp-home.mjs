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

    // The scale feed can contain only recent receipts. Bind two layout rows to
    // real readable bills so metadata checks cannot pass without exercising them.
    const registerFixtures=[];
    for(const [path,kind,type] of [['sales/invoices?book=shop&tab=all','sales_document','sale'],['purchases/bills?tab=all','purchase_document','purchase']]){
      const original=await page.request.get(`${frontend}/api/v1/${path}`);
      if(!original.ok())continue;
      const rows=(await original.json()).data,document=rows.find(row=>row.party&&!['draft','void','cancelled'].includes(row.status))??rows.find(row=>!['draft','void','cancelled'].includes(row.status))??rows[0];if(!document)continue;
      registerFixtures.push({id:`${type}:${document.id}`,type,at:`${document.document_date}T10:00:00+05:30`,business_date:document.document_date,number:document.number,amount:document.grand_total,direction:null,party:document.party,source:{kind,id:document.id,party_id:document.party?.id??null}});
    }
    const withFixtures=data=>{const ids=new Set(registerFixtures.map(row=>row.id));data.recent_activity=[...registerFixtures,...data.recent_activity.filter(row=>!ids.has(row.id))].slice(0,10);};
    await rewriteDashboard(page,withFixtures);
    const dashboardResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/reports/dashboard'&&response.ok());
    // Ready: the real figures, with source facts read independently from the print/detail API.
    const counterResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/reports/dashboard/counter' && response.ok());
    await page.goto(`${frontend}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="dashboard-screen"]').waitFor({ timeout: 30_000 });
    if(await page.evaluate(()=>window.scrollY)>1)failures.push(`${tag}: Home unexpectedly scrolled on first load`);
    const response = await counterResponse;
    const metadata = (await response.json()).data;
    const sourceData = (await (await dashboardResponse).json()).data;
    const expected = [...new Set(sourceData.recent_activity.filter(row => ['sales_document','purchase_document'].includes(row.source.kind)).map(row => `${row.source.kind}:${row.source.id}`))];
    const requested = new URL(response.url()).searchParams.get('documents')?.split(',') ?? [];
    if(!baseline && expected.some(key => !requested.includes(key) || !metadata.documents?.[key])) failures.push(`${tag}: missing bounded register source facts`);
    for(const key of expected){
      const fact=metadata.documents?.[key];if(!fact)continue;
      const [kind,id]=key.split(':');const path=kind==='purchase_document'?'purchases/bills':fact.kind==='credit_note'?'sales/credit-notes':'sales/invoices';
      const original=await page.request.get(`${frontend}/api/v1/${path}/${id}`);
      if(!original.ok() || (await original.json()).data.lines.length!==fact.item_count)failures.push(`${tag}: item count differs from source ${key}`);
      const rows=page.locator(`[data-source-reference="${key}"]`);
      if(!baseline && await rows.count()===0)failures.push(`${tag}: register row missing source identity`);
      const labels=locale==='hi'?{paid:'\u092d\u0941\u0917\u0924\u093e\u0928 \u0939\u0941\u0906',partially_paid:'\u0906\u0902\u0936\u093f\u0915 \u092d\u0941\u0917\u0924\u093e\u0928',overdue:'\u0926\u0947\u0930 \u0939\u0941\u0908',unpaid:'\u092d\u0941\u0917\u0924\u093e\u0928 \u092c\u093e\u0915\u0940',void:'\u0930\u0926\u094d\u0926',applied:'\u0915\u094d\u0930\u0947\u0921\u093f\u091f \u0932\u0917\u093e',issued:'\u091c\u093e\u0930\u0940'}:{paid:'Paid',partially_paid:'Part paid',overdue:'Late',unpaid:'Not paid',void:'Cancelled',applied:'Credit used',issued:'Issued'};
      const status=['issued','recorded'].includes(fact.status)&&fact.kind!=='credit_note'?'unpaid':fact.status;
      for(const row of await rows.all()){
        const text=await row.innerText(),count=`${fact.item_count} ${locale==='hi'?'\u0938\u093e\u092e\u093e\u0928':'item'}`;
        if(!baseline && !text.includes(count))failures.push(`${tag}: count not rendered on ${key}`);
        if(!baseline && !(await row.getAttribute('data-event-type')).endsWith('_void') && labels[status] && !text.includes(labels[status]))failures.push(`${tag}: current status not rendered on ${key}`);
      }
    }

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

    const waitingFacts=await ctx.newPage();await rewriteDashboard(waitingFacts,withFixtures);
    await waitingFacts.route('**/api/v1/reports/dashboard/counter*',async route=>{await new Promise(resolve=>setTimeout(resolve,5000));await route.fallback();});
    await waitingFacts.goto(`${frontend}/dashboard`,{waitUntil:'domcontentloaded'});await waitingFacts.getByTestId('shop-home-workspace').waitFor();await check('metadata-loading',{target:waitingFacts,fullPage:true});await waitingFacts.close();
    const refusedFacts=await ctx.newPage();await rewriteDashboard(refusedFacts,withFixtures);
    await refusedFacts.route('**/api/v1/reports/dashboard/counter*',route=>route.fulfill({status:500,json:{error:{code:'server_error',message:'Test: unavailable register facts'}}}));
    await refusedFacts.goto(`${frontend}/dashboard`,{waitUntil:'networkidle'});await refusedFacts.getByTestId('shop-home-workspace').waitFor();await check('metadata-unavailable',{target:refusedFacts,fullPage:true});await refusedFacts.close();

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
      withFixtures(data);
      const long='Radhe Krishna Enterprises Electrical and Electronics Wholesale Private Limited';
      for(const row of [...data.top_debtors,...data.top_creditors]){row.name=long;row.balance='1240378.00';}
      for(const event of data.recent_activity){if(event.party)event.party.name=long;if(event.amount!==null)event.amount='1240378.00';}
      if(data.tiles.today_sales)data.tiles.today_sales.amount='1240378.00';
      if(data.tiles.to_collect)data.tiles.to_collect.amount='1240378.00';
      if(data.tiles.to_pay)data.tiles.to_pay.amount='1240378.00';
    });
    await stress.route('**/api/v1/reports/dashboard/counter*',async route=>{
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
