/** §7 whole-editor acceptance, local QA only. No external messages or production data.
 * Real inline supplier creation must retain the bill and never submit its opening form.
 * Phone-matched contacts/users in different businesses must not grant data access.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { newOwner, must, api, fixtureGstin, uniqMobile } from './lib/fixtures.mjs';
import { measureCustomers } from './revamp-customers.mjs';
import { coveredOverlayText } from './lib/measureOverlayText.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const arg=(k,d)=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const base=process.env.E2E_FRONTEND??'http://localhost:3000';
for(const u of [base,process.env.E2E_BACKEND??'http://localhost:8000/api/v1'])if(!['localhost','127.0.0.1'].includes(new URL(u).hostname))throw Error('Local QA only');
const locale=arg('locale','en'),hi=locale==='hi';
const words=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/purchases.${locale}.json`,import.meta.url),'utf8'));
const common=JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`,import.meta.url),'utf8'));
const contacts=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/parties.${locale}.json`,import.meta.url),'utf8'));
const w=k=>words[`purchases.${k}`];
const out=`${process.env.E2E_SHOTS??'/tmp/e2e-shots'}/revamp/${arg('piece','purchase-contracts')}`;mkdirSync(out,{recursive:true});
const result={results:[],facts:[],failures:[]};const drafts=new Set();let returnBill;
const check=(ok,m)=>{if(!ok)result.failures.push(m);};
const browser=await chromium.launch({executablePath:process.env.CHROME});let owner;
try {
 owner=await newOwner({shop:'Radhe Krishna Enterprises',name:'Purchase contract owner',prefix:'qa-purchase-contract'});
 await must('PATCH','/tenants/current',{gst_type:'regular',gstin:fixtureGstin()},owner.token);
 const unit=(await must('GET','/units',null,owner.token)).find(u=>u.code==='NOS');
 const sharedMobile=uniqMobile();
 const supplier=await must('POST','/parties',{name:'Radhe Krishna Electrical Supplies',mobile:sharedMobile,is_supplier:true,is_customer:false,gstin:fixtureGstin(),state_code:'27'},owner.token);
 const item=await must('POST','/items',{name:'LED driver 42 W',unit_id:unit.id,purchase_price:'42.00',selling_price:'55.00',tax_code:'GST18',track_stock:true},owner.token);
 const cable=await must('POST','/items',{name:'Copper cable roll 2.5 mm',unit_id:unit.id,purchase_price:'90.00',selling_price:'125.00',tax_code:'GST18',track_stock:true},owner.token);
 const bill=await must('POST','/purchases/bills',{party_id:supplier.id,supplier_invoice_number:'RKES-1043',supplier_invoice_date:new Date().toISOString().slice(0,10),lines:[{item_id:item.id,description:item.name,qty:'2',unit_code:'NOS',unit_cost:'40.00',tax_code:'GST18'},{item_id:cable.id,description:cable.name,qty:'2',unit_code:'NOS',unit_cost:'90.00',tax_code:'GST18'}]},owner.token);drafts.add(bill.id);
 const other=await newOwner({shop:'Another electrical business',mobile:sharedMobile,prefix:'qa-purchase-other-owner'});
 const ownContact=await must('POST','/parties',{name:'Own electrical supplier',mobile:sharedMobile,is_supplier:true,is_customer:false},other.token);
 check(ownContact.id!==supplier.id,'Matching phone merged contacts across businesses');
 for(const path of [`/purchases/bills/${bill.id}`,`/parties/${supplier.id}?book=shop`,`/items/${item.id}`]){
  const denied=await api('GET',path,null,other.token);check(denied.status===404,`Other shop owner saw ${path}: ${denied.status}`);result.facts.push({case:'other-owner-same-phone',resource:path.split('/')[1],status:denied.status});
 }
 for(const width of arg('widths','390,320,1024,1280').split(',').map(Number))for(const theme of arg('themes','light,dark').split(',')){
  const tag=`${width}-${theme}-${locale}`;
  const ctx=await browser.newContext({viewport:{width,height:width<768?844:900},isMobile:width<768,hasTouch:width<768});
  await ctx.addCookies([{name:'ub_locale',value:locale,domain:new URL(base).hostname,path:'/'},{name:'ub_theme_choice',value:theme,domain:new URL(base).hostname,path:'/'}]);
  const page=await ctx.newPage();const errors=[];let records=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&/\/purchases\/bills\/[^/]+\/record$/.test(new URL(r.url()).pathname))records++;});
  const shot=async(name,root='main')=>{
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
   const m=await measureCustomers(page,root);
   if(root==='[role=dialog]')m.cut.push(...(await coveredOverlayText(page.getByRole('dialog'))).map(t=>`Covered: ${t}`));
   result.results.push({tag,name,...m});check(!m.overflow&&!m.cut.length&&!m.lowContrast.length,`${tag} ${name}: ${JSON.stringify(m)}`);
   await page.screenshot({path:`${out}/${tag}-${name}.png`});console.log(tag,name,m.overflow,m.cut.length,m.lowContrast.length);
  };
  await page.goto(`${base}/login/email`);await page.fill('input[type=email]',owner.email);await page.fill('input[type=password]',owner.password);await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));
  // A held then failed context read is a visible load/error/retry, not a permanent skeleton.
  let first=true,release;const hold=new Promise(r=>release=r);
  await page.route('**/api/v1/tenants/current',async route=>{
   if(first&&route.request().method()==='GET'){first=false;await hold;return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'server_error',message:'Local QA context read failed.',details:{}}})});}
   return route.continue();
  });
  await page.goto(`${base}/purchases/bills/${bill.id}/edit`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(300);await shot('context-loading');release();
  const retry=page.getByRole('button',{name:hi?'फिर कोशिश करें':'Try again',exact:true});await retry.waitFor();await shot('context-error');await retry.click();
  await page.getByTestId('purchase-header').getByRole('button',{name:new RegExp(`^${supplier.name} ·`)}).waitFor();await shot('supplier-summary');
  const summary=page.getByTestId('purchase-header').getByRole('button',{name:new RegExp(`^${supplier.name} ·`)});
  await summary.click();await page.getByTestId('purchase-supplier').waitFor();await shot('supplier-edit');await summary.click();
  const quantity=page.locator('[data-line-cell][data-row="0"][data-col="1"] input');
  await quantity.fill('1.5');
  check(await quantity.inputValue()==='1.5',`${tag}: fractional quantity changed into another number`);
  await page.getByTestId('purchase-dock').getByRole('button',{name:w('editor.record'),exact:true}).click();
  check(await quantity.getAttribute('aria-invalid')==='true'&&records===0,`${tag}: invalid whole-unit quantity was not refused`);
  await shot('invalid-whole-quantity');await quantity.fill('-5');
  check(await quantity.inputValue()==='-5',`${tag}: negative quantity changed sign`);
  await shot('negative-quantity');await quantity.fill('2');
  // Add an item before its missing supplier. Saving a contact must keep that item and not submit Record.
  await page.goto(`${base}/purchases/bills/new`);
  const search=page.getByRole('combobox',{name:w('line.quickAdd.label')});await search.fill(item.name);
  await page.getByRole('option',{selected:true}).first().waitFor();await page.keyboard.press('Enter');
  const contactName=`RKE Electrical ${tag}`;
  await page.getByRole('combobox',{name:w('editor.supplier'),exact:true}).fill(contactName);
  const create=page.getByRole('button',{name:w('supplier.addNew').replace('{name}',contactName),exact:true});await create.waitFor();await shot('supplier-no-match');await create.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();check((await dialog.locator('input[name=name]').inputValue())===contactName,`${tag}: inline name not prefilled`);await shot('supplier-create','[role=dialog]');
  const savedParty=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/parties'&&r.ok());
  const savedBill=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/purchases/bills'&&r.ok());
  await dialog.getByRole('button',{name:contacts['parties.form.submit.create.supplier'],exact:true}).click();
  const contact=(await (await savedParty).json()).data;const draft=(await(await savedBill).json()).data;drafts.add(draft.id);
  await page.getByTestId('purchase-header').getByRole('button',{name:new RegExp(`^${contactName} ·`)}).waitFor();
  check(await page.getByRole('dialog').count()===0,`${tag}: saving supplier unexpectedly opened a payment/Record sheet`);
  check(records===0,`${tag}: saving supplier submitted Record`);
  check(contact.is_supplier===true&&contact.is_customer===false,`${tag}: contact role crossed books`);
  const actual=await must('GET',`/purchases/bills/${draft.id}`,null,owner.token);
  check(actual.party.id===contact.id&&actual.lines.length===1&&actual.lines[0].item_id===item.id&&actual.lines[0].unit_cost==='42.0000',`${tag}: inline supplier lost or repriced typed bill`);
  await shot('supplier-created');result.facts.push({tag,case:'inline-supplier',recordRequests:records,lines:actual.lines.length,unitCost:actual.lines[0].unit_cost});
  // Send is an existing order transition: recover its lost reply without stock, price or debt effects.
  const beforeOrder=await must('GET',`/items/${item.id}`,null,owner.token);
  const beforeParty=await must('GET',`/parties/${supplier.id}?book=shop`,null,owner.token);
  if(typeof beforeParty.summary?.balance!=='string')throw Error('Missing actual Shop summary balance');
  const order=await must('POST','/purchases/orders',{party_id:supplier.id,lines:[{item_id:item.id,description:item.name,qty:'5',unit_code:'NOS',unit_cost:'35.00',tax_code:'GST18'}]},owner.token);
  let sent=false;const sends=[];
  await page.route(`**/api/v1/purchases/orders/${order.id}/send`,async route=>{
    sends.push(route.request().postDataJSON());
    if(!sent){sent=true;const response=await route.fetch();check(response.ok(),`${tag}: order Send failed`);return route.abort('connectionreset');}
    return route.continue();
  });
  await page.goto(`${base}/purchases/orders/${order.id}/edit`);
  await page.getByTestId('purchase-dock').getByRole('button',{name:w('order.send'),exact:true}).click();
  const checkOrder=page.getByTestId('purchase-dock').getByRole('button',{name:w('order.checkSent'),exact:true});
  await checkOrder.waitFor();await shot('order-send-reply-lost');
  check(await page.getByTestId('purchase-paid-now-confirm').count()===0,`${tag}: order opened a money sheet`);
  await checkOrder.click();await page.waitForURL(u=>u.pathname===`/purchases/orders/${order.id}`);
  const sentOrder=await must('GET',`/purchases/orders/${order.id}`,null,owner.token),afterOrder=await must('GET',`/items/${item.id}`,null,owner.token);
  check(sentOrder.status==='sent'&&sends.length===1,`${tag}: order recovery sent twice or did not open saved order`);
  check(afterOrder.on_hand===beforeOrder.on_hand&&afterOrder.purchase_price===beforeOrder.purchase_price&&afterOrder.selling_price===beforeOrder.selling_price,`${tag}: sending order changed inventory/default prices`);
  const afterParty=await must('GET',`/parties/${supplier.id}?book=shop`,null,owner.token);
  check(afterParty.summary.balance===beforeParty.summary.balance,`${tag}: sending order created a Shop debt`);
  result.facts.push({tag,case:'order-send-lost-reply',sendRequests:sends.length,status:sentOrder.status,stockUnchanged:afterOrder.on_hand===beforeOrder.on_hand});
  await page.goBack();await page.waitForURL(u=>u.pathname===`/purchases/orders/${order.id}`);
  await page.getByTestId('purchase-order-create-bill').waitFor({state:'attached'});
  check(await page.getByTestId('line-items-editor').count()===0,`${tag}: Back exposed sent-order editing`);
  if(!returnBill){
    const returnDriver=await must('POST','/items',{name:'LED driver return fixture',unit_id:unit.id,purchase_price:'40.00',selling_price:'55.00',tax_code:'GST18',track_stock:true},owner.token);
    const returnCable=await must('POST','/items',{name:'Copper cable return fixture',unit_id:unit.id,purchase_price:'90.00',selling_price:'125.00',tax_code:'GST18',track_stock:true},owner.token);
    const d=await must('POST','/purchases/bills',{party_id:supplier.id,supplier_invoice_number:'RKE-RETURN-SAFETY',lines:[returnDriver,returnCable].map(i=>({item_id:i.id,description:i.name,qty:'2',unit_code:'NOS',unit_cost:i.purchase_price,tax_code:'GST18'}))},owner.token);
    returnBill=await must('POST',`/purchases/bills/${d.id}/record`,{version:d.version},owner.token,{'Idempotency-Key':crypto.randomUUID()});
  }
  await page.goto(`${base}/purchases/bills/${returnBill.id}/edit`);await page.waitForURL(u=>u.pathname===`/purchases/bills/${returnBill.id}`);
  check(await page.getByTestId('line-items-editor').count()===0,`${tag}: saved URL exposed posted-bill editing`);
  let returnPosts=0;const watch=r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/v1/purchases/debit-notes')returnPosts++;};page.on('request',watch);
  await page.getByTestId('purchase-return').waitFor({state:'attached'});
  if(!await page.getByTestId('purchase-return').isVisible()) await page.getByRole('button',{name:common['common.action.moreActions'],exact:true}).click();
  await page.getByTestId('purchase-return').filter({visible:true}).first().click();
  const returns=page.getByRole('dialog');await returns.waitFor();
  await returns.getByRole('combobox',{name:w('debitNote.reasonLabel'),exact:true}).click();
  await page.getByRole('option',{name:w('debitNote.reason.goods_returned'),exact:true}).click();
  const invalidReturn=returns.getByLabel(w('debitNote.qtyLabel').replace('{name}','LED driver return fixture'),{exact:true});
  const validReturn=returns.getByLabel(w('debitNote.qtyLabel').replace('{name}','Copper cable return fixture'),{exact:true});
  await invalidReturn.fill('-1');await validReturn.fill('1');
  check(await returns.getByTestId('debit-note-issue').isDisabled()&&await invalidReturn.getAttribute('aria-invalid')==='true',`${tag}: invalid return was silently omitted`);
  await shot('return-invalid-quantity','[role=dialog]');await invalidReturn.fill('0');
  check(await returns.getByTestId('debit-note-issue').isEnabled(),`${tag}: a valid return is blocked`);
  await shot('return-valid-quantity','[role=dialog]');check(returnPosts===0,`${tag}: return issued without explicit confirmation`);
  result.facts.push({tag,case:'posted-read-only-and-return-safety',orderBackReadOnly:true,billEditReadOnly:true,returnRequests:returnPosts});
  check(!errors.length,`${tag}: ${errors.join(';')}`);await ctx.close();
 }
} finally {
 if(owner)for(const id of drafts)await api('DELETE',`/purchases/bills/${id}`,null,owner.token);
 writeFileSync(`${out}/results-${locale}.json`,JSON.stringify(result,null,2));await browser.close();
}
console.log(JSON.stringify(result.failures,null,2));process.exitCode=result.failures.length?1:0;
