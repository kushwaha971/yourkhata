/** Local merchant money acceptance: two suppliers/two electrical products,
 * actual PhonePe part payment, supplier credit, advance and zero-cost goods.
 * This records local ledger facts only; it never initiates a real payment/send.
 */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {newOwner,must,api,fixtureGstin} from './lib/fixtures.mjs';
import {measureCustomers} from './revamp-customers.mjs';
import {coveredOverlayText} from './lib/measureOverlayText.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.E2E_FRONTEND??'http://localhost:3000';
for(const u of [base,process.env.E2E_BACKEND??'http://localhost:8000/api/v1'])if(!['localhost','127.0.0.1'].includes(new URL(u).hostname))throw Error('Local QA only');
const out='/tmp/e2e-shots/revamp/purchase-money';mkdirSync(out,{recursive:true});
const report={results:[],facts:[],failures:[]};const check=(ok,m)=>{if(!ok)report.failures.push(m);};
const browser=await chromium.launch({executablePath:process.env.CHROME});
try{
 for(const width of [390,1280]){
  const owner=await newOwner({shop:'Radhe Krishna Enterprises',name:'Purchase money acceptance',prefix:'qa-purchase-money'});
  await must('PATCH','/tenants/current',{gst_type:'regular',gstin:fixtureGstin()},owner.token);
  const unit=(await must('GET','/units',null,owner.token)).find(u=>u.code==='NOS');
  const products=[];for(const [name,cost,price]of[['LED driver 42 W','42.00','55.00'],['Copper cable roll 2.5 mm','90.00','125.00']])products.push(await must('POST','/items',{name,unit_id:unit.id,purchase_price:cost,selling_price:price,tax_code:'GST18',track_stock:true},owner.token));
  const suppliers=[];for(const name of ['Radhe Krishna Electrical Supplies','Radhe Krishna Power Distributors'])suppliers.push(await must('POST','/parties',{name,is_supplier:true,is_customer:false,gstin:fixtureGstin(),state_code:'27'},owner.token));
  const ctx=await browser.newContext({viewport:{width,height:width<768?844:900}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/login/email`);await page.fill('input[type=email]',owner.email);await page.fill('input[type=password]',owner.password);await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));
  const make=async(index,number,costs)=>must('POST','/purchases/bills',{party_id:suppliers[index].id,supplier_invoice_number:number,supplier_invoice_date:new Date().toISOString().slice(0,10),lines:products.map((i,n)=>({item_id:i.id,description:i.name,qty:'1',unit_code:'NOS',unit_cost:costs[n],tax_code:'GST18'}))},owner.token);
  const shot=async(name)=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);const m=await measureCustomers(page,'[role=dialog]');m.cut.push(...await coveredOverlayText(page.getByRole('dialog')));report.results.push({tag:`${width}-light-en`,name,...m});check(!m.overflow&&!m.cut.length&&!m.lowContrast.length,`${width} ${name}: ${JSON.stringify(m)}`);await page.screenshot({path:`${out}/${width}-light-en-${name}.png`});};
  const finish=async(d,mode,amount)=>{
   await page.goto(`${base}/purchases/bills/${d.id}/edit`);
   const request=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api/v1/purchases/bills/${d.id}/record`);
   await page.getByTestId('purchase-dock').getByRole('button',{name:'Record',exact:true}).click();
   if(d.grand_total!=='0.00'){
    await page.getByTestId('purchase-paid-now-confirm').waitFor();
    if(mode==='later')await page.getByTestId('purchase-pay-later').click();
    else{await page.getByRole('dialog').getByLabel('Amount',{exact:true}).fill(amount);if(mode==='upi')await page.getByRole('radio',{name:'PhonePe',exact:true}).click();await shot(mode==='upi'?'part-upi':'advance-cash');await page.getByTestId('purchase-paid-now-confirm').click();}
   }
   const response=await request;check(response.ok(),`${width}: ${mode} refused ${response.status()}`);const body=response.request().postDataJSON();await page.waitForURL(u=>u.pathname===`/purchases/bills/${d.id}`);const saved=await must('GET',`/purchases/bills/${d.id}`,null,owner.token);return{saved,body};
  };
  const first=await make(0,'RKES-1043',['40.00','90.00']);const partial=await finish(first,'upi','20');
  check(partial.saved.status==='partially_paid'&&partial.saved.amount_paid==='20.00',`${width}: part payment not retained`);
  check(partial.body.payment.mode_breakup[0].mode==='upi'&&partial.body.payment.mode_breakup[0].upi_app==='phonepe',`${width}: PhonePe method lost`);
  const second=await make(1,'RKP-2044',['39.00','88.00']);const credit=await finish(second,'later');
  check(credit.saved.amount_paid==='0.00'&&credit.saved.amount_due===credit.saved.grand_total&&!credit.body.payment,`${width}: supplier credit was not separate`);
  const original=await must('GET',`/purchases/bills/${first.id}`,null,owner.token);
  check(original.lines[0].unit_cost==='40.0000'&&original.lines[1].unit_cost==='90.0000',`${width}: new supplier costs repriced earlier bill`);
  const beforeAdvance=await must('GET',`/items/${products[0].id}`,null,owner.token);
  check(beforeAdvance.purchase_price==='39.00'&&beforeAdvance.selling_price==='55.00'&&beforeAdvance.on_hand==='2.000',`${width}: supplier/product graph or defaults wrong`);
  const third=await make(0,'RKES-1045',['40.00','90.00']);const advance=await finish(third,'cash','200');
  check(advance.saved.amount_due==='0.00'&&advance.body.payment.mode_breakup[0].amount==='200.00',`${width}: advance payment not preserved`);
  const free=await make(1,'RKP-FREE',['0.00','0.00']);const zero=await finish(free,'zero');
  check(zero.saved.grand_total==='0.00'&&zero.saved.amount_paid==='0.00'&&!zero.body.payment,`${width}: free goods tried to pay or used defaults`);
  check(await page.getByTestId('purchase-paid-now-confirm').count()===0,`${width}: zero bill opened a money question`);
  for(const [index,i]of products.entries()){const current=await must('GET',`/items/${i.id}`,null,owner.token);check(current.on_hand==='4.000'&&current.purchase_price==='0.00'&&current.selling_price===(index===0?'55.00':'125.00'),`${width}: stock or pricing separation failed`);}
  const vouchers=await must('GET','/payments?book=shop',null,owner.token);
  report.facts.push({width,part:{status:partial.saved.status,paid:partial.saved.amount_paid,due:partial.saved.amount_due},credit:{paid:credit.saved.amount_paid,due:credit.saved.amount_due},advance:{paid:advance.saved.amount_paid,due:advance.saved.amount_due,payout:advance.body.payment.mode_breakup[0].amount},zero:{status:zero.saved.status,total:zero.saved.grand_total},twoSuppliersTwoProducts:true,stockEach:'4.000',paymentRows:Array.isArray(vouchers)?vouchers.length:null});
  check(!errors.length,`${width}: ${errors.join(';')}`);await ctx.close();
 }
}finally{writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report.failures,null,2));process.exitCode=report.failures.length?1:0;
