/** Local QA draft only. Read fixtures exercise compact line rows and total dock. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {measureCustomers} from './revamp-customers.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const arg=(k,d)=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const base=process.env.E2E_FRONTEND??(process.env.E2E_BASE ?? 'http://localhost:3000'),out=process.env.E2E_SHOTS??'/tmp/editor-lines',locale=arg('locale','en'),baseline=process.argv.includes('--baseline');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME}),results=[],failures=[];
try{
 const auth=await browser.newContext(),p=await auth.newPage();await p.goto(`${base}/login/email`);await p.fill('input[type=email]','scale@digikhaato.test');await p.fill('input[type=password]','Scale-Run-2026!');await p.click('button[type=submit]');await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 const fixture='/tmp/revamp-editor-line-fixture.json';let source;
 if(existsSync(fixture))source=JSON.parse(readFileSync(fixture,'utf8'));
 else{
  const csrf=(await auth.cookies()).find(c=>c.name==='ub_csrf')?.value;
  const post=async(path,data)=>{const r=await auth.request.post(`${base}/api/v1/${path}`,{headers:{'X-CSRF-Token':csrf,'Idempotency-Key':crypto.randomUUID()},data});if(!r.ok())throw Error(`${path} ${r.status()} ${await r.text()}`);return (await r.json()).data;};
  const units=(await(await auth.request.get(`${base}/api/v1/units`)).json()).data;
  const item=await post('items',{name:'Radhe Krishna Enterprises Copper Electrical Cable QA',unit_id:units.find(x=>x.code==='NOS').id,selling_price:'500.00',purchase_price:'400.00',tax_code:'GST18',hsn_sac:'8544',track_stock:false});
  const draft=await post('sales/invoices',{document_date:new Date().toISOString().slice(0,10),lines:Array.from({length:50},()=>({item_id:item.id,qty:'2',unit_price:'500.00'}))});
  source=(await(await auth.request.get(`${base}/api/v1/sales/invoices/${draft.id}`)).json()).data;writeFileSync(fixture,JSON.stringify(source));
 }
 const storageState=await auth.storageState();await auth.close();
 for(const width of arg('widths','390,320,1024,1280').split(',').map(Number))for(const theme of ['light','dark']){
  const ctx=await browser.newContext({storageState,viewport:{width,height:width<768?844:900}}),page=await ctx.newPage();await ctx.addCookies([{name:'ub_locale',value:locale,domain:new URL(base).hostname,path:'/'},{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
  const tag=`${width}-${theme}-${locale}`;let count=10,large=false;
  // State data is synthetic; reads retain a real draft ID. Never issue or change saved drafts.
  await page.route(`**/api/v1/sales/invoices/${source.id}`,route=>{const d=structuredClone(source);d.lines=d.lines.slice(0,count);if(large){d.lines[0].unit_price='1240378.00';d.lines[0].qty='1';}return route.fulfill({status:200,json:{data:d,meta:{}}});});
  const check=async(state)=>{await page.evaluate(()=>document.fonts.ready);const m=await measureCustomers(page,'main');const clippedInputs=await page.locator('main input[inputmode]').evaluateAll(inputs=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');return inputs.filter(el=>{if(!el.getClientRects().length||!el.value)return false;const s=getComputedStyle(el);ctx.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;return ctx.measureText(el.value).width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)>el.clientWidth+1;}).map(el=>`${el.getAttribute('aria-label')}: ${el.value}`);});m.cut.push(...clippedInputs);const layout=await page.getByTestId('line-items-editor').getAttribute('data-layout');const cards=await page.getByTestId('line-items-editor').locator('section').evaluateAll(nodes=>nodes.map(el=>Math.round(el.getBoundingClientRect().height)));const dock=await page.getByTestId('invoice-dock').evaluate(el=>{const spans=[...el.querySelectorAll('span')],amount=spans.find(x=>x.textContent.includes('₹'));return {cut:!!amount&&amount.scrollWidth>amount.clientWidth+1,text:amount?.textContent};});results.push({width,theme,locale,state,layout,cards,dock,...m});await page.screenshot({path:`${out}/${tag}-${state}.png`,fullPage:true});console.log(`${tag} ${state} ${layout} cards:${cards.slice(0,3)} cut:${m.cut.length} contrast:${m.lowContrast.length} overflow:${m.overflow} dockcut:${dock.cut}`);if(m.cut.length||m.lowContrast.length||m.overflow||dock.cut)failures.push(`${tag} ${state}: ${JSON.stringify(m)}`);if(layout==='card'&&count>1){const expanded=await page.locator('[data-testid=line-items-editor] section button[aria-expanded=true]').count();if(expanded!==(state==='rows-collapsed'?0:1))failures.push(`${tag}: unexpected expanded rows ${expanded} in ${state}`);}};
  for(const n of [1,10,50]){count=n;await page.goto(`${base}/sales/invoices/${source.id}/edit`,{waitUntil:'networkidle'});await page.getByTestId('line-items-editor').waitFor();await check(`${n}-lines`);}
  if(await page.getByTestId('line-items-editor').getAttribute('data-layout')==='card'){count=10;await page.reload({waitUntil:'networkidle'});await page.getByTestId('line-items-editor').locator('section button[aria-expanded=true]').first().click();await check('rows-collapsed');}
  count=10;large=true;await page.reload({waitUntil:'networkidle'});await check('large-amount');
  if(!baseline&&await page.getByTestId('line-items-editor').getAttribute('data-layout')==='card'){
   const row=page.getByTestId('line-items-editor').locator('section');await row.nth(1).locator('button[aria-expanded]').first().click();if(await row.nth(0).locator('input').count())throw Error('Previous row still expanded');await check('second-line-expanded');
   const qty=row.nth(1).locator('input[id$="-qty"]').first();await qty.fill('');await row.nth(1).locator('button[aria-expanded]').first().click();await page.getByTestId('invoice-dock').locator('button').last().click();await row.nth(1).locator('[role=alert]').first().waitFor();await check('invalid-collapsed-line');
  }
  count=0;large=false;await page.reload({waitUntil:'networkidle'});await check('empty-lines');
  await ctx.close();
 }
}finally{writeFileSync(`${out}/results-${locale}.json`,JSON.stringify({results,failures},null,2));await browser.close();}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
