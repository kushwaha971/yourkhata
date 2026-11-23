/** Period and grouping controls measured on the actual local production build. */
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';
import {measureCustomers} from './revamp-customers.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.E2E_FRONTEND??(process.env.E2E_BASE ?? 'http://localhost:3000');if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test only');
const dir=process.env.E2E_SHOTS??'/tmp/home-periods';mkdirSync(dir,{recursive:true});const results=[];
const browser=await chromium.launch({executablePath:process.env.CHROME});
try{for(const width of [320,1280])for(const theme of ['light','dark']){
 const ctx=await browser.newContext({viewport:{width,height:width===320?640:800}}),p=await ctx.newPage();
 await p.goto(`${base}/login/email`);await p.fill('input[type=email]','scale@digikhaato.test');await p.fill('input[type=password]','Scale-Run-2026!');await p.click('button[type=submit]');await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 await ctx.addCookies([{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);await p.goto(`${base}/dashboard`,{waitUntil:'networkidle'});await p.getByTestId('shop-home-workspace').waitFor();
 if(width===320)await p.getByRole('tab',{name:'Insights',exact:true}).click();
 const chart=p.getByTestId('home-daily').filter({visible:true}).first();await chart.waitFor();
 const controls=await chart.getByTestId('home-chart-filters').getByRole('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {y:r.y,height:r.height}}));
 if(controls.length!==2 || Math.abs(controls[0].y-controls[1].y)>1 || controls.some(c=>c.height>33))throw Error(`Filters must be compact and aligned: ${JSON.stringify(controls)}`);
 const check=async(state)=>{await chart.scrollIntoViewIfNeeded();await p.evaluate(()=>document.fonts.ready);const m=await measureCustomers(p,'main');results.push({width,theme,state,...m});await p.screenshot({path:`${dir}/${width}-${theme}-${state}.png`});if(m.overflow||m.cut.length||m.lowContrast.length)throw Error(`${state}: ${JSON.stringify(m)}`);};
 await chart.getByRole('button',{name:'Show as table',exact:true}).click();await check('daily-table');await chart.getByRole('button',{name:'Show as chart',exact:true}).click();
 for(const period of ['This week','This month','This year','All time']){
  await chart.getByTestId('home-chart-filters').getByRole('button').first().click();const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/reports/dashboard/charts');await p.getByRole('option',{name:period,exact:true}).click();const r=await response;if(!r.ok())throw Error(`${period} ${r.status()}`);await p.waitForLoadState('networkidle');await chart.getByRole('img').waitFor();await check(period.toLowerCase().replaceAll(' ','-'));
 }
 // All-time yearly grouping is a real server read, not aggregation of the seven-day response.
 await chart.getByTestId('home-chart-filters').getByRole('button').nth(1).click();const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/reports/dashboard/charts'&&new URL(r.url()).searchParams.get('group')==='year');await p.getByRole('option',{name:'Year',exact:true}).click();if(!(await response).ok())throw Error('Year group failed');await p.waitForLoadState('networkidle');await chart.getByRole('img').waitFor();await check('year-group');
 console.log(`${width} ${theme}: chart/table, week/month/year/all periods, yearly grouping PASS`);await ctx.close();
}}finally{writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));await browser.close();}
