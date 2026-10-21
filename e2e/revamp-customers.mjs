/** Phase 5 Customers: live API + explicitly intercepted presentation fixtures.
 * No customer is created/edited. A real seeded response supplies every field;
 * only the list response changes for loading/error/stress/empty screenshots. */
import { writeFileSync } from 'node:fs';

export async function shootCustomers({ signedInContext, widths, themes, locale, dir, frontend, failures, baseline, kind = 'customer' }) {
  const results = [];
  const supplier = kind === 'supplier';
  const listPath = supplier ? '/suppliers' : '/customers';
  for (const width of widths) for (const theme of themes) {
    const ctx = await signedInContext(width, theme);
    const page = await ctx.newPage();
    const tag = `${width}-${theme}-${locale}`;
    const check = async (state) => {
      await page.evaluate(() => document.fonts.ready);
      const measure = await measureCustomers(page);
      if(supplier && locale === 'en' && /\bcustomers\b/i.test(await ((await page.getByRole('dialog').count()) ? page.getByRole('dialog') : page.locator('main')).innerText())) failures.push(`${tag} ${state}: supplier content named customers`);
      results.push({ width, theme, locale, state, ...measure });
      await page.screenshot({ path: `${dir}/${tag}-${state}.png`, fullPage: false });
      console.log(`${tag} ${state}: overflow ${measure.overflow}px, cut ${measure.cut.length}, contrast ${measure.lowContrast.length}, first row y=${measure.firstRowY}`);
      if (!baseline && (measure.overflow > 0 || measure.cut.length || measure.lowContrast.length)) {
        failures.push(`${tag} ${state}: ${JSON.stringify(measure)}`);
      }
    };
    await page.goto(`${frontend}${listPath}`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="ub-grid-card"], [data-testid="ub-grid-row"]').first().waitFor();
    await check('live');
    if(supplier && !baseline) {
      const pay=page.locator('main button[aria-label^="Pay ·"],main button[aria-label^="भुगतान करें ·"]').first();
      if(await pay.count()){
        await pay.click();await page.getByRole('dialog').waitFor();await page.waitForLoadState('networkidle');
        await check('pay-supplier');
        const dialogText=await page.getByRole('dialog').innerText();
        if(locale==='en'&&!dialogText.includes('Pay supplier')) failures.push(`${tag}: wrong payment direction`);
        await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      }
    }
    if (supplier && !baseline && locale === 'en' && theme === 'light' && [320, 1280].includes(width)) await supplierJourney(page, frontend, check);
    if (!supplier && !baseline && locale === 'en' && theme === 'light' && [320, 1280].includes(width)) await customerJourney(page, frontend, { dir, tag });
    const response = await ctx.request.get(`${frontend}/api/v1/parties?book=shop&type=${kind}&page_size=25`);
    if (!response.ok()) throw new Error(`Fixture source ${response.status()}`);
    const original = await response.json();
    if (!original.data?.length) throw new Error('Scale customers missing');
    let state = 'stress';
    let release;
    let intercepted;
    const seen = () => new Promise((resolve) => { intercepted = resolve; });
    const hold = () => new Promise((resolve) => { release = resolve; });
    let gate;
    await page.route('**/api/v1/parties?*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      intercepted?.();
      if (state === 'loading' || state === 'busy') await gate;
      if (state === 'error') return route.fulfill({ status: 500, json: { error: { code: 'server_error', message: 'Test: list unavailable' } } });
      const fixture = structuredClone(original);
      const empty = state === 'empty' || state === 'filtered';
      fixture.data = empty ? [] : [{ ...fixture.data[0], name: 'Radhe Krishna Enterprises — Electrical and Electronics Wholesale Division',
        balance: supplier ? '-1240378.00' : '1240378.00', tags: [], is_supplier: true, is_customer: true,
        last_activity_at: null, shop: { ...fixture.data[0].shop,
          customer_balance: supplier ? '600.00' : '1240378.00', customer_due: supplier ? '600.00' : '1240378.00', customer_credit: '0.00',
          supplier_balance: supplier ? '1240378.00' : '600.00', supplier_due: supplier ? '1240378.00' : '600.00', supplier_credit: '0.00',
          oldest_due_on: '2026-09-01', days_overdue: 47, last_activity_at: '2026-10-18T06:00:00Z', last_activity_kind: supplier ? 'purchase_bill' : 'invoice' } }];
      fixture.meta = { ...fixture.meta, page: 1, page_size: 25, total: empty ? 0 : 1, total_pages: empty ? 0 : 1, has_any: state !== 'empty', shop_counts: {all: empty ? 0 : 1, owes: empty ? 0 : 1, advance: 0, late: empty ? 0 : 1}, totals: { ...fixture.meta.totals, receivable: empty || supplier ? '0.00' : '1240378.00', payable: !empty && supplier ? '1240378.00' : '0.00', count: empty ? 0 : 1 } };
      return route.fulfill({ status: 200, json: fixture });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await check('stress');
    if (baseline) { await ctx.close(); continue; }
    await page.getByTestId('filters-button').click();
    await page.getByRole('dialog').waitFor();
    await check('filters');
    // Existing Apply semantics: no list change until Apply; close with Escape.
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    for (const next of ['empty', 'filtered', 'error', 'loading']) {
      state = next;
      if (state === 'loading') {
        gate = hold(); const pending = seen();
        await page.goto(`${frontend}${listPath}`, { waitUntil: 'domcontentloaded' });
        await pending; await page.waitForTimeout(150); await check(state); release();
        await page.waitForLoadState('networkidle');
      } else {
        await page.goto(`${frontend}${listPath}${state === 'filtered' ? '?q=missing' : ''}`, { waitUntil: 'networkidle' });
        await check(state);
      }
    }
    state = 'busy'; gate = hold(); const pending = seen();
    await page.getByRole('searchbox').fill('Radhe'); await pending;
    await page.waitForTimeout(100); await check('busy'); release();
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(350);
    state = 'stress'; await check('refreshed');
    // The tested new rule must fail on an old build, rather than pass by absence.
    if (!(await page.getByTestId('shop-customer-summary').count())) failures.push(`${tag}: compact summary missing`);
    const search = page.getByRole('searchbox');
    const filter = page.getByTestId('filters-button');
    const heights = await Promise.all([search, filter].map((l) => l.evaluate((el) => Math.round((el.tagName === "INPUT" ? el.parentElement : el).getBoundingClientRect().height))));
    if (heights[0] !== heights[1]) failures.push(`${tag}: search/filter heights ${heights}`);
    await ctx.close();
  }
  writeFileSync(`${dir}/measurements-${locale}.json`, JSON.stringify(results, null, 2));
}

/** Measures actual text-node rectangles, ancestor clipping and computed colours.
 * Ignores deliberate screen-reader-only content, never visible clamped labels. */
export async function measureCustomers(page, rootSelector) {
  return page.evaluate((selector) => {
    const root = selector ? document.querySelector(selector) : [...document.querySelectorAll('[role="dialog"]')].at(-1) ?? document.querySelector('main');
    const cut = []; const lowContrast = [];
    const rgba = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const blend = (fg, bg) => { const a = fg[3] ?? 1; return fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a)); };
    const background = (el) => {
      const chain = []; for (let p = el; p; p = p.parentElement) chain.push(p);
      return chain.reverse().reduce((bg, p) => blend(rgba(getComputedStyle(p).backgroundColor), bg), [255, 255, 255]);
    };
    const lum = (c) => c.map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement; const text = node.textContent.trim();
      // Print watermarks repeat the visible status and are explicitly decorative.
      if (!text || el.closest('.sr-only,[hidden],script,style,option,[aria-hidden="true"] [data-testid="print-watermark"]')) continue;
      const box = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!box.width || !box.height || cs.visibility === 'hidden' || el.checkVisibility?.() === false) continue;
      // Responsive screen-reader labels (e.g. max-sm:sr-only) are invisible too.
      if (cs.position === 'absolute' && box.width <= 1 && box.height <= 1 && cs.clip !== 'auto') continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      if (rects.some((r) => r.right > box.right + 1.5 || r.left < box.left - 1.5) && cs.display !== 'inline') cut.push(text);
      for (let p = el; p && p !== root.parentElement; p = p.parentElement) {
        const style = getComputedStyle(p); const b = p.getBoundingClientRect();
        // A deliberate sideways chip scroller exposes its options on scroll;
        // test their own boxes, not clipping by ancestors outside that scroller.
        if (style.overflowX === 'auto' && p.scrollWidth > p.clientWidth + 1) break;
        if (['hidden','clip'].includes(style.overflowX) && rects.some((r) => r.right > b.right + 1.5 || r.left < b.left - 1.5)) { cut.push(text); break; }
        if (parseInt(style.webkitLineClamp) > 0 && p.scrollHeight > p.clientHeight + 1) cut.push(text);
      }
      const bg = background(el); const fg = blend(rgba(cs.color),bg);
      const a = lum(bg), b = lum(fg), ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      if (ratio < 4.5) lowContrast.push({text,ratio: Number(ratio.toFixed(2))});
    }
    const first = root.querySelector('[data-testid="ub-grid-card"], [data-testid="ub-grid-row"]');
    return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), cut: [...new Set(cut)], lowContrast, firstRowY: first ? Math.round(first.getBoundingClientRect().y) : null };
  }, rootSelector);
}

