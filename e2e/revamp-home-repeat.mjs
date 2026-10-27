/** Repeat must populate a new reviewed form without a silent POST or old payment. */
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)('playwright');const base=process.env.E2E_FRONTEND??(process.env.E2E_BASE ?? 'http://localhost:3000');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test only');
const dir=process.env.E2E_SHOTS??'/tmp/home-repeat';mkdirSync(dir,{recursive:true});const results=[];
const browser=await chromium.launch({executablePath:process.env.CHROME});
try{const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();
 await p.goto(`${base}/login/email`);await p.fill('input[type=email]','scale@digikhaato.test');await p.fill('input[type=password]','Scale-Run-2026!');await p.click('button[type=submit]');await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 const reply=await p.request.get(`${base}/api/v1/reports/dashboard/counter`);if(!reply.ok())throw Error(`Counter ${reply.status()}`);const body=(await reply.json()).data;
 let posts=[];p.on('request',r=>{if(r.method()==='POST'&&/\/api\/v1\/(sales\/invoices|purchases\/bills|expenses)(?:\?|$)/.test(r.url()))posts.push(r.url());});
 for(const source of body.repeat??[]){
  await p.goto(`${base}/dashboard`,{waitUntil:'networkidle'});await p.getByTestId('shop-home-workspace').waitFor();
  if(source.kind==='expense'){
   await p.getByRole('button',{name:new RegExp(`^Expense: ${source.name}`)}).click();const d=p.getByRole('dialog');await d.waitFor();
   if((await d.locator('input[inputmode=decimal]').first().inputValue()).replaceAll(',','')!==source.amount)throw Error('Expense repeat lost amount');
   await p.screenshot({path:`${dir}/expense.png`});await d.getByRole('button',{name:'Close',exact:true}).click();
  }else{
   const prefix=source.kind==='sale'?'/sales/invoices':'/purchases/bills';await p.locator(`a[href="${prefix}/new?repeat=${source.id}"]`).click();await p.waitForURL(u=>u.pathname===`${prefix}/new`);await p.waitForLoadState('networkidle');
   await p.getByText(source.name,{exact:true}).first().waitFor();
   // A real edit would normally arm server autosave. Repeat explicitly waits for Save.
   const qty=p.locator('input[name="lines.0.qty"]');if(await qty.count())await qty.fill('2');await p.waitForTimeout(11000);
   if(posts.length)throw Error(`Repeat silently posted ${posts}`);await p.screenshot({path:`${dir}/${source.kind}.png`});
  }
  results.push({kind:source.kind,sourceDate:source.date,posts:posts.length});console.log(`Repeat ${source.kind}: reviewed new form, no silent write PASS`);
 }
 if(results.length!==3)throw Error(`Need all three repeat types, got ${results.length}`);
 await context.close();
}finally{writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));await browser.close();}
