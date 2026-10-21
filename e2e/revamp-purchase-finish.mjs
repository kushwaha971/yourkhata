/** Local-only §7 finish acceptance. Fresh electrical business; no external sends.
 * Lost-record check fails on c6f53323. UI payment403 is a controlled fixture;
 * actual permission/atomicity evidence comes separately from backend tests.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { newOwner, must, api, fixtureGstin } from './lib/fixtures.mjs';
import { measureCustomers } from './revamp-customers.mjs';
import { coveredOverlayText } from './lib/measureOverlayText.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k,d) => process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3) ?? d;
const base=process.env.E2E_FRONTEND ?? 'http://localhost:3000';
for(const u of [base,process.env.E2E_BACKEND ?? 'http://localhost:8000/api/v1']) if(!['localhost','127.0.0.1'].includes(new URL(u).hostname)) throw Error('Local QA only');
const locale=arg('locale','en'),hi=locale==='hi';
const words=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/purchases.${locale}.json`,import.meta.url),'utf8'));
const word=key=>words[`purchases.${key}`];
const out=`${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/revamp/${arg('piece','purchase-finish')}`;
mkdirSync(out,{recursive:true});
const report={results:[],facts:[],failures:[]};const drafts=new Set();
const check=(ok,m)=>{if(!ok)report.failures.push(m);};
const browser=await chromium.launch({executablePath:process.env.CHROME});
let owner;
try {
 owner=await newOwner({shop:'Radhe Krishna Enterprises',name:'Purchase acceptance owner',prefix:'qa-purchase-finish'});
 await must('PATCH','/tenants/current',{gst_type:'regular',gstin:fixtureGstin()},owner.token);
 const unit=(await must('GET','/units',null,owner.token)).find(u=>u.code==='NOS');
 const supplier=await must('POST','/parties',{name:'Radhe Krishna Electrical Supplies',is_supplier:true,is_customer:false,state_code:'27'},owner.token);
 const item=await must('POST','/items',{name:'LED driver 42 W',unit_id:unit.id,purchase_price:'42.00',selling_price:'55.00',tax_code:'GST18',track_stock:true},owner.token);
 const seed=async number=>{const d=await must('POST','/purchases/bills',{party_id:supplier.id,supplier_invoice_number:number,itc_eligible:true,lines:[{item_id:item.id,description:item.name,unit_code:'NOS',qty:'2',unit_cost:'40.00',tax_code:'GST18'}]},owner.token);drafts.add(d.id);return d;};
 for(const width of arg('widths','390,320,1024,1280').split(',').map(Number)) for(const theme of arg('themes','light,dark').split(',')) {
  const tag=`${width}-${theme}-${locale}`;
  const ctx=await browser.newContext({viewport:{width,height:width<768?844:900},isMobile:width<768,hasTouch:width<768});
  await ctx.addCookies([{name:'ub_locale',value:locale,domain:new URL(base).hostname,path:'/'},{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=async(name,root='main')=>{
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
   const m=await measureCustomers(page,root);
   if(root==='[role=dialog]')m.cut.push(...(await coveredOverlayText(page.getByRole('dialog'))).map(t=>`Covered: ${t}`));
   else {const dock=page.getByTestId('purchase-dock');if(await dock.count()){const d=await measureCustomers(page,'[data-testid=purchase-dock]');m.cut.push(...d.cut);m.lowContrast.push(...d.lowContrast);}}
   if (['reply-lost','payment-refused'].includes(name)) {
    const notice=page.locator('main [role=status]').filter({hasText:word(name==='reply-lost'?'record.uncertain':'record.paymentRefused')});
    m.cut.push(...(await coveredOverlayText(notice)).map(t=>`Recovery explanation covered: ${t}`));
   }
   report.results.push({tag,name,...m});check(!m.overflow&&!m.cut.length&&!m.lowContrast.length,`${tag} ${name}: ${JSON.stringify(m)}`);
   await page.screenshot({path:`${out}/${tag}-${name}.png`});console.log(tag,name,m.overflow,m.cut.length,m.lowContrast.length);
  };
  await page.goto(`${base}/login/email`);await page.fill('input[type=email]',owner.email);await page.fill('input[type=password]',owner.password);await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));
  const bill=await seed(`RKE-LOST-${tag}`),before=await must('GET',`/items/${item.id}`,null,owner.token);
  const posts=[];let dropped=false,release;const hold=new Promise(r=>release=r);
  await page.route(`**/api/v1/purchases/bills/${bill.id}/record`,async route=>{
   posts.push({key:route.request().headers()['idempotency-key'],body:route.request().postDataJSON()});
   if(!dropped){dropped=true;const response=await route.fetch();check(response.ok(),`${tag}: first Record failed`);await hold;return route.abort('connectionreset');}
   return route.continue();
  });
  await page.goto(`${base}/purchases/bills/${bill.id}/edit`);
  await page.getByTestId('purchase-dock').getByRole('button',{name:word('editor.record'),exact:true}).click();
  await page.getByTestId('purchase-paid-now-confirm').waitFor();await shot('paid-now','[role=dialog]');
  await page.getByTestId('purchase-paid-now-confirm').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid=purchase-paid-now-confirm]')?.getAttribute('aria-busy')==='true');
  check(await page.getByRole('dialog').locator('input[inputmode=decimal]').isDisabled(),`${tag}: submitted payment still editable`);
  await shot('record-busy','[role=dialog]');release();
  const recovery=page.getByRole('button',{name:word('record.check'),exact:true});
  await recovery.waitFor();await shot('reply-lost');
  check(await page.getByTestId('purchase-dock').getByRole('button',{name:word('editor.saveDraft'),exact:true}).isDisabled(),`${tag}: uncertain bill permits Save`);
  check(await page.getByRole('button',{name:word('record.payLater'),exact:true}).count()===0,`${tag}: lost payment offers credit`);
  await page.getByRole('button',{name:word('editor.close'),exact:true}).click();
  await shot('uncertain-leave','[role=dialog]');
  await page.getByRole('dialog').getByRole('button',{name:word('draft.stay'),exact:true}).click();
  await recovery.click();await page.waitForURL(u=>u.pathname===`/purchases/bills/${bill.id}`);
  const saved=await must('GET',`/purchases/bills/${bill.id}`,null,owner.token),actual=await must('GET',`/items/${item.id}`,null,owner.token);
  check(saved.status!=='draft'&&saved.number&&saved.amount_paid===saved.grand_total,`${tag}: cash Record missing`);
  check(posts.length===1||(posts.length===2&&posts[0].key===posts[1].key&&JSON.stringify(posts[0].body)===JSON.stringify(posts[1].body)),`${tag}: original intent changed`);
  check(actual.purchase_price==='40.00'&&actual.selling_price==='55.00',`${tag}: item defaults wrong`);
  check(Number(actual.on_hand)-Number(before.on_hand)===2,`${tag}: duplicated or missing stock`);
  report.facts.push({tag,case:'lost-record',status:saved.status,total:saved.grand_total,paid:saved.amount_paid,posts:posts.length,stockBefore:before.on_hand,stockAfter:actual.on_hand});drafts.delete(bill.id);
  const refused=await seed(`RKE-REFUSED-${tag}`);let first=true;
  await page.route(`**/api/v1/purchases/bills/${refused.id}/record`,async route=>{
   if(first){first=false;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'permission_denied',message:'Payment not permitted.',details:{payment:['Not allowed.']}}})});}
   return route.continue();
  });
  await page.goto(`${base}/purchases/bills/${refused.id}/edit`);
  await page.getByTestId('purchase-dock').getByRole('button',{name:word('editor.record'),exact:true}).click();
  await page.getByTestId('purchase-paid-now-confirm').click();
  const later=page.getByTestId('purchase-dock').getByRole('button',{name:word('record.payLater'),exact:true});
  await later.waitFor();await shot('payment-refused');
  check((await must('GET',`/purchases/bills/${refused.id}`,null,owner.token)).status==='draft',`${tag}: refusal silently recorded`);
  await later.click();await page.waitForURL(u=>u.pathname===`/purchases/bills/${refused.id}`);
  const credit=await must('GET',`/purchases/bills/${refused.id}`,null,owner.token);
  check(credit.status==='recorded'&&credit.amount_paid==='0.00'&&credit.amount_due===credit.grand_total,`${tag}: explicit Pay later failed`);drafts.delete(refused.id);
  report.facts.push({tag,case:'explicit-pay-later',status:credit.status,paid:credit.amount_paid,due:credit.amount_due});
  check(!errors.length,`${tag}: ${errors.join(';')}`);await ctx.close();
 }
} finally {
 if(owner)for(const id of drafts)await api('DELETE',`/purchases/bills/${id}`,null,owner.token);
 writeFileSync(`${out}/results-${locale}.json`,JSON.stringify(report,null,2));await browser.close();
}
console.log(JSON.stringify(report.failures,null,2));process.exitCode=report.failures.length?1:0;
