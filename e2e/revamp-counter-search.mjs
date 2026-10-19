/** Real local Home search: no mocked results and no financial posting. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { measureCustomers } from './revamp-customers.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.E2E_FRONTEND??'http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test only');
const dir=process.env.E2E_SHOTS??'/tmp/counter-search';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME});const results=[];
try{for(const width of [320,1280])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:width===320?640:800}}),page=await context.newPage();
 await page.goto(`${base}/login/email`);await page.fill('input[type=email]','scale@digikhaato.test');await page.fill('input[type=password]','Scale-Run-2026!');await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));
 await context.addCookies([{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
 const get=async(path)=>{const r=await page.request.get(`${base}/api/v1${path}`);if(!r.ok())throw Error(`${path}: ${r.status()}`);return r.json();};
 const parties=(await get('/parties?book=shop&type=customer&status=active')).data;
 const items=(await get('/items?status=active')).data;
 const invoices=(await get('/sales/invoices?book=shop&tab=unpaid&date_from=2000-01-01')).data;
 const purchases=(await get('/purchases/bills?tab=unpaid&date_from=2000-01-01')).data;
 const customer=parties[0],item=items[0],sale=invoices.find(r=>r.number),purchase=purchases.find(r=>r.number);
 if(!customer||!item||!sale||!purchase)throw Error(`Fixture missing: customers=${parties.length}, items=${items.length}, invoices=${JSON.stringify(invoices.slice(0,1))}, purchases=${JSON.stringify(purchases.slice(0,1))}`);
 const home=async()=>{await page.goto(`${base}/dashboard`,{waitUntil:'networkidle'});await page.getByTestId('shop-home-workspace').waitFor();};
 const search=async(query)=>{await page.getByTestId('counter-search').filter({visible:true}).locator('button').first().click();await page.getByPlaceholder('Find or start: a name, item, bill number or amount', {exact:true}).fill(query);};
 const shot=async(state,root='main')=>{const measure=await measureCustomers(page,root);results.push({width,theme,state,...measure});await page.screenshot({path:`${dir}/${width}-${theme}-${state}.png`});if(measure.overflow||measure.cut.length||measure.lowContrast.length)throw Error(`${state}: ${JSON.stringify(measure)}`);};
 await home();await shot('header-command','[data-testid=counter-search]');await search(`${customer.name} 2000`);
 await page.getByRole('option',{name:new RegExp('Receive ₹2,000.00 from')}).first().waitFor();await shot('name-amount-results','[cmdk-root]');
 await page.getByRole('option',{name:new RegExp('Receive ₹2,000.00 from')}).first().click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForLoadState('networkidle');
 if(await dialog.locator('input[inputmode=decimal]').first().inputValue()!=='2000.00')throw Error('Payment amount was not seeded');await shot('name-amount-payment','[role=dialog]');
 await home();await search(item.name);
 await page.getByRole('option',{name:new RegExp('New bill with')}).filter({hasText:item.name}).first().click();
 await page.waitForURL(u=>u.pathname==='/sales/invoices/new');await page.waitForLoadState('networkidle');
 // The existing editor may autosave a DRAFT; this never clicks Issue or posts money.
 await page.getByText(item.name,{exact:true}).first().waitFor();await shot('item-bill');
 for(const [row,path,kind] of [[sale,'/sales/invoices/','sale'],[purchase,'/purchases/bills/','purchase']]){
  await home();await search(row.number);await page.getByRole('option',{name:new RegExp(`Open ${row.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`)}).first().waitFor();await shot(`${kind}-number`,'[cmdk-root]');await page.getByRole('option',{name:new RegExp(`Open ${row.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`)}).first().click();await page.waitForURL(u=>u.pathname===`${path}${row.id}`);
 }
 console.log(`${width} ${theme}: real name+amount, item-seeded invoice, sales and purchase numbers PASS`);await context.close();
}}finally{writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));await browser.close();}
