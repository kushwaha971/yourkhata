/** Home entry points use real Shop payment/reminder APIs; local fixtures only. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { measureCustomers } from './revamp-customers.mjs';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const base=process.env.E2E_FRONTEND??(process.env.E2E_BASE ?? 'http://localhost:3000');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test only');
const dir=process.env.E2E_SHOTS??'/tmp/home-actions';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME});const results=[];
try{for(const width of [320,1280])for(const theme of ['light','dark']){
 const ctx=await browser.newContext({viewport:{width,height:width===320?640:800}}),p=await ctx.newPage();
 await p.goto(`${base}/login/email`);await p.fill('input[type=email]',process.env.E2E_EMAIL??'scale@digikhaato.test');await p.fill('input[type=password]',process.env.E2E_PASSWORD??'Scale-Run-2026!');await p.click('button[type=submit]');await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 await ctx.addCookies([{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
 await p.goto(`${base}/dashboard`,{waitUntil:'networkidle'});await p.getByTestId('shop-home-workspace').waitFor();
 const check=async(state)=>{const m=await measureCustomers(p,'[role="dialog"]');results.push({width,theme,state,...m});await p.screenshot({path:`${dir}/${width}-${theme}-${state}.png`});if(m.overflow||m.cut.length||m.lowContrast.length)throw Error(`${state}: ${JSON.stringify(m)}`);};
 for(const [label,type] of [['Receive money','customer'],['Pay supplier','supplier']]){
  if(width===320 && type==='supplier') { await p.getByRole('button',{name:'More actions',exact:true}).first().click(); await p.getByRole('button',{name:label,exact:true}).click(); } else await p.getByRole('button',{name:label,exact:true}).filter({visible:true}).click();const dialog=p.getByRole('dialog');await dialog.waitFor();
  const field=dialog.getByRole('combobox').first();const reply=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/parties'&&new URL(r.url()).searchParams.get('type')===type);
  await field.click();const response=await reply;if(!response.ok()||new URL(response.url()).searchParams.get('book')!=='shop')throw Error('Home picker not scoped to role and Shop');
  await p.getByRole('option').first().waitFor();await check(`${type}-picker`);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  // Unchanged form closes without any payment write.
  if(await dialog.isVisible())await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
 }
 if(width>=1024){
 const customer=p.getByRole('region',{name:'Customers'}); const preview=p.waitForResponse(r=>r.url().endsWith('/reminders/preview'));await customer.getByRole('button',{name:/^Remind/}).first().click();const res=await preview;if(JSON.parse(res.request().postData()).book!=='shop')throw Error('Wrong reminder book');
 const editor=p.locator('textarea[data-ub-share-preview]');await editor.waitFor();await editor.fill('Radhe Krishna Enterprises: please pay your electrical bill balance.');
 const link=p.getByRole('dialog').getByRole('link',{name:'WhatsApp',exact:true});if(new URL(await link.getAttribute('href')).searchParams.get('text')!==await editor.inputValue())throw Error('Reminder edit lost');await check('editable-reminder');await p.keyboard.press('Escape');
 }
 const supplier=p.getByRole('region',{name:'Suppliers'}); if(width>=1024) await supplier.getByRole('button',{name:'Pay',exact:true}).first().click(); else { await p.getByRole('button',{name:'More actions',exact:true}).first().click(); await p.getByRole('button',{name:'Pay supplier',exact:true}).click(); const dialog=p.getByRole('dialog'); await dialog.getByRole('combobox').first().click(); await p.getByRole('option').first().click(); }await p.getByRole('dialog').waitFor();await p.waitForLoadState('networkidle');await check('supplier-payment');
 if(width===320&&theme==='light'&&process.env.E2E_WRITE_TESTS==='1'){
  const dialog=p.getByRole('dialog');await dialog.locator('input[inputmode="decimal"]').first().fill('1');await p.waitForFunction(()=>!document.querySelector('[data-testid="payment-save"]')?.disabled);
  let release,start;const hold=new Promise(r=>release=r),started=new Promise(r=>start=r);let posts=0;
  const handler=async route=>{if(route.request().method()!=='POST')return route.fallback();posts++;start();await hold;await route.continue();};await p.route('**/api/v1/payments',handler);
  const saved=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/payments'&&r.request().method()==='POST');await dialog.getByTestId('payment-save').evaluate(button=>{button.click();button.click()});await started;await check('busy-payment');release();const response=await saved;
  if(!response.ok()||posts!==1)throw Error(`Payment ${response.status()} posts ${posts}`);const body=JSON.parse(response.request().postData());if(body.direction!=='out'||body.bucket!=='shop')throw Error('Wrong Home payment book/direction');
  await dialog.getByRole('button',{name:'Done',exact:true}).waitFor();await check('saved-payment');const receipt=await dialog.getByRole('link',{name:'View receipt',exact:true}).getAttribute('href');await dialog.getByRole('button',{name:'Done',exact:true}).click();await p.goto(`${base}${receipt}`,{waitUntil:'networkidle'});await p.locator('main').waitFor();await p.screenshot({path:`${dir}/320-light-receipt.png`});
  console.log('Home supplier payment: ₹1, double-tap one POST, Shop-only, saved receipt PASS');
 }

 console.log(`${width} ${theme}: role-scoped pickers, editable Shop reminder and supplier payment context PASS`);await ctx.close();
}}finally{writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));await browser.close();}
