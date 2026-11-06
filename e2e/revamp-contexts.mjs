/** R-DEC-18: local Shop-only operator, real API scope checks and retained-search states.
 * Reuses the screen measurement harness; no financial transaction is saved. */
import {readFileSync,writeFileSync} from 'node:fs';
import {measureCustomers} from './revamp-customers.mjs';

export async function shootContexts({signedInContext,widths,themes,locale,dir,frontend,failures}) {
 const fixture=JSON.parse(readFileSync(process.env.E2E_SCOPE_FIXTURE ?? '/tmp/bp12-fixture.json','utf8'));
 const words={...JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`,import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/parties.${locale}.json`,import.meta.url),'utf8'))};
 Object.assign(words,JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/partyBooks.${locale}.json`,import.meta.url),'utf8')));
 const purchaseWords=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/purchases.${locale}.json`,import.meta.url),'utf8'));
 const paymentWords=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/payments.${locale}.json`,import.meta.url),'utf8'));
 const results=[];
 for(const width of widths)for(const theme of themes){
  const ctx=await signedInContext(width,theme),p=await ctx.newPage(),tag=`${width}-${theme}-${locale}`;
  const check=async (state,root)=>{await p.evaluate(()=>document.fonts.ready);const m=await measureCustomers(p,root);results.push({width,theme,locale,state,...m});await p.screenshot({path:`${dir}/${tag}-${state}.png`});if(m.overflow||m.cut.length||m.lowContrast.length)failures.push(`${tag} ${state}: ${JSON.stringify(m)}`);console.log(`${tag} ${state}: overflow ${m.overflow}, cut ${m.cut.length}, contrast ${m.lowContrast.length}`);};
  await p.goto(`${frontend}/suppliers`,{waitUntil:'networkidle'});
  // Actual recipient, app and tenant checks against the same-origin live API.
  const notes=await (await ctx.request.get(`${frontend}/api/v1/notifications`)).json();
  const ids=notes.data.map(row=>row.id);
  if(!ids.includes(fixture.notifications.own)||['khata','library','other_user'].some(key=>ids.includes(fixture.notifications[key])))throw new Error('Notification recipient/app scope failed');
  const count=await (await ctx.request.get(`${frontend}/api/v1/notifications/unread-count`)).json();
  if(count.data.count!==notes.meta.unread_count)throw new Error('Notification badge/list disagree');
  const csrf=(await ctx.cookies()).find(cookie=>cookie.name==='ub_csrf')?.value;
  for(const key of ['khata','library','other_user']){const denied=await ctx.request.post(`${frontend}/api/v1/notifications/${fixture.notifications[key]}/read`,{headers:{'X-CSRF-Token':csrf},data:{}});if(denied.status()!==404)throw new Error(`Forbidden notification read expected 404, got ${denied.status()}: ${await denied.text()}`);}
  if((await ctx.request.get(`${frontend}/api/v1/parties?book=main&ordering=-last_activity_at`)).status()!==403)throw new Error('Shop operator gained main-book activity access');
  const label=words['parties.quickSearch.label'];
  const answer=p.waitForResponse(r=>r.url().includes('/api/v1/parties?')&&new URL(r.url()).searchParams.get('ordering')==='-last_activity_at');
  if(width<1024)await p.getByRole('button',{name:label,exact:true}).click();
  const search=p.getByRole('combobox',{name:label,exact:true});await search.click();
  const response=await answer;
  if(!response.ok()||new URL(response.url()).searchParams.get('book')!=='shop')throw new Error('Header recent search did not use authorized Shop context');
  const pending=p.waitForResponse(r=>r.url().includes('/api/v1/parties?')&&new URL(r.url()).searchParams.get('q')==='Radhe Krishna Enterprises');
  await search.fill('Radhe Krishna Enterprises');await pending;await p.getByRole('option').first().waitFor();await p.waitForTimeout(100);await p.locator('[role="option"][aria-disabled="false"]').filter({hasText:'Wholesale Division'}).waitFor();await check('search-ready','[role="listbox"]');
  const supplier=p.getByRole('option').filter({hasText:'Wholesale Division'});
  if((await supplier.innerText()).includes('₹'))throw new Error('Shop global search displayed a combined balance');
  await supplier.click();await p.waitForURL(url=>url.pathname===`/parties/${fixture.supplier}`&&url.searchParams.get('from')==='suppliers');
  await p.getByTestId('shop-person-overview').waitFor();
  await p.getByText(words['parties.person.noUnpaid'],{exact:true}).waitFor();
  await p.getByText(words['parties.person.noPayments'],{exact:true}).waitFor();
  await check('supplier-context');
  // Purchase uses the identical shared picker, with an explicit supplier role.
  await p.goto(`${frontend}/purchases/bills/new`,{waitUntil:'networkidle'});
  const field=p.getByRole('combobox',{name:purchaseWords['purchases.editor.supplier'],exact:true});
  const suppliers=p.waitForResponse(r=>r.url().includes('/api/v1/parties?')&&new URL(r.url()).searchParams.get('type')==='supplier');
  await field.click();const picked=await suppliers;
  if(!picked.ok()||new URL(picked.url()).searchParams.get('book')!=='shop')throw new Error('Purchase picker borrowed Udhaar context');
  await field.fill('Radhe Krishna Enterprises');await p.getByRole('option').filter({hasText:'Wholesale Division'}).waitFor();await p.waitForTimeout(400);
  await p.locator('[role="option"][aria-disabled="false"]').filter({hasText:'Wholesale Division'}).waitFor();
  await check('purchase-supplier-picker','[role="listbox"]');
  await p.getByRole('option').filter({hasText:'Wholesale Division'}).click();
  await check('chosen-supplier','[data-testid="purchase-supplier"]');
  await p.goto(`${frontend}/payments?add=1`,{waitUntil:'networkidle'});
  const drawer=p.getByRole('dialog');await drawer.waitFor();
  const from=drawer.getByRole('combobox',{name:paymentWords['payments.party.from'],exact:true});
  const defaultParty=p.waitForResponse(r=>r.url().includes('/api/v1/parties?')&&new URL(r.url()).searchParams.get('ordering')==='-last_activity_at');
  await from.click();const defaultResponse=await defaultParty;
  if(!defaultResponse.ok()||new URL(defaultResponse.url()).searchParams.get('book')!=='shop')throw new Error('Default Shop payment picker used another book');
  await from.fill('Radhe Krishna Enterprises');
  await drawer.locator('[role="option"][aria-disabled="false"]').filter({hasText:'Wholesale Division'}).waitFor();
  await check('payment-party-picker','[role="listbox"]');
  await ctx.close();console.log(`${tag}: Shop-only search, supplier route, purchase picker and notification app/recipient/count/direct-read PASS`);
 }
 writeFileSync(`${dir}/measurements-${locale}.json`,JSON.stringify(results,null,2));
}
