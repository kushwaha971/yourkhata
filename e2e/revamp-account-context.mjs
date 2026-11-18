/** R-DEC-18/BP-13: stale tabs must not read or write under a new cookie context.
 * Uses local synthetic operators/firms only; asserts zero created contacts. */
import {readFileSync,writeFileSync} from 'node:fs';
import {measureCustomers} from './revamp-customers.mjs';

export async function shootAccountContext({signedInContext,widths,themes,locale,dir,frontend,failures}) {
 const fixture=JSON.parse(readFileSync(process.env.E2E_SCOPE_FIXTURE ?? '/tmp/bp12-fixture.json','utf8'));
 const words={...JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`,import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/parties.${locale}.json`,import.meta.url),'utf8')),...JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/partyBooks.${locale}.json`,import.meta.url),'utf8'))};
 const results=[];
 const csrf=async ctx=>(await ctx.cookies()).find(c=>c.name==='ub_csrf')?.value;
 const post=async(ctx,path,body)=>ctx.request.post(`${frontend}/api/v1${path}`,{headers:{'X-CSRF-Token':await csrf(ctx)},data:body});
 for(const width of widths)for(const theme of themes)for(const mode of ['read','write','business-write']){
  const ctx=await signedInContext(width,theme),page=await ctx.newPage(),tag=`${width}-${theme}-${locale}-${mode}`;
  // Sign-in can remember the second firm; force the known local fixture before opening this tab.
  const me=await (await ctx.request.get(`${frontend}/api/v1/auth/me`)).json();
  if(me.data.user.id!==fixture.user)throw new Error('Expected the first local operator');
  if(me.data.active_tenant_id!==fixture.tenant){const switched=await post(ctx,'/auth/switch-tenant',{tenant_id:fixture.tenant});if(!switched.ok())throw new Error('Could not select local fixture firm');}
  await page.goto(`${frontend}/suppliers`,{waitUntil:'networkidle'});
  await page.getByTestId('count-line').waitFor();
  // Freeze the passive badge poll until the explicit stale action; otherwise it
  // correctly detects the cookie swap first and pre-empts the write-intent case.
  let pausePoll=true;
  await page.route('**/api/v1/notifications/unread-count',route=>pausePoll?route.fulfill({status:200,json:{data:{count:1,by_category:{stock:1}}}}):route.continue());
  // The existing party search treats digits as a phone query: numeric viewport
  // labels accidentally matched a seeded supplier's mobile (no write occurred).
  const widthName={320:'narrow',390:'phone',1024:'tablet',1280:'desktop'}[width];
  const sentinel=`Radhe Krishna Enterprises LED context ${widthName} ${theme} ${locale} ${mode}`;
  if(mode!=='read'){
   await page.getByRole('button',{name:words['parties.list.supplier.add'],exact:true}).click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForLoadState('networkidle');
   await dialog.locator('input[name="name"]').fill(sentinel);
  }
  let expectedActor=fixture.otherActor,expectedTenant=fixture.tenant;
  if(mode==='business-write'){
   expectedActor=fixture.user;expectedTenant=fixture.otherTenant;
   const swapped=await post(ctx,'/auth/switch-tenant',{tenant_id:expectedTenant});if(!swapped.ok())throw new Error(`Second firm switch ${swapped.status()}`);
  }else{
   const signedOut=await post(ctx,'/auth/logout',{});if(!signedOut.ok())throw new Error('Could not end first cookie session');
   const other=await ctx.newPage();await other.goto(`${frontend}/login/email`);
   await other.fill('input[type=email]',fixture.otherActorEmail);await other.fill('input[type=password]',process.env.E2E_PASSWORD ?? 'Scale-Run-2026!');await other.click('button[type=submit]');
   await other.waitForURL(url=>!url.pathname.startsWith('/login'));await other.waitForLoadState('networkidle');
  }
  const check=async(state,root)=>{await page.evaluate(()=>document.fonts.ready);const m=await measureCustomers(page,root);results.push({width,theme,locale,mode,state,...m});await page.screenshot({path:`${dir}/${tag}-${state}.png`});console.log(`${tag} ${state}: overflow ${m.overflow}, cut ${m.cut.length}, contrast ${m.lowContrast.length}`);if(m.overflow||m.cut.length||m.lowContrast.length)failures.push(`${tag} ${state}: ${JSON.stringify(m)}`);};
  const endpoint=mode==='read'?'/api/v1/notifications':'/api/v1/parties';
  const loaded=page.waitForEvent('load');
  page.on('response',r=>{if(r.status()===409)pausePoll=false;});
  const denied=page.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()===(mode==='read'?'GET':'POST')&&r.status()===409);
  const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/parties'&&r.request().method()==='GET'&&r.request().headers()['x-expected-user-id']===expectedActor&&r.request().headers()['x-expected-tenant-id']===expectedTenant);
  if(mode==='read')await page.locator('[data-testid="notification-bell"]:visible').click();
  else await page.getByRole('dialog').getByRole('button',{name:words['parties.form.submit.create.supplier'],exact:true}).click();
  const refusal=await denied;
  const headers=refusal.request().headers();
  if(headers['x-expected-user-id']!==fixture.user||headers['x-expected-tenant-id']!==fixture.tenant)throw new Error('Old-tab intent headers changed before refusal');
  const code=(await refusal.json()).error?.code;
  if(code!==(mode==='business-write'?'tenant_context_changed':'session_context_changed'))throw new Error(`Wrong conflict ${code}`);
  const message=words[mode==='business-write'?'tenant.switcher.staleTab':'auth.session.changed'];
  await page.getByText(message,{exact:true}).waitFor();await check('changed-context','[data-testid="snackbar"]');
  await loaded;
  await page.goto(`${frontend}/suppliers`,{waitUntil:'networkidle'});
  const ready=await refreshed;if(!ready.ok())throw new Error('Reload did not restore authorized context');
  if(mode==='business-write')await page.getByText(words['parties.list.supplier.empty.title'],{exact:true}).waitFor();
  else await page.getByTestId('count-line').waitFor();
  await check('reloaded');
  if(mode!=='business-write'){
   await page.locator('[data-testid="notification-bell"]:visible').click();
   const panel=page.getByTestId('notification-panel');await panel.waitFor();
   await page.waitForFunction(()=>document.querySelectorAll('[data-testid="notification-row"]').length===2);
   const notes=await (await ctx.request.get(`${frontend}/api/v1/notifications`)).json();
   const ids=notes.data.map(row=>row.id);
   if(fixture.otherActorNotes.some(id=>!ids.includes(id))||ids.includes(fixture.notifications.own))throw new Error('New actor inbox includes the previous recipient');
   await check('new-actor-inbox','[data-testid="notification-panel"]');
  }
  if(mode!=='read'){
   const found=await (await ctx.request.get(`${frontend}/api/v1/parties?book=shop&type=supplier&q=${encodeURIComponent(sentinel)}`)).json();
   if(found.meta.total!==0)throw new Error('Stale tab created a supplier in another context');
  }
  await ctx.close();console.log(`${tag}: stale ${mode} refused before effect; reloaded as expected actor/firm PASS`);
 }
 writeFileSync(`${dir}/measurements-${locale}.json`,JSON.stringify(results,null,2));
}