/** User-level regression: searching must not collapse the phone field after
 * Clear filters appears; Back must restore both query and readable controls. */
async function customerJourney(page, frontend, { dir, tag }) {
  const listPath = '/customers';
  const start = page.url();
  await page.getByTestId('filters-button').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Archived', exact: true }).click();
  if (page.url() !== start) throw new Error('Filter draft changed the applied URL');
  await page.keyboard.press('Escape');
  await page.getByTestId('filters-button').click();
  await dialog.getByRole('radio', { name: 'Active', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  const answer = page.waitForResponse((r) => r.url().includes('/api/v1/parties?') && new URL(r.url()).searchParams.get('q') === 'Verma');
  await page.getByRole('searchbox').fill('Verma');
  const response = await answer;
  const data = await response.json();
  if (!data.data.length || data.data.some((row) => !row.name.toLowerCase().includes('verma'))) throw new Error('Search rows do not match');
  const query = new URL(response.url()).searchParams;
  if (query.get('book') !== 'shop' || query.get('type') !== 'customer') throw new Error('Search left the Shop customer book');
  const url = page.url();
  const personId = data.data[0].id;
  const detailAnswer = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/parties/${personId}`);
  const historyAnswer = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/reminders' && new URL(r.url()).searchParams.get('book') === 'shop');
  await page.getByRole('button', { name: `Open ${data.data[0].name}`, exact: true }).click();
  await page.waitForURL(/\/parties\/[^/]+$/);
  const detailResponse = await detailAnswer;
  if (new URL(detailResponse.url()).searchParams.get('book') !== 'shop') throw new Error('Person read lost the Shop book');
  await historyAnswer;
  await page.locator('main').getByRole('button', { name: 'More actions', exact: true }).click();
  const personPreviewAnswer = page.waitForResponse((r) => r.url().endsWith('/reminders/preview'));
  await page.getByRole('button', { name: 'Send reminder', exact: true }).click();
  const personPreview = await personPreviewAnswer;
  if (JSON.parse(personPreview.request().postData()).book !== 'shop') throw new Error('Person reminder used Udhaar');
  await page.locator('textarea[data-ub-share-preview]').waitFor();
  await page.screenshot({ path: `${dir}/${tag}-person-shop-reminder.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.goBack();
  await page.waitForURL(url);
  await page.getByRole('searchbox').waitFor({ state: 'visible' });
  if (await page.getByRole('searchbox').inputValue() !== 'Verma') throw new Error('Back lost search');
  const width = await page.getByRole('searchbox').evaluate((el) => el.getBoundingClientRect().width);
  if (width < 80) throw new Error(`Search squeezed to ${width}px`);
  await page.goto(`${frontend}/customers?balance=owes_me`, { waitUntil: 'networkidle' });
  await checkAppend(page);
  const remind = page.getByRole('button', { name: /^Remind ·/ }).first();
  if (!(await remind.count())) throw new Error('Seeded positive Shop customer has no Remind');
  const writes = [];
  const track = (request) => {
    if (request.method() === 'POST' && /\/reminders(?:\?|$|\/[^/]+\/send)/.test(new URL(request.url()).pathname)) writes.push(request.url());
  };
  page.on('request', track);
  const previewAnswer = page.waitForResponse((r) => r.url().endsWith('/reminders/preview'));
  await remind.click();
  const previewResponse = await previewAnswer;
  const preview = (await previewResponse.json()).data;
  if (JSON.parse(previewResponse.request().postData()).book !== 'shop' || preview.book !== 'shop') throw new Error('Reminder preview lost the Shop book');
  const editor = page.locator('textarea[data-ub-share-preview]');
  await editor.waitFor();
  if (await editor.inputValue() !== preview.text) throw new Error('Reminder did not use server preview');
  const edited = 'Please pay the remaining bill amount. Thank you.';
  await editor.fill(edited);
  const whatsapp = page.getByRole('dialog').getByRole('link', { name: 'WhatsApp', exact: true });
  if (new URL(await whatsapp.getAttribute('href')).searchParams.get('text') !== edited) throw new Error('WhatsApp link ignored edited words');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  page.off('request', track);
  if (writes.length) throw new Error('Opening/cancelling a reminder recorded a send');
  console.log(`${page.viewportSize().width}: filter cancellation, Shop search, person/Back, append, editable Shop preview and no send on cancel PASS`);
  await page.goto(`${frontend}${listPath}`, { waitUntil: 'networkidle' });
}

/** Supplier debts use the opposite signed projection from customer debts.
 * Guard the actual browser filters and outgoing payment context, not labels alone. */
async function supplierJourney(page, frontend, check) {
  for (const balance of ['i_owe', 'owes_me']) {
    await page.goto(`${frontend}/suppliers?balance=${balance}`, { waitUntil: 'networkidle' });
    const response = await page.request.get(`${frontend}/api/v1/parties?book=shop&type=supplier&balance=${balance}&page_size=25`);
    const data = await response.json();
    if (data.data.some(row => balance === 'i_owe' ? Number(row.balance) >= 0 : Number(row.balance) <= 0)) throw new Error('Supplier filter reversed debt and advance');
    if (await page.getByRole('button', { name: /^Remind ·/ }).count()) throw new Error('Supplier exposed customer reminder');
  }
  await page.goto(`${frontend}/suppliers?balance=i_owe`, { waitUntil: 'networkidle' });
  await checkAppend(page);
  const start = page.url();
  await page.locator('main button[aria-label^="Pay ·"]').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Pay supplier', {exact:true}).waitFor();
  if(page.url() !== start) throw new Error('Pay also opened the row');
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.locator('main button[aria-label^="Open "]').first().click();
  await page.waitForURL(url => url.pathname.startsWith('/parties/') && url.searchParams.get('from') === 'suppliers');
  await page.goBack();
  await page.waitForURL(start);
  console.log(`${page.viewportSize().width}: supplier debt/advance filters, outgoing Pay, row context and Back PASS`);
  if (page.viewportSize().width === 320 && process.env.E2E_WRITE_TESTS === '1') {
    if (!['localhost', '127.0.0.1'].includes(new URL(frontend).hostname)) throw new Error('Payment test is local-only');
    await page.goto(`${frontend}/suppliers?balance=i_owe`, { waitUntil:'networkidle' });
    const pay = page.locator('main button[aria-label^="Pay ·"]').first();
    const row = pay.locator('xpath=ancestor::*[@data-testid="ub-grid-card"]');
    const open = await row.locator('button[aria-label^="Open "]').getAttribute('aria-label');
    const list = await (await page.request.get(`${frontend}/api/v1/parties?book=shop&type=supplier&balance=i_owe&ordering=oldest_due_on&page_size=25`)).json();
    const person = list.data.find(row => `Open ${row.name}` === open);
    if(!person) throw new Error('Could not identify the selected supplier');
    const detail = `${frontend}/api/v1/parties/${person.id}?book=shop`;
    const before = (await (await page.request.get(detail)).json()).data.shop;
    await pay.click();
    await dialog.locator('input[inputmode="decimal"]').first().fill('1');
    await page.waitForFunction(()=>!document.querySelector('[data-testid="payment-save"]')?.disabled);
    let release, started;
    const held = new Promise(resolve=>{release=resolve;});
    const saving = new Promise(resolve=>{started=resolve;});
    let posts=0;
    const hold=async route=>{ if(route.request().method()!=='POST')return route.fallback();posts++;started();await held;return route.continue(); };
    await page.route('**/api/v1/payments',hold);
    const result=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/payments'&&r.request().method()==='POST');
    await dialog.getByTestId('payment-save').evaluate(button=>{button.click();button.click();});
    await saving;await check('busy-payment');release();
    const saved=await result;
    if(!saved.ok())throw new Error(`Supplier payment ${saved.status()}`);
    const body=JSON.parse(saved.request().postData());
    if(body.direction!=='out'||body.bucket!=='shop'||body.party_id!==person.id)throw new Error(`Wrong supplier payment context: ${JSON.stringify(body)}`);
    await dialog.getByRole('button',{name:'Done',exact:true}).waitFor();await check('saved-payment');
    const receipt = await dialog.getByRole('link',{name:'View receipt',exact:true}).getAttribute('href');
    await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.unroute('**/api/v1/payments',hold);
    const after=(await (await page.request.get(detail)).json()).data.shop;
    if(posts!==1||Math.round(Number(after.supplier_balance)*100)!==Math.round(Number(before.supplier_balance)*100)-100||after.customer_balance!==before.customer_balance)throw new Error('Supplier payment failed one-write/role-isolation check');
    await page.reload({waitUntil:'networkidle'});
    const refreshed = (await (await page.request.get(`${frontend}/api/v1/parties?book=shop&type=supplier&q=${encodeURIComponent(person.name)}`)).json()).data.find(row=>row.id===person.id);
    if(!refreshed || Math.round(Number(refreshed.balance)*100)!==-Math.round(Number(after.supplier_balance)*100))throw new Error('Saved supplier payment did not survive reload/list projection');
    await page.goto(`${frontend}${receipt}`,{waitUntil:'networkidle'});
    await page.getByText(person.name,{exact:true}).first().waitFor();
    await check('payment-receipt');
    console.log('320: ₹1 supplier payment, double tap one POST, customer balance unchanged PASS');
  }
  await page.goto(`${frontend}/suppliers`, { waitUntil: 'networkidle' });
}

/** Shared phone register paging must append unique rows rather than replace page one. */
async function checkAppend(page) {
  if (page.viewportSize().width === 320) {
    const before = await page.getByTestId('ub-grid-card').count();
    const more = page.getByRole('button', { name: /^Show more/ });
    if (await more.count()) {
      const nextPage = page.waitForResponse((r) => r.url().includes('/api/v1/parties?') && new URL(r.url()).searchParams.get('page') === '2');
      await more.click(); await nextPage;
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="ub-grid-card"]').length > n, before);
      const names = await page.getByTestId('ub-grid-card').locator('button[aria-label^="Open "]').evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
      if (names.length !== new Set(names).size) throw new Error('Show more duplicated a person');
    }
  }
}
