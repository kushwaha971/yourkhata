/**
 * Revamp §8.7 — Low stock and Stock summary on the LOCAL QA stack, through the
 * real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/stock-reports.mjs [--shots=/tmp/e2e-shots/stock-reports]
 *
 * Makes two goods items below their reorder point and:
 *
 *  * LOOKs at Low stock and Stock summary at 390, 320 and 1280 in English and
 *    Hindi: no sideways scroll, every text node inside its box, Order ≥ 44 px
 *    on a phone; a low card says "3 NOS left · reorder at 10 NOS"; a summary
 *    card carries no SKU/category line;
 *  * Order on a phone row opens a new purchase order with that item and its
 *    suggested quantity (10 × 2 − 3 = 17), the purchase price filled in;
 *  * a supplier is picked and Save draft is tapped: the server holds a
 *    draft purchase order with that item and 17 (the persisted result);
 *  * on a desktop two rows are selected and "Order selected" opens ONE order
 *    with both lines;
 *  * Stock summary's Adjust stock opens the adjustment drawer.
 *
 * Local QA tenant only; nothing is sent to anybody.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
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
    if (el.closest('input, [role=combobox]')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const target = (el) => {
    if (!el) return 0;
    const h = el.getBoundingClientRect().height;
    if (innerWidth > 639) return Math.round(h);
    const a = getComputedStyle(el, '::after');
    const over = -(parseFloat(a.top) || 0) - (parseFloat(a.bottom) || 0);
    return Math.round(h + Math.max(0, over));
  };
  /* A button can be cut by its cell or the table's frame while its own text
     fits — measure the button against the frame it sits in. */
  for (const b of document.querySelectorAll('main table button')) {
    const frame = b.closest('table')?.parentElement?.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    if (frame && r.width > 0 && r.right > frame.right + 1) cut.push(`clipped:${b.textContent.trim().slice(0, 30)}`);
  }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    order: target(document.querySelector('[data-testid=low-stock-order]')),
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const api = `${base}/api/v1`;
  const get = async (path) => (await (await ctx.request.get(`${api}${path}`)).json()).data;
  const post = async (path, data = {}) => {
    const r = await ctx.request.post(`${api}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };
  const units = await get('/units');
  const nos = (units.find?.((u) => u.code === 'NOS') ?? units[0]).id;
  const stamp = Date.now().toString(36).toUpperCase();
  // "AAA" sorts these to the top of the low list among the many seeded rows.
  const make = async (name) => {
    const made = await post('/items', {
      name: `${name} ${stamp}`,
      unit_id: nos,
      selling_price: '120.00',
      purchase_price: '90.00',
      tax_code: 'GST5',
      reorder_point: '10',
      opening_stock: { qty: '3', unit_cost: '90' },
    });
    return made.item ?? made;
  };
  const first = await make('QA87 Besan pack');
  const second = await make('QA87 Rava pack');
  const low = await get('/stock/low?page_size=200');
  const lowRow = low.find?.((r) => r.item.id === first.id) ?? (low.rows ?? []).find((r) => r.item.id === first.id);
  check('the server lists the new item as low', Boolean(lowRow), lowRow ? `suggested ${lowRow.suggested_qty}` : 'missing');

  const openLow = async () => {
    await page.goto(`${base}/stock/low`);
    await page.getByTestId('low-stock-screen').waitFor({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
  };
  /** The low list is out-of-stock first, then by name; page until the row shows. */
  const findCard = async (name) => {
    for (let i = 0; i < 10; i++) {
      const card = page.getByTestId('ub-grid-card').filter({ hasText: name });
      if (await card.count()) return card.first();
      const next = page.getByRole('button', { name: /Next page|अगला/ }).locator('visible=true').first();
      if (!(await next.count()) || (await next.isDisabled())) break;
      /* networkidle can settle before the page's request is even sent, and
         a tick then lands on the PREVIOUS page's row; wait for the rows. */
      await Promise.all([page.waitForResponse((r) => r.url().includes('/stock/low')), next.click()]);
      await page.waitForTimeout(300);
    }
    return null;
  };

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 780 });
      for (const screen of ['low', 'summary']) {
        if (screen === 'low') await openLow();
        else {
          await page.goto(`${base}/stock/summary`);
          await page.getByTestId('stock-summary-screen').waitFor({ timeout: 15000 });
          await page.waitForLoadState('networkidle');
        }
        const m = await page.evaluate(measure);
        const tag = `${screen} ${width} ${locale}`;
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        if (screen === 'low' && width < 1280)
          check(`${tag}: Order target ≥ 44 px`, m.order >= 44, `${m.order}`);
        if (screen === 'summary' && width < 1280) {
          const sku = await page.getByTestId('ub-grid-card').first().getByText(/SKU-/).count();
          check(`${tag}: a summary card has no SKU line`, sku === 0);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${screen}-${width}-${locale}.png` });
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- Phone: the row in words, Order ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await openLow();
  const card = await findCard(first.name);
  check('the new item has a card on Low stock', Boolean(card));
  if (card) {
    const words = await card.getByTestId('low-stock-words').innerText();
    check('the card says what is left and where it reorders', words === '3 NOS left · reorder at 10 NOS', words);
    check('the card names the purchase price', (await card.getByText('Purchase price ₹90.00').count()) === 1);
    if (SHOTS) await card.screenshot({ path: `${SHOTS}/card-390.png` });
    await card.getByTestId('low-stock-order').click();
    await page.waitForURL(/\/purchases\/orders\/new\?items=/, { timeout: 15000 });
    check('Order opens a new purchase order with the item', page.url().includes(first.id));
    const line = page.getByText(first.name).first();
    await line.waitFor({ timeout: 15000 });
    check('the order has the item on a line', true);
    const qty = await page.locator('input[value="17"]').count();
    check('the line carries the suggested 17', qty >= 1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-390.png`, fullPage: true });

    /* Persisted: pick a supplier and Save draft. */
    const supplier = (await get('/parties?type=supplier&module=shop&page_size=10')).find((s) => s.status === 'active');
    const picker = page.getByRole('combobox', { name: /Supplier/ }).first();
    await picker.click();
    await page.keyboard.type(supplier.name.slice(0, 12));
    await page.getByRole('option', { name: new RegExp(supplier.name.slice(0, 12)) }).first().click();
    await page.getByRole('button', { name: 'Save draft' }).first().click();
    await page.waitForURL(/\/purchases\/orders\/[0-9a-f-]{36}/, { timeout: 15000 });
    const orderId = page.url().match(/orders\/([0-9a-f-]{36})/)[1];
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-saved-390.png`, fullPage: true });
    const full = await get(`/purchases/orders/${orderId}`);
    const saved = full?.bill ?? full;
    const savedLine = saved?.lines?.find((l) => (l.item?.id ?? l.item_id) === first.id);
    check('the server holds a draft order with the item', saved?.status === 'draft' && Boolean(savedLine), `${saved?.status} ${saved?.number ?? ''}`);
    check('the saved line is 17', Number(savedLine?.qty) === 17, savedLine?.qty);
  }

  /* ---------- Desktop: Order selected ---------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await openLow();
  const pick = async (name) => {
    for (let i = 0; i < 10; i++) {
      const row = page.getByRole('row').filter({ hasText: name });
      if (await row.count()) {
        await row.first().getByRole('checkbox').check();
        return true;
      }
      const next = page.getByRole('button', { name: /Next page/ }).locator('visible=true').first();
      if (!(await next.count()) || (await next.isDisabled())) return false;
      /* networkidle can settle before the page's request is even sent, and
         a tick then lands on the PREVIOUS page's row; wait for the rows. */
      await Promise.all([page.waitForResponse((r) => r.url().includes('/stock/low')), next.click()]);
      await page.waitForTimeout(300);
    }
    return false;
  };
  const both = (await pick(first.name)) && (await pick(second.name));
  check('both rows can be selected on one page', both);
  if (both) {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/selected-1280.png` });
    await page.getByTestId('low-stock-order-selected').click();
    await page.waitForURL(/\/purchases\/orders\/new\?items=/, { timeout: 15000 });
    await page.getByText(second.name).first().waitFor({ timeout: 15000 });
    check(
      'Order selected opens ONE order with both lines',
      (await page.getByText(first.name).count()) >= 1 && (await page.getByText(second.name).count()) >= 1
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/order-selected-1280.png`, fullPage: true });
  }

  /* ---------- Summary: Adjust stock ---------- */
  await page.goto(`${base}/stock/summary`);
  await page.getByTestId('stock-summary-screen').waitFor({ timeout: 15000 });
  await page.getByTestId('summary-adjust').click();
  await page.getByRole('dialog').getByRole('radiogroup').waitFor({ timeout: 15000 });
  check('Stock summary opens Adjust stock', true);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
