/**
 * Revamp §8.6 — Price lists on the LOCAL QA stack, through the real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/price-lists.mjs [--shots=/tmp/e2e-shots/price-lists]
 *
 * On a phone, through the screens: make a list at 5% below the usual price,
 * pin an item's rate, change it by tapping the row, change the rule, remove the
 * pin and delete the list — reading every step back from the server. Between,
 * a customer is put on the list (API) and the rate a bill would start from is
 * read from `/price-lists/for-party`: the pinned rate for the pinned item, the
 * rule for any other. The customer is put back on whatever list they had.
 *
 * LOOKs at the list and the detail at 390, 320 and 1280 in English and Hindi:
 * no sideways scroll, no text cut, Pin rate and remove ≥ 44 px on a phone,
 * the rule beside the pinned rates on a desktop.
 *
 * Local QA tenant only; nothing is sent to anybody.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('input, [role=combobox], .sr-only')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  for (const b of document.querySelectorAll('main table button')) {
    const frame = b.closest('table')?.parentElement?.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    if (frame && r.width > 0 && r.right > frame.right + 1) cut.push(`clipped:${b.textContent.trim().slice(0, 30)}`);
  }
  const target = (el) => {
    if (!el) return 0;
    const h = el.getBoundingClientRect().height;
    if (innerWidth > 639) return Math.round(h);
    const a = getComputedStyle(el, '::after');
    const over = -(parseFloat(a.top) || 0) - (parseFloat(a.bottom) || 0);
    return Math.round(h + Math.max(0, over));
  };
  const visible = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0);
  const rule = document.querySelector('[data-testid=price-list-rule]')?.getBoundingClientRect();
  const pin = document.querySelector('[data-testid=price-list-pin]')?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    pinButton: target(visible('[data-testid=price-list-pin] button:not([role=combobox])')),
    unpin: target(visible('[data-testid=price-list-unpin]')),
    side: Boolean(rule && pin && pin.left > rule.right),
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
let restore = null;
let api = null;
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const root = `${base}/api/v1`;
  const get = async (path) => {
    const r = await ctx.request.get(`${root}${path}`);
    return { status: r.status(), data: r.ok() ? (await r.json()).data : null };
  };
  const send = async (method, path, data = {}) => {
    const r = await ctx.request[method](`${root}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`${method} ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };
  api = send;
  const stamp = Date.now().toString(36).toUpperCase();
  const units = (await get('/units')).data;
  const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
  const makeItem = async (name, price) => {
    const made = await send('post', '/items', {
      name: `${name} ${stamp}`,
      unit_id: nos,
      selling_price: price,
      tax_code: 'GST5',
    });
    return made.item ?? made;
  };
  const moong = await makeItem('QA86 Moong', '200.00');
  const other = await makeItem('QA86 Chana', '100.00');

  /* ---------- make a list (phone) ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/items/price-lists`);
  await page.getByRole('heading', { name: 'Price lists' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'New price list' }).first().click();
  const dialog = page.getByRole('dialog');
  const listName = `QA86 Wholesale ${stamp}`;
  await dialog.getByRole('textbox', { name: /Name/ }).fill(listName);
  await dialog.getByRole('textbox', { name: /Change on usual price/ }).fill('-5');
  await dialog.getByRole('button', { name: 'Create price list' }).click();
  await page.waitForURL(/\/items\/price-lists\/[0-9a-f-]{36}/, { timeout: 15000 });
  const listId = page.url().match(/price-lists\/([0-9a-f-]{36})/)[1];
  const made = (await get(`/price-lists/${listId}/rates`)).data;
  check('the server holds the new list at -5%', Number(made?.adjust_percent) === -5, made?.adjust_percent);
  const ruleText = page.getByTestId('price-list-rule-text');
  check('the rule reads as words', (await ruleText.innerText()) === '5% below usual price', await ruleText.innerText());

  /* ---------- pin a rate ---------- */
  const pinRow = page.getByTestId('price-list-pin');
  await pinRow.getByRole('combobox').click();
  await page.keyboard.type(moong.name.slice(0, 18));
  await page.getByRole('option', { name: new RegExp(moong.name) }).first().click();
  check('picking an item shows its usual price', (await page.getByTestId('price-list-pin-usual').innerText()) === 'Usual price ₹200.00');
  await pinRow.getByRole('textbox', { name: 'Rate' }).fill('180');
  await pinRow.getByRole('button', { name: 'Pin rate' }).click();
  await page.getByTestId('ub-grid-card').filter({ hasText: moong.name }).waitFor({ timeout: 15000 });
  let rates = (await get(`/price-lists/${listId}/rates`)).data.rates;
  check('the server holds the pinned rate 180', Number(rates[0]?.rate) === 180, rates[0]?.rate);
  const card = page.getByTestId('ub-grid-card').filter({ hasText: moong.name });
  check('the card shows the usual price beside the list rate', (await card.innerText()).includes('Usual price ₹200.00') && (await card.innerText()).includes('₹180.00'));

  /* ---------- tap the row to change it ---------- */
  await card.getByRole('button', { name: `Change the rate for ${moong.name}` }).click();
  const rateBox = pinRow.getByRole('textbox', { name: 'Rate' });
  check('tapping the row puts it in the pin row', (await rateBox.inputValue()).startsWith('180'), await rateBox.inputValue());
  await rateBox.fill('175');
  await pinRow.getByRole('button', { name: 'Pin rate' }).click();
  await page.getByTestId('ub-grid-card').filter({ hasText: '₹175.00' }).waitFor({ timeout: 15000 });
  rates = (await get(`/price-lists/${listId}/rates`)).data.rates;
  check('the server holds the changed rate, still one pin', rates.length === 1 && Number(rates[0].rate) === 175, rates.map((r) => r.rate).join(','));

  /* ---------- what a bill would start from ---------- */
  const customers = (await get('/parties?type=customer&module=shop&page_size=10')).data;
  const customer = customers.find((p) => p.status === 'active');
  const before = (await get(`/price-lists/for-party?party=${customer.id}&items=${moong.id},${other.id}`)).data;
  restore = { party: customer.id, list: before?.price_list?.id ?? null };
  await send('put', '/price-lists/assign', { party_id: customer.id, price_list_id: listId });
  const forParty = (await get(`/price-lists/for-party?party=${customer.id}&items=${moong.id},${other.id}`)).data;
  check('a customer on the list starts the pinned item at 175', Number(forParty.rates[moong.id]?.rate) === 175 && forParty.rates[moong.id]?.pinned === true, JSON.stringify(forParty.rates[moong.id]));
  check('and any other item at the rule (100 − 5%)', Number(forParty.rates[other.id]?.rate) === 95, JSON.stringify(forParty.rates[other.id]));

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 780 });
      for (const screen of ['list', 'detail']) {
        await page.goto(`${base}/items/price-lists${screen === 'detail' ? `/${listId}` : ''}`);
        await page.getByTestId(screen === 'detail' ? 'price-list-rule' : 'ub-grid-cards').or(page.locator('main table')).first().waitFor({ timeout: 15000 });
        await page.waitForLoadState('networkidle');
        const m = await page.evaluate(measure);
        const tag = `${screen} ${width} ${locale}`;
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        if (screen === 'detail' && width < 1280) {
          check(`${tag}: Pin rate ≥ 44 px`, m.pinButton >= 44, `${m.pinButton}`);
          check(`${tag}: remove ≥ 44 px`, m.unpin >= 44, `${m.unpin}`);
        }
        if (screen === 'detail' && width === 1280) check(`${tag}: the rule sits beside the pinned rates`, m.side);
        if (screen === 'list' && width === 1280)
          check(`${tag}: a table row opens its list`, (await page.locator('main table a').filter({ hasText: listName }).getAttribute('href')) === `/items/price-lists/${listId}`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${screen}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- change the rule, remove the pin, delete (phone) ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/items/price-lists/${listId}`);
  await page.getByTestId('price-list-rule').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: `Edit the rule of ${listName}` }).click();
  await dialog.getByRole('textbox', { name: /Change on usual price/ }).fill('-10');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByText('10% below usual price').first().waitFor({ timeout: 15000 });
  check('the rule now reads 10% below', (await ruleText.innerText()) === '10% below usual price', await ruleText.innerText());
  check('the server holds -10%', Number((await get(`/price-lists/${listId}/rates`)).data.adjust_percent) === -10);

  await page.getByRole('button', { name: `Remove the pinned rate for ${moong.name}` }).click();
  await page.getByText('No item has a pinned rate on this list yet.').waitFor({ timeout: 15000 });
  rates = (await get(`/price-lists/${listId}/rates`)).data.rates;
  check('removing the pin leaves the server with none', rates.length === 0, `${rates.length}`);

  await send('put', '/price-lists/assign', { party_id: restore.party, price_list_id: restore.list });
  restore = null;
  await page.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).or(page.getByRole('button', { name: 'Delete' })).first().click();
  await page.getByRole('alertdialog').or(dialog).getByRole('button', { name: 'Delete' }).click();
  await page.waitForURL((u) => u.pathname === '/items/price-lists', { timeout: 15000 });
  check('deleting the list removes it on the server', (await get(`/price-lists/${listId}/rates`)).status === 404);
} finally {
  if (restore && api) await api('put', '/price-lists/assign', { party_id: restore.party, price_list_id: restore.list }).catch(() => {});
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
