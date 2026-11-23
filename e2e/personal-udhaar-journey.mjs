/** Real writes only to named local QA: personal contact and two main-book entries. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.E2E_FRONTEND??'http://127.0.0.1:3000';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local QA only');
const out=process.env.E2E_SHOTS??'/tmp/personal-udhaar-journey';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME});const result={checks:[],contact:null};
const check=(label,ok)=>{result.checks.push({label,ok});if(!ok)throw Error(label);console.log('PASS',label);};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();
 await page.goto(base+'/login/email');await page.fill('input[type=email]','scale@digikhaato.test');await page.fill('input[type=password]','Scale-Run-2026!');await page.click('button[type=submit]');await page.waitForURL(u=>!u.pathname.startsWith('/login'));
 await page.goto(base+'/khata',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Add person',exact:true}).filter({visible:true}).click();
 const form=page.getByRole('dialog');await form.getByLabel('Name',{exact:true}).fill('Ravi Kumar');
 const mobile='9'+String(Date.now()).slice(-9);await form.getByRole('textbox',{name:'Mobile number',exact:true}).fill(mobile);
 check('Add person has no amount field',await form.locator('input[inputmode=decimal]').count()===0);
 const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/personal/parties'&&r.request().method()==='POST');
 await form.getByRole('button',{name:'Save and open khata'}).click();const response=await created;const sent=response.request().postDataJSON();
 check('Contact wire contains only name and mobile',JSON.stringify(Object.keys(sent).sort())===JSON.stringify(['mobile','name']));check('Contact saved',response.status()===201);
 const body=await response.json();const id=body.data.id;result.contact=id;await page.waitForURL(u=>u.pathname===`/parties/${id}`);await page.getByTestId('udhaar-person-overview').waitFor();
 check('No business Details section',await page.getByRole('button',{name:'Details',exact:true}).count()===0);
 const entry=async(label,amount,note,expected)=>{
  await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).click();const sheet=page.getByRole('dialog');
  await sheet.getByLabel('Amount',{exact:true}).fill(amount);if(note)await sheet.getByLabel(/^Note/).fill(note);
  check(label+' shows no date or payment-method control',await sheet.locator('input[type=date]').count()===0&&await sheet.getByText('Payment mode',{exact:true}).count()===0);
  await page.screenshot({path:out+'/entry-'+(label==='Gave money'?'gave':'got')+'.png'});
  let writes=0,release;const held=new Promise(resolve=>{release=resolve;});
  const hold=async route=>{if(route.request().method()==='POST'&&new URL(route.request().url()).pathname.endsWith('/ledger-entries')){writes++;await held;}await route.continue();};
  await page.route('**/api/v1/**',hold);
  const saved=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/ledger-entries'));
  await sheet.getByRole('button',{name:'Save',exact:true}).evaluate(button=>{button.click();button.click();button.click();});
  await page.waitForTimeout(250);release();const answer=await saved;await page.unroute('**/api/v1/**',hold);
  check(label+' three fast taps issue one write',writes===1);check(label+' saved',answer.status()===201);
  const payload=answer.request().postDataJSON();check(label+' note remains optional',payload.note===(note??''));check(label+' does not invent Cash',payload.payment_mode===undefined&&payload.simple===true);
  await sheet.waitFor({state:'hidden'});const read=await(await ctx.request.get(`${base}/api/v1/personal/parties/${id}`)).json();check(label+' has correct server balance',read.data.balance===expected);
 };
 await entry('Gave money','500','', '500.00');await entry('Got money','200','Returned after dinner','300.00');
 await page.getByTestId('udhaar-person-overview').getByText('₹300.00',{exact:true}).waitFor();await page.screenshot({path:out+'/personal-history.png'});
 const history=await(await ctx.request.get(`${base}/api/v1/personal/parties/${id}/ledger-entries`)).json();check('Exactly two entries remain in history',history.data.length===2);check('Received entry keeps unknown method',history.data.find(e=>e.direction==='credit').payment_mode===null);
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();const message=page.getByRole('dialog').getByRole('textbox',{name:'Message'});await message.waitFor();await message.fill('Ravi, please return the remaining ₹300.');check('Reminder is editable',await message.inputValue()==='Ravi, please return the remaining ₹300.');await page.screenshot({path:out+'/personal-reminder.png'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'SMS',exact:true}).click();const smsDialog=page.getByRole('dialog');const smsBox=smsDialog.getByRole('textbox',{name:'Message'});await smsBox.waitFor();await smsBox.fill('Ravi, ₹300 remains.');
 check('SMS composer has only SMS action',await smsDialog.getByRole('link',{name:'SMS',exact:true}).count()===1&&await smsDialog.getByRole('link',{name:'WhatsApp',exact:true}).count()===0);
 const smsUrl=await smsDialog.getByRole('link',{name:'SMS',exact:true}).getAttribute('href');check('SMS handoff uses the edited words',decodeURIComponent(smsUrl).includes('Ravi, ₹300 remains.'));
 await page.screenshot({path:out+'/personal-sms.png'});await ctx.close();
}finally{writeFileSync(out+'/results.json',JSON.stringify(result,null,2));await browser.close();}
