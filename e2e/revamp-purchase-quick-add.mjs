/** Purchase §7 counter composition. Local seeded QA only; own drafts deleted.
 * Fails on c87aa514: the top search is absent. Measures actual text/colour/width.
 * --locale=hi --widths=320,1280; screenshots include compact and long documents.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { coveredOverlayText } from './lib/measureOverlayText.mjs';
import { measureCustomers } from './revamp-customers.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const locale = arg('locale', 'en');
const out = `${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/revamp/${arg('piece', 'purchase-quick-add')}`;
mkdirSync(out, { recursive: true });
const results = [],
  failures = [],
  drafts = new Set();
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const auth = await browser.newContext();
let csrf;
const searchLabel = locale === 'hi' ? 'जोड़ने के लिए सामान खोजें' : 'Search items to add';
const findLabel = locale === 'hi' ? 'बिल में पंक्ति ढूँढें' : 'Find a line on this bill';
const assert = (ok, n) => {
  if (!ok) failures.push(n);
};
async function request(method, path, data) {
  const r = await auth.request[method](`${base}/api/v1${path}`, {
    headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
    ...(data ? { data } : {}),
  });
  if (!r.ok()) throw Error(`${method} ${path}: ${r.status()} ${await r.text()}`);
  return (await r.json()).data;
}
try {
  const login = await auth.newPage();
  await login.goto(`${base}/login/email`);
  await login.fill('input[type=email]', 'scale@digikhaato.test');
  await login.fill('input[type=password]', 'Scale-Run-2026!');
  await login.click('button[type=submit]');
  await login.waitForURL((u) => !u.pathname.startsWith('/login'));
  csrf = (await auth.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const units = await request('get', '/units');
  const unit = units.find((u) => u.code === 'NOS');
  const prefix = 'Radhe Krishna Enterprises LED driver';
  let items = await request('get', `/items?q=${encodeURIComponent(prefix)}&status=active`);
  let item = items.find((x) => x.name === `${prefix} 42 W`);
  if (!item)
    item = await request('post', '/items', {
      name: `${prefix} 42 W`,
      unit_id: unit.id,
      selling_price: '55.00',
      purchase_price: '42.00',
      tax_code: 'GST18',
      track_stock: false,
      barcode: '8909710000042',
    });
  const defaults = await request('get', `/items/${item.id}`);
  if (typeof defaults.purchase_price !== 'string')
    throw Error('QA owner purchase-cost visibility missing');
  const parties = await request('get', '/parties?type=supplier&page_size=5&module=shop');
  const supplier = parties[0];
  if (!supplier) throw Error('QA supplier missing');
  const state = await auth.storageState();
  const line = (description, qty = '1', cost = '42.00') => ({
    item_id: item.id,
    description,
    qty,
    unit_code: 'NOS',
    unit_cost: cost,
    tax_code: 'GST18',
  });
  const make = async (lines) => {
    const bill = await request('post', '/purchases/bills', {
      party_id: supplier.id,
      supplier_invoice_number: `QA-QUICK-${crypto.randomUUID().slice(0, 8)}`,
      lines,
    });
    drafts.add(bill.id);
    return bill;
  };
  for (const width of arg('widths', '390,320,1024,1280').split(',').map(Number))
    for (const theme of arg('themes', 'light,dark').split(',')) {
      const ctx = await browser.newContext({
        storageState: state,
        viewport: { width, height: width < 768 ? 844 : 900 },
        isMobile: width < 768,
        hasTouch: width < 768,
      });
      await ctx.addCookies([
        { name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' },
        { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' },
      ]);
      const page = await ctx.newPage();
      let acceptNavigation = true;
      let nativePrompts = 0;
      let recordRequests = 0;
      let draftWrites = 0;
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/purchases\/bills\/[^/]+\/record$/.test(new URL(request.url()).pathname)
        )
          recordRequests += 1;
        if (
          ['PATCH', 'PUT'].includes(request.method()) &&
          /\/purchases\/bills\/[^/]+$/.test(new URL(request.url()).pathname)
        )
          draftWrites += 1;
      });
      page.on('dialog', async (dialog) => {
        if (dialog.type() !== 'beforeunload') {
          failures.push(`${width}/${theme}: unexpected ${dialog.type()}`);
          await dialog.dismiss();
          return;
        }
        nativePrompts += 1;
        if (acceptNavigation) await dialog.accept();
        else await dialog.dismiss();
      });
      page.on('response', (response) => {
        if (
          new URL(response.url()).pathname === '/api/v1/purchases/bills' &&
          response.request().method() === 'POST' &&
          response.ok()
        ) {
          response.json().then(
            (body) => body?.data?.id && drafts.add(body.data.id),
            () => undefined
          );
        }
      });
      page.on('pageerror', (error) => failures.push(error.message));
      const tag = `${width}-${theme}-${locale}`;
      const shot = async (name, root = 'main') => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        const m = await measureCustomers(page, root);
        if (root === 'main') {
          const dock = await measureCustomers(page, '[data-testid="purchase-dock"]');
          m.cut.push(...dock.cut);
          m.lowContrast.push(...dock.lowContrast);
        }
        if (root === '[role=dialog]') {
          const covered = await coveredOverlayText(page.getByRole('dialog'));
          m.cut.push(...covered.map((text) => `Covered by another surface: ${text}`));
        }
        const cutInputs = await page.locator(`${root} input[inputmode]`).evaluateAll((es) => {
          const ctx = document.createElement('canvas').getContext('2d');
          return es
            .filter((e) => {
              if (!e.getClientRects().length || !e.value) return false;
              const s = getComputedStyle(e);
              ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
              return (
                ctx.measureText(e.value).width +
                  parseFloat(s.paddingLeft) +
                  parseFloat(s.paddingRight) >
                e.clientWidth + 1
              );
            })
            .map((e) => `${e.getAttribute('aria-label')}: ${e.value}`);
        });
        m.cut.push(...cutInputs);
        if (
          await page
            .getByRole('listbox')
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          const pop = await measureCustomers(page, '[role=listbox]');
          m.cut.push(...pop.cut);
          m.lowContrast.push(...pop.lowContrast);
        }
        results.push({ tag, name, ...m });
        if (m.overflow > 0 || m.cut.length || m.lowContrast.length)
          failures.push(`${tag} ${name}: ${JSON.stringify(m)}`);
        await page.screenshot({ path: `${out}/${tag}-${name}.png` });
        console.log(tag, name, m.overflow, m.cut.length, m.lowContrast.length);
      };
      await page.goto(`${base}/purchases/bills/new`, { waitUntil: 'networkidle' });
      const search = page.getByRole('combobox', { name: searchLabel });
      await search.waitFor();
      await shot('empty');
      await search.fill(prefix);
      await page.getByRole('option', { selected: true }).first().waitFor();
      await shot('search');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.activeElement?.closest('[data-line-cell]')?.getAttribute('data-col') === '1'
      );
      await shot('picked');
      assert(
        (
          await page.locator('[data-line-cell][data-row="0"][data-col="2"] input').inputValue()
        ).replace(/\.0+$/, '') === '42',
        `${tag}: default cost`
      );
      await search.fill('8909710000042');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      assert(await search.evaluate((e) => e === document.activeElement), `${tag}: scanner caret`);
      await search.fill(prefix);
      await page.getByRole('option', { selected: true }).first().waitFor();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-line-cell][data-row="0"][data-col="1"] input')?.value ===
          '3'
      );
      await shot('repeat');
      await search.fill('NoSuchElectricalItem971');
      await page.waitForTimeout(600);
      await shot('no-match');
      await page.keyboard.press('Escape');
      const bill = await make(
        Array.from({ length: 10 }, (_, i) =>
          line(
            i === 0
              ? 'Radhe Krishna Enterprises industrial electrical control panel with copper terminals'
              : `${prefix} ${i + 1}`,
            String(i + 1),
            i === 0 ? '1240378.00' : '42.00'
          )
        )
      );
      await page.goto(`${base}/purchases/bills/${bill.id}/edit`, { waitUntil: 'networkidle' });
      const finder = page.getByRole('combobox', { name: findLabel });
      await finder.waitFor();
      await shot('long-large');
      await finder.click();
      await shot('finder');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.activeElement?.closest('[data-line-cell]')?.getAttribute('data-col') === '1'
      );
      await shot('found');
      await page.locator('[data-line-cell][data-row="1"][data-col="1"] input').fill('7');
      let releaseSave;
      const saveGate = new Promise((resolve) => {
        releaseSave = resolve;
      });
      await page.route(`**/api/v1/purchases/bills/${bill.id}`, async (route) => {
        if (['PATCH', 'PUT'].includes(route.request().method())) await saveGate;
        await route.continue();
      });
      const saved = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/purchases/bills/${bill.id}`) &&
          ['PATCH', 'PUT'].includes(r.request().method()) &&
          r.ok()
      );
      await page
        .getByRole('button', {
          name: locale === 'hi' ? 'ड्राफ्ट सेव करें' : 'Save draft',
          exact: true,
        })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByTestId('purchase-dock').getByRole('status').waitFor();
      await shot('saving');
      await page.locator('[data-line-cell][data-row="1"][data-col="1"] input').fill('8');
      releaseSave();
      await saved;
      const back = await request('get', `/purchases/bills/${bill.id}`);
      assert(
        back.lines.length === 10 &&
          back.lines[1].qty.replace(/\.0+$/, '') === '7' &&
          back.lines[0].unit_cost === '1240378.0000',
        `${tag}: edited draft readback`
      );
      const dock = page.getByTestId('purchase-dock');
      const unsaved = locale === 'hi' ? 'अभी सेव नहीं हुआ' : 'Not saved yet';
      await page.waitForFunction(
        (text) =>
          document
            .querySelector('[data-testid="purchase-dock"] [role=status]')
            ?.textContent?.includes(text),
        unsaved
      );
      assert(
        (await page.locator('[data-line-cell][data-row="1"][data-col="1"] input').inputValue()) ===
          '8',
        `${tag}: late answer lost newer typing`
      );
      await shot('late-reply');
      const saveAndRead = async () => {
        const nextSave = page.waitForResponse(
          (response) =>
            response.url().endsWith(`/purchases/bills/${bill.id}`) &&
            ['PATCH', 'PUT'].includes(response.request().method()) &&
            response.ok()
        );
        await dock
          .getByRole('button', {
            name: locale === 'hi' ? 'ड्राफ्ट सेव करें' : 'Save draft',
            exact: true,
          })
          .click();
        await nextSave;
        return request('get', `/purchases/bills/${bill.id}`);
      };
      const newer = await saveAndRead();
      assert(
        newer.lines[1].qty.replace(/\.0+$/, '') === '8',
        `${tag}: newest quantity was not saved`
      );
      await shot('saved');
      const cost = page.locator('[data-line-cell][data-row="1"][data-col="2"] input');
      await cost.fill('');
      const defaulted = await saveAndRead();
      assert(
        Number(defaulted.lines[1].unit_cost) === Number(defaults.purchase_price),
        `${tag}: server default cost`
      );
      await page
        .waitForFunction(
          (expected) =>
            Number(
              (
                document.querySelector('[data-line-cell][data-row="1"][data-col="2"] input')
                  ?.value ?? ''
              ).replace(/,/g, '')
            ) === expected,
          Number(defaults.purchase_price),
          { timeout: 5000 }
        )
        .catch(async (error) => {
          await page.screenshot({ path: `${out}/${tag}-debug-source-default.png` });
          console.log(
            'Default diagnostic',
            await page.locator('[data-line-cell]').evaluateAll((cells) =>
              cells.map((cell) => ({
                row: cell.dataset.row,
                col: cell.dataset.col,
                value: cell.querySelector('input')?.value,
              }))
            )
          );
          throw error;
        });
      assert(
        Number((await cost.inputValue()).replace(/,/g, '')) === Number(defaults.purchase_price),
        `${tag}: server default not reconciled to the field`
      );
      await shot('source-default-saved');
      await cost.fill('0');
      const free = await saveAndRead();
      assert(
        Number(free.lines[1].unit_cost) === 0,
        `${tag}: explicit zero became the item default`
      );
      await shot('explicit-zero-saved');
      await cost.fill('');
      await cost.pressSequentially('40.1204');
      assert((await cost.inputValue()) === '40.1204', `${tag}: typed four-place cost lost digits`);
      const precise = await saveAndRead();
      assert(precise.lines[1].unit_cost === '40.1204', `${tag}: saved four-place cost changed`);
      await shot('precise-cost');
      const firstToggle = page.getByTestId('line-items-editor').getByRole('button', {
        name: locale === 'hi' ? 'पंक्ति 1' : 'line 1', exact: true,
      });
      if (await firstToggle.count()) await firstToggle.click();
      const largeCost = page.locator('[data-line-cell][data-row="0"][data-col="2"] input');
      await largeCost.fill('1240378.1234');
      await largeCost.blur();
      await shot('large-precise-cost');
      const secondToggle = page.getByTestId('line-items-editor').getByRole('button', {
        name: locale === 'hi' ? 'पंक्ति 2' : 'line 2', exact: true,
      });
      if (await secondToggle.count()) await secondToggle.click();
      await cost.fill(defaults.purchase_price);
      await saveAndRead();
      const qty = page.locator('[data-line-cell][data-row="1"][data-col="1"] input');
      await qty.fill('');
      const toggle = page
        .getByTestId('line-items-editor')
        .getByRole('button', { name: locale === 'hi' ? 'पंक्ति 2' : 'line 2', exact: true });
      if (await toggle.count()) await toggle.click();
      const beforeRecord = recordRequests;
      const beforeWrites = draftWrites;
      await dock
        .getByRole('button', { name: locale === 'hi' ? 'दर्ज करें' : 'Record', exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.activeElement?.closest('[data-line-cell]')?.getAttribute('data-row') === '1' &&
          document.activeElement?.closest('[data-line-cell]')?.getAttribute('data-col') === '1'
      );
      assert(
        recordRequests === beforeRecord && draftWrites === beforeWrites,
        `${tag}: unfinished row reached the server`
      );
      await shot('unfinished-row-blocked');
      await qty.fill('8');
      await ctx.setOffline(true);
      const note = 'Radhe Krishna Enterprises electrical counter unsaved note';
      await page.getByLabel(locale === 'hi' ? 'नोट' : 'Notes', { exact: true }).fill(note);
      await page.waitForFunction(
        (text) =>
          document
            .querySelector('[data-testid="purchase-dock"] [role=status]')
            ?.textContent?.includes(text),
        unsaved
      );
      assert(
        await dock
          .getByRole('button', {
            name: locale === 'hi' ? 'ड्राफ्ट सेव करें' : 'Save draft',
            exact: true,
          })
          .isDisabled(),
        `${tag}: offline Save enabled`
      );
      await shot('offline');
      await ctx.setOffline(false);
      await search.fill(prefix);
      await page.getByRole('option', { selected: true }).first().waitFor();
      await page.keyboard.press('Escape');
      const originalPath = new URL(page.url()).pathname;
      const beforePrompts = nativePrompts;
      acceptNavigation = false;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 2000 }).catch((error) => {
        if (
          !/ERR_ABORTED/.test(error.message) &&
          !(nativePrompts > beforePrompts && error.name === 'TimeoutError')
        )
          throw error;
      });
      assert(nativePrompts > beforePrompts, `${tag}: no native leave guard`);
      assert(
        (await page.getByLabel(locale === 'hi' ? 'नोट' : 'Notes', { exact: true }).inputValue()) ===
          note,
        `${tag}: reload dismissal lost typing`
      );
      assert(
        new URL(page.url()).pathname === originalPath,
        `${tag}: reload dismissal changed the draft route`
      );
      assert(
        (await page.getByTestId('purchase-supplier').textContent()).includes(supplier.name),
        `${tag}: reload dismissal lost the supplier`
      );
      assert(
        (await page
          .getByTestId('line-items-editor')
          .locator('section[aria-label], [role=row][aria-label]')
          .count()) === 10,
        `${tag}: reload dismissal lost bill lines`
      );
      assert(
        (await page.locator('[data-line-cell][data-row="1"][data-col="1"] input').inputValue()) ===
          '8',
        `${tag}: reload dismissal lost the quantity`
      );
      await shot('reload-stayed');
      acceptNavigation = true;
      const close = page.getByRole('button', {
        name: locale === 'hi' ? 'बिल बंद करें' : 'Close bill',
        exact: true,
      });
      await close.click();
      const dialog = page.getByRole('dialog', {
        name:
          locale === 'hi' ? 'बाहर जाएँ? यह बिल सेव नहीं हुआ है।' : "Leave? This bill isn't saved.",
        exact: true,
      });
      await dialog.waitFor();
      await shot('leave-confirm', '[role=dialog]');
      await dialog
        .getByRole('button', {
          name: locale === 'hi' ? 'बिल पर रहें' : 'Keep editing',
          exact: true,
        })
        .click();
      assert(
        (await page.getByLabel(locale === 'hi' ? 'नोट' : 'Notes', { exact: true }).inputValue()) ===
          note,
        `${tag}: staying lost note`
      );
      await shot('kept-editing');
      await close.click();
      await page
        .getByRole('button', {
          name: locale === 'hi' ? 'बिना सेव किए बाहर जाएँ' : 'Leave without saving',
          exact: true,
        })
        .click();
      await page.waitForURL((url) => url.pathname === '/purchases/bills');
      await ctx.close();
    }
  const after = await request('get', `/items/${item.id}`);
  assert(after.purchase_price === defaults.purchase_price, 'Draft changed item purchase default');
} finally {
  for (const id of drafts) await request('delete', `/purchases/bills/${id}`).catch(() => {});
  writeFileSync(`${out}/results-${locale}.json`, JSON.stringify({ results, failures }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(failures, null, 2));
process.exitCode = failures.length ? 1 : 0;
