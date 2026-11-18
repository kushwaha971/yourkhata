/** Plain billing/contact labels, geometry and Shop picker context. Local reads only. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {measureCustomers} from './revamp-customers.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const arg=(k,d)=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const base=process.env.E2E_FRONTEND??(process.env.E2E_BASE ?? 'http://localhost:3000'),out=process.env.E2E_SHOTS??'/tmp/plain-terms',locale=arg('locale','en');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME}),results=[],failures=[];
try{
 const auth=await browser.newContext(),login=await auth.newPage();await login.goto(`${base}/login/email`);await login.fill('input[type=email]','scale@digikhaato.test');await login.fill('input[type=password]','Scale-Run-2026!');await login.click('button[type=submit]');await login.waitForURL(u=>!u.pathname.startsWith('/login'));const storageState=await auth.storageState();await auth.close();
 for(const width of arg('widths','390,320,1024,1280').split(',').map(Number))for(const theme of ['light','dark']){
  const ctx=await browser.newContext({storageState,viewport:{width,height:width<768?844:900}}),page=await ctx.newPage();await ctx.addCookies([{name:'ub_locale',value:locale,domain:new URL(base).hostname,path:'/'},{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
  page.on('dialog',dialog=>dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss());let writes=0;page.on('request',r=>{if(['POST','PATCH','PUT','DELETE'].includes(r.method())&&/\/(sales\/invoices|payments|parties)(\/|$)/.test(new URL(r.url()).pathname))writes++;});
  const check=async(state,root='main')=>{await page.waitForTimeout(200);await page.evaluate(()=>document.fonts.ready);const m=await measureCustomers(page,root);results.push({width,theme,locale,state,...m});await page.screenshot({path:`${out}/${width}-${theme}-${locale}-${state}.png`,fullPage:true});console.log(`${width}-${theme}-${locale} ${state}: cut${m.cut.length} contrast${m.lowContrast.length} overflow${m.overflow}`);if(m.cut.length||m.lowContrast.length||m.overflow)failures.push({width,theme,locale,state,...m});};
  await page.goto(`${base}/sales/invoices/new`,{waitUntil:'networkidle'});const quick=locale==='hi'?'तुरंत बिक्री':'Quick Sale',saved=locale==='hi'?'सहेजा गया ग्राहक':'Saved customer';
  await page.getByRole('radio',{name:quick,exact:true}).waitFor();await page.getByRole('radio',{name:quick,exact:true}).click();if(await page.getByRole('radio',{name:quick,exact:true}).getAttribute('aria-checked')!=='true')throw Error('Quick Sale option did not select');await check('quick-sale');
  await page.getByRole('radio',{name:saved,exact:true}).click();if(await page.getByRole('radio',{name:saved,exact:true}).getAttribute('aria-checked')!=='true')throw Error('Saved customer option did not select');await check('saved-customer');
  const picker=page.getByRole('combobox',{name:saved,exact:true});const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/parties'&&new URL(r.url()).searchParams.get('book')==='shop');await picker.click();const reply=await response;if(!reply.ok()||new URL(reply.url()).searchParams.get('type')!=='customer')throw Error('Customer picker lost its Shop/customer context');await page.getByRole('option').first().waitFor();await page.getByRole('option').first().evaluate(el=>{const root=el.closest('[data-radix-popper-content-wrapper]')??el.closest('[role=listbox]');if(!root)throw Error('Missing customer picker surface');root.setAttribute('data-plain-terms-picker','');});await check('saved-customer-picker','[data-plain-terms-picker]');await page.keyboard.press('Escape');
  // Generic contact wording belongs to the shared directory, not a supplier-to-customer rename.
  await page.goto(`${base}/parties`,{waitUntil:'networkidle'});const add=locale==='hi'?'संपर्क जोड़ें':'Add contact';await page.getByRole('button',{name:add,exact:true}).first().click();await page.getByRole('dialog',{name:add,exact:true}).waitFor();await check('contact-form','[role=dialog]');
  if(writes)throw Error(`Read-only copy review wrote ${writes} business records`);await ctx.close();
 }
}finally{writeFileSync(`${out}/results-${locale}.json`,JSON.stringify({results,failures},null,2));await browser.close();}
if(failures.length){console.error(JSON.stringify(failures));process.exitCode=1;}
