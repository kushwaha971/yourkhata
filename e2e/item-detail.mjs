/**
 * Revamp §8.2 — the item page on the LOCAL QA stack, through the real API and back.
 *
 *   NODE_PATH=$(npm root -g) node e2e/item-detail.mjs [--shots=/tmp/e2e-shots/item-detail]
 *
 * Sets up its own items through the API (a tracked item with a recorded and a
 * voided purchase, a service, an archived item), then:
 *
 *  * LOOKs at each at 390, 320 and 1280 in English and Hindi: no sideways
 *    scroll, every text node inside its own box and the viewport, stock before
 *    actions before price before history on a phone, actions ≥ 44 px;
 *  * reads the movement rows: with BP-19 on the server the bill is named
 *    ("Bought on PB/…", "PB/… cancelled") and the row opens it; without it the
 *    row says its type and links nowhere; never a raw message id either way;
 *  * the history chips: Sales loads its own panel on tap;
 *  * Adjust stock from the page (not ⋯): posts −1 Damage, the server's on-hand
 *    fell by exactly 1 and the newest row reads "Adjusted: Damage";
 *  * ⋯ → Edit on a phone opens the item form (the 17 Oct capture-phase defect);
 *  * a service has no stock block and no Adjust stock; an archived item has a
 *    banner whose Restore brings it back on the server.
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
  const doc = (d) => d.bill ?? d.item ?? d;

  const units = await get('/units');
  const nos = (units.find?.((u) => u.code === 'NOS') ?? units[0]).id;
  const stamp = Date.now().toString(36).toUpperCase();
  const goods = doc(
    await post('/items', {
      name: `QA82 Atta bag ${stamp}`,
      unit_id: nos,
      selling_price: '450.00',
      purchase_price: '390.00',
      tax_code: 'GST5',
      hsn_sac: '1101',
      tax_inclusive_selling: true,
      reorder_point: '5',
      opening_stock: { qty: '20', unit_cost: '380' },
    })
  );
  const service = doc(
    await post('/items', {
      name: `QA82 Delivery charge ${stamp}`,
      unit_id: nos,
      item_type: 'service',
      track_stock: false,
      selling_price: '50.00',
      tax_code: 'GST18',
    })
  );
  const archived = doc(
    await post('/items', { name: `QA82 Old item ${stamp}`, unit_id: nos, selling_price: '10.00', tax_code: 'GST5' })
  );
  await post(`/items/${archived.id}/archive`);
  const supplier = (await get('/parties?type=supplier&module=shop&page_size=10')).find((s) => s.status === 'active');
  const billBody = (n) => ({
    party_id: supplier.id,
    supplier_invoice_number: `QA82-${stamp}-${n}`,
    lines: [{ item_id: goods.id, qty: '4', unit_cost: '385' }],
  });
  const kept = doc(await post('/purchases/bills?record=true', billBody('A')));
  const gone = doc(await post('/purchases/bills?record=true', billBody('B')));
  await post(`/purchases/bills/${gone.id}/void`, { reason: 'Entered twice in QA', version: gone.version });
  console.log(`set up ${goods.name}: ${kept.number} kept, ${gone.number} void; service; archived`);

  const PAGES = [
    ['goods', goods.id],
    ['service', service.id],
    ['archived', archived.id],
  ];
  const measure = () =>
    page.evaluate(() => {
      const top = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? null;
      const cut = [];
      for (const el of document.querySelectorAll('main *')) {
        if (el.children.length || !el.textContent?.trim()) continue;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1) continue; // screen-reader-only labels are clipped on purpose
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
          cut.push(el.textContent.trim().slice(0, 30));
        if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
      }
      const heights = [...document.querySelectorAll('[data-testid=item-primary-actions] button')]
        .filter((e) => e.offsetParent)
        .map((e) => Math.round(e.getBoundingClientRect().height));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        stock: top('[data-testid=item-stock]'),
        actions: top('[data-testid=item-primary-actions]'),
        price: top('[data-testid=item-price]'),
        history: top('[data-testid=item-history]'),
        raw: /\b(stock|items|inventory)\.[a-z]+\.[a-z_.]+/.test(document.querySelector('main').innerText),
        heights,
        cut: [...new Set(cut)],
      };
    });

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 780 });
      for (const [slug, id] of PAGES) {
        await page.goto(`${base}/items/${id}`);
        await page.getByTestId('item-price').waitFor({ timeout: 15000 });
        if (slug === 'goods') await page.getByTestId('item-movements').waitFor({ timeout: 15000 });
        const m = await measure();
        const tag = `${slug} ${width} ${locale}`;
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut or off screen`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no raw message id`, !m.raw);
        check(`${tag}: actions ≥ 44 px`, m.heights.every((h) => h >= 44), m.heights.join(','));
        if (width < 1280) {
          const order = [m.stock, m.actions, m.price, m.history].filter((x) => x !== null);
          check(
            `${tag}: stock, actions, price, then history`,
            order.every((v, i) => i === 0 || v > order[i - 1]),
            order.map(Math.round).join('/')
          );
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${slug}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });

  /* ---------- Movement rows name and open their bill ----------
     Naming a bill needs BP-19 (the server resolving a movement's document). Without
     it the rows fall back to their movement type, link nowhere, and still show no
     raw message id — which is what this checks on a server that has not got it. */
  const rows = await get(`/items/${goods.id}/movements`);
  const named = rows.some((r) => r.source?.kind);
  await page.goto(`${base}/items/${goods.id}`);
  await page.getByTestId('item-movements').waitFor();
  if (named) {
    const cancelled = page.getByRole('link', { name: `${gone.number} cancelled` });
    check('BP-19: a voided bill reads "… cancelled"', (await cancelled.count()) === 1);
    const bought = page.getByRole('link', { name: `Bought on ${kept.number}` });
    check('BP-19: a recorded bill reads "Bought on …"', (await bought.count()) === 1);
    await bought.click();
    await page.waitForURL(new RegExp(`/purchases/bills/${kept.id}$`), { timeout: 15000 });
    check('BP-19: the row opens that bill', true);
  } else {
    const list = page.getByTestId('item-movements');
    check('without BP-19: purchase rows read "Purchase"', (await list.getByText('Purchase', { exact: true }).count()) >= 2);
    check('without BP-19: the void reads "Reversal", not its raw reason', (await list.getByText('Reversal', { exact: true }).count()) === 1);
    check('without BP-19: document rows link nowhere', (await list.getByRole('link').count()) === 0);
  }

  /* ---------- Sales chip loads its own panel ---------- */
  await page.goto(`${base}/items/${goods.id}`);
  await page.getByRole('radio', { name: 'Sales' }).click();
  await page.waitForTimeout(1500);
  check(
    'Sales chip shows the sales panel, not movements',
    (await page.getByTestId('item-movements').count()) === 0
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-chip-390.png`, fullPage: true });

  /* ---------- Adjust stock from the page ---------- */
  await page.goto(`${base}/items/${goods.id}`);
  const before = Number((await get(`/items/${goods.id}`)).on_hand);
  await page.getByTestId('item-primary-actions').getByRole('button', { name: /Adjust stock/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByPlaceholder('Enter the change').first().fill('-1');
  await dialog.getByRole('combobox', { name: /Reason/ }).click();
  await page.getByRole('option', { name: 'Damage' }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/adjust-filled-390.png` });
  await dialog.getByRole('button', { name: 'Post adjustment' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 15000 });
  const after = Number((await get(`/items/${goods.id}`)).on_hand);
  check('Adjust stock: on hand fell by exactly 1', after === before - 1, `${before} → ${after}`);
  await page.getByText('Adjusted: Damage').first().waitFor({ timeout: 15000 });
  check('Adjust stock: the newest row reads "Adjusted: Damage"', true);
  // The item and its movements refetch side by side; the row can land first.
  const moved = await page
    .getByTestId('item-stock-figure')
    .filter({ hasText: new RegExp(`^${after} `) })
    .waitFor({ timeout: 10000 })
    .then(() => true, () => false);
  const figure = await page.getByTestId('item-stock-figure').innerText();
  check('Adjust stock: the stock block moved too', moved, figure);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-adjust-390.png`, fullPage: true });

  /* ---------- ⋯ → Edit opens the form ---------- */
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /Item name/ }).first().waitFor({ timeout: 15000 });
  check('⋯ → Edit opens the item form', true);
  await page.keyboard.press('Escape');

  /* ---------- Service and archived ---------- */
  await page.goto(`${base}/items/${service.id}`);
  await page.getByText('Services have no stock').waitFor({ timeout: 15000 });
  check('a service says it has no stock', (await page.getByTestId('item-adjust').count()) === 0);
  await page.goto(`${base}/items/${archived.id}`);
  await page.getByText(/This item is archived/).waitFor({ timeout: 15000 });
  await page.getByRole('main').getByRole('button', { name: 'Restore' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
  await page.getByText(/This item is archived/).waitFor({ state: 'detached', timeout: 15000 });
  const restored = await get(`/items/${archived.id}`);
  check('archived banner → Restore: active on the server', restored.status === 'active', restored.status);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
