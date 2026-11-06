/** Shop person page: real scale reads plus explicitly intercepted presentation states. */
import { readFileSync, writeFileSync } from 'node:fs';
import { measureCustomers } from './revamp-customers.mjs';

export async function shootPerson({ signedInContext, widths, themes, locale, dir, frontend, failures, baseline }) {
  const results=[];
  const common=JSON.parse(readFileSync(new URL(`../frontend/locales/${locale}.json`,import.meta.url),'utf8'));
  const words=JSON.parse(readFileSync(new URL(`../frontend/locales/catalogues/payments.${locale}.json`,import.meta.url),'utf8'));

  for (const width of widths) for(const theme of themes) {
    const ctx=await signedInContext(width,theme), page=await ctx.newPage();
    const tag=`${width}-${theme}-${locale}`;
    await page.goto(`${frontend}/customers?balance=owes_me`,{waitUntil:'networkidle'});
    const list=await (await ctx.request.get(`${frontend}/api/v1/parties?book=shop&type=customer&balance=owes_me&page_size=1`)).json();
    const person=list.data[0], id=person.id;
    const original=await (await ctx.request.get(`${frontend}/api/v1/parties/${id}?book=shop`)).json();
    const check=async(state)=>{
      await page.evaluate(()=>document.fonts.ready);
      const measure=await measureCustomers(page);results.push({width,theme,locale,state,...measure});
      await page.screenshot({path:`${dir}/${tag}-${state}.png`});
      console.log(`${tag} ${state}: ${JSON.stringify(measure)}`);
      if(!baseline&&(measure.overflow||measure.cut.length||measure.lowContrast.length))failures.push(`${tag} ${state}: ${JSON.stringify(measure)}`);
    };
    await page.goto(`${frontend}/parties/${id}`,{waitUntil:'networkidle'});await check('live');
    if(!baseline) {
      const actions=width<1024?page.getByTestId('shop-person-dock'):page.locator('main header');
      let releaseBills;
      const heldBills=new Promise(resolve=>{releaseBills=resolve;});
      await page.route('**/api/v1/payments/open-documents?**',async route=>{
        await heldBills;
        await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'server_error',message:'Could not load bills.',details:{}}})});
      });
      await actions.locator('button').first().click();
      const drawer=page.getByRole('dialog'); await drawer.waitFor();
      const amount=drawer.locator('input[inputmode="decimal"]').first(); await amount.waitFor();
      const geometry=await drawer.evaluate(panel=>({width:panel.getBoundingClientRect().width,active:document.activeElement?.getAttribute('name')}));
      await check('drawer-loading'); releaseBills();
      await drawer.getByText(words['payments.counter.billsError'],{exact:true}).waitFor();
      /* 08 §6 Error / partial: with Auto on the server settles oldest first, so
         Save stays allowed and the footer says how the bills will be matched. */
      if(await drawer.getByTestId('payment-save').isDisabled()) failures.push(`${tag}: Auto save held without bill read`);
      if(!(await drawer.getByText(words['payments.counter.matchLater'],{exact:true}).count())) failures.push(`${tag}: no "matched oldest first" note`);
      await check('drawer-read-error');
      await page.unroute('**/api/v1/payments/open-documents?**');
      await drawer.getByRole('button',{name:common['common.action.retry'],exact:true}).click();
      await page.waitForLoadState('networkidle');
      await drawer.getByTestId('alloc-picker').waitFor();
      await page.waitForFunction(()=>!document.querySelector('[data-testid="payment-save"]')?.disabled);
      await check('drawer-ready');
      if(width>=1024&&Math.abs(geometry.width-440)>1) failures.push(`${tag}: drawer width ${geometry.width}, expected 440`);
      if(geometry.active!=='lines.0.amount') failures.push(`${tag}: amount not initially focused`);
      await amount.fill('0'); await drawer.getByTestId('payment-save').click(); await page.waitForFunction(()=>document.querySelector('[name="lines.0.amount"]')?.getAttribute('aria-invalid')==='true'); await check('drawer-invalid');
      await amount.fill('1240378'); await amount.blur(); await page.waitForFunction(()=>document.querySelector('[name="lines.0.amount"]')?.getAttribute('aria-invalid')==='false'); await page.waitForTimeout(200); await check('drawer-advance');
      await drawer.getByRole('button',{name:new RegExp(words['payments.counter.details'])}).click(); await drawer.getByRole('region',{name:words['payments.counter.details'],exact:true}).waitFor(); await drawer.getByRole('region',{name:words['payments.counter.details'],exact:true}).scrollIntoViewIfNeeded(); await check('drawer-details');
      await page.keyboard.press('Escape');
      const confirm=page.getByRole('dialog',{name:words['payments.counter.discardTitle']}); await confirm.waitFor(); await check('drawer-discard');
      const discardHit=await confirm.getByRole('button',{name:words['payments.counter.discard'],exact:true}).evaluate(button=>{const r=button.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===button||button.contains(hit);});
      if(!discardHit) failures.push(`${tag}: snackbar/overlay obscures Discard changes`);
      await confirm.getByRole('button',{name:words['payments.counter.discard'],exact:true}).click(); await drawer.waitFor({state:'hidden'});
    }
    if(!baseline&&locale==='en'&&theme==='light'&&[320,1280].includes(width)){
      const action=width<1024?page.getByTestId('shop-person-dock'):page.locator('main header');
      await action.getByRole('button',{name:'Receive payment',exact:true}).click();
      await page.getByRole('dialog').waitFor();await check('payment');
      await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      const link=action.getByRole('link',{name:'New bill',exact:true});
      if(!(await link.count()))throw new Error('New bill shortcut absent');
      await link.click();await page.waitForURL(/\/sales\/invoices\/new/);
      await page.waitForLoadState('networkidle');
      if(new URL(page.url()).searchParams.get('party')!==id)throw new Error('New bill lost selected customer');
      await page.screenshot({path:`${dir}/${tag}-new-bill.png`});
      await page.getByText(person.name,{exact:true}).first().waitFor({timeout:10000});
      await page.goBack();await page.waitForLoadState('networkidle');
      if(width===320){
        const before=Number(original.data.shop.customer_balance);
        await page.getByTestId('shop-person-dock').getByRole('button',{name:'Receive payment',exact:true}).click();
        const dialog=page.getByRole('dialog');
        await dialog.locator('input[inputmode="decimal"]').first().fill('1');
        let releaseSave, startSave;
        const held=new Promise(resolve=>{releaseSave=resolve;});
        const started=new Promise(resolve=>{startSave=resolve;});
        let posts=0;
        const holdPayment=async route=>{if(route.request().method()!=='POST')return route.fallback();posts++;startSave();await held;return route.continue();};
        await page.route('**/api/v1/payments',holdPayment);
        const savedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/payments'&&r.request().method()==='POST');
        await page.waitForFunction(()=>!document.querySelector('[data-testid="payment-save"]')?.disabled);
        await dialog.getByRole('button',{name:/^Receive ₹/}).evaluate(button=>{button.click();button.click();});
        await started;await page.waitForTimeout(150);await check('busy-payment');releaseSave();
        const saved=await savedResponse;if(!saved.ok())throw new Error(`Payment failed ${saved.status()}`);
        await dialog.getByRole('button',{name:'Done',exact:true}).waitFor();await check('saved-payment');
        await dialog.getByRole('button',{name:'Done',exact:true}).click();
        await page.unroute('**/api/v1/payments',holdPayment);
        if(posts!==1)throw new Error(`Repeated tap created ${posts} payment requests`);
        const updated=(await (await ctx.request.get(`${frontend}/api/v1/parties/${id}?book=shop`)).json()).data.shop;
        if(Math.round(Number(updated.customer_balance)*100)!==Math.round(before*100)-100)throw new Error('One-rupee receipt did not update customer dues');
        if(updated.supplier_balance!==original.data.shop.supplier_balance)throw new Error('Customer receipt changed supplier dues');
        const expected=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(updated.customer_balance));
        await page.getByTestId('shop-person-overview').getByText(expected,{exact:true}).waitFor();
        await check('after-payment');
      }
      console.log(`${width}: existing payment drawer and selected-person bill editor PASS`);
      if(width===1280){
        const suppliers=(await (await ctx.request.get(`${frontend}/api/v1/parties?book=shop&type=supplier&page_size=1`)).json()).data;
        const supplier=suppliers[0];
        if(!supplier)throw new Error('Supplier fixture missing');
        await page.goto(`${frontend}/parties/${supplier.id}?from=suppliers`,{waitUntil:'networkidle'});
        const actions=page.locator('main header');
        await actions.getByRole('button',{name:'Pay supplier',exact:true}).click();
        await page.getByRole('dialog').waitFor();await check('supplier-payment');
        await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
        await actions.getByRole('link',{name:'Purchase bill',exact:true}).click();
        await page.waitForURL(/\/purchases\/bills\/new/);
        await page.getByText(supplier.name,{exact:true}).first().waitFor({timeout:10000});
        await page.screenshot({path:`${dir}/${tag}-new-purchase-bill.png`});
        if(new URL(page.url()).searchParams.get('party')!==supplier.id)throw new Error('Purchase bill lost supplier');
        console.log('1280: supplier Pay and selected-supplier purchase editor PASS');
        await page.goto(`${frontend}/parties/${id}`,{waitUntil:'networkidle'});
      }

    }
    let state='stress', release, gate;
    await page.route(`**/api/v1/parties/${id}?*`,async route=>{
      if(route.request().method()!=='GET')return route.fallback();
      if(state==='loading'||state==='busy')await gate;
      if(state==='error')return route.fulfill({status:500,json:{error:{code:'server_error',message:'Test: detail unavailable'}}});
      const fixture=structuredClone(original), row=fixture.data;
      row.name='Shri Balaji Hardware & Electricals Private Limited';row.is_customer=true;row.is_supplier=state!=='single';
      row.shop={...row.shop,customer_balance:state==='settled'?'0.00':state==='advance'?'-500.00':'1240378.00',supplier_balance:'600.00',customer_due:'1240378.00',customer_credit:'0.00',supplier_due:'600.00',supplier_credit:'0.00'};
      if(state==='archived')row.status='archived';
      return route.fulfill({status:200,json:fixture});
    });
    for(const next of ['stress','supplier','single','advance','settled','archived','error','loading']){
      state=next;
      if(state==='loading'){
        gate=new Promise(resolve=>{release=resolve;});
        await page.goto(`${frontend}/parties/${id}`,{waitUntil:'domcontentloaded'});
        await page.waitForTimeout(200);await check(state);release();await page.waitForLoadState('networkidle');
      }else{await page.goto(`${frontend}/parties/${id}${state==='supplier'?'?from=suppliers':''}`,{waitUntil:'networkidle'});await check(state);
        if(['stress','supplier'].includes(state)&&!baseline){const text=await page.getByTestId('shop-person-overview').innerText();const wanted=state==='supplier'?'₹600.00':'₹12,40,378.00';const forbidden=state==='supplier'?'₹12,40,378.00':'₹600.00';if(!text.includes(wanted)||text.includes(forbidden)||text.includes('As a customer')||text.includes('As a supplier'))throw new Error('Person view mixed roles');}
      }
    }
    state='stress';await page.reload({waitUntil:'networkidle'});
    if(!baseline){
      await page.locator('main').getByRole('button',{name:locale==='hi'?'और विकल्प':'More actions',exact:true}).click().catch(async()=>{
        await page.locator('main button[aria-haspopup="dialog"]').last().click();
      });
      await page.getByRole('dialog').waitFor();await check('menu');await page.keyboard.press('Escape');
    }
    await ctx.close();
  }
  writeFileSync(`${dir}/measurements-${locale}.json`,JSON.stringify(results,null,2));
}
