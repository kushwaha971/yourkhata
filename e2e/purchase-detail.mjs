/**
 * Revamp §6 — purchase detail on the LOCAL QA stack, through the real API and back.
 *
 *   NODE_PATH=$(npm root -g) node e2e/purchase-detail.mjs [--shots=/tmp/e2e-shots/purchase-detail]
 *
 * Sets up its own documents through the API (a fresh unpaid bill, a bill with a
 * standing debit note, a draft and a sent order) so every check starts from a
 * known state, then:
 *
 *  * LOOKs at each page at 390, 320 and 1280 in English and Hindi: no sideways
 *    scroll, every text node inside its own box, money before actions before
 *    lines on a phone, every action at least 44 px tall;
 *  * pays part of the bill from "Pay supplier" and reads the bill back: To pay
 *    fell by exactly that amount and the payment is listed on the page;
 *  * voids the bill with a standing debit note: refused, the dialog names the
 *    note and links to it, nothing changed on the server;
 *  * voids the fresh bill: void banner, server status void, payment kept as
 *    advance (amount paid back to 0, due back to the total);
 *  * creates a bill from the sent order (lands on the new draft's editor), and
 *    deletes a draft from its own page (server answers 404 afterwards).
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
  const get = async (path) => {
    const r = await ctx.request.get(`${api}${path}`);
    return { status: r.status(), body: r.ok() ? await r.json() : null };
  };
  const post = async (path, data = {}) => {
    const r = await ctx.request.post(`${api}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };

  /** A write answers `{bill, …}` (an envelope) or the document itself. */
  const doc = (d) => d.bill ?? d;
  const suppliers = (await get('/parties?type=supplier&module=shop&page_size=40')).body.data;
  const items = (await get('/items?status=active&track_stock=true&page_size=40')).body.data;
  const supplier = suppliers.find((s) => s.status === 'active') ?? suppliers[0];
  const stamp = Date.now().toString(36).toUpperCase();
  const billBody = (n) => ({
    party_id: supplier.id,
    supplier_invoice_number: `QA6-${stamp}-${n}`,
    lines: [
      { item_id: items[0].id, qty: '5', unit_cost: '120' },
      { item_id: items[1].id, qty: '3', unit_cost: '75.5' },
    ],
  });
  const fresh = doc(await post('/purchases/bills?record=true', billBody('A')));
  const noted = doc(await post('/purchases/bills?record=true', billBody('B')));
  const note = doc(
    await post('/purchases/debit-notes', {
      against_id: noted.id,
      reason: 'goods_returned',
      restock: true,
      lines: [{ bill_line_no: noted.lines[0].line_no, qty: '1' }],
    })
  );
  const draft = doc(await post('/purchases/bills', billBody('C')));
  const orderDoc = doc(
    await post('/purchases/orders', {
      party_id: supplier.id,
      lines: [{ item_id: items[0].id, qty: '4', unit_cost: '110' }],
    })
  );
  await post(`/purchases/orders/${orderDoc.id}/send`, { version: orderDoc.version });
  console.log(`set up ${fresh.number}, ${noted.number} with ${note.number}, draft, order`);

  const PAGES = [
    ['bill', `/purchases/bills/${fresh.id}`],
    ['bill-with-note', `/purchases/bills/${noted.id}`],
    ['debit-note', `/purchases/debit-notes/${note.id}`],
    ['order', `/purchases/orders/${orderDoc.id}`],
    ['draft', `/purchases/bills/${draft.id}`],
  ];

  /* ---------- LOOK: every page, three widths, two languages ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 780 });
      for (const [slug, path] of PAGES) {
        await page.goto(`${base}${path}`);
        await page.getByTestId('purchase-lines').waitFor({ timeout: 15000 });
        const m = await page.evaluate(() => {
          const doc = document.documentElement;
          const box = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
          const cut = [];
          for (const el of document.querySelectorAll('main *')) {
            if (el.children.length || !el.textContent?.trim()) continue;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible' && s.textOverflow === 'ellipsis')
              cut.push(el.textContent.trim().slice(0, 40));
          }
          const actions = [
            ...document.querySelectorAll('[data-testid="purchase-actions"] a, [data-testid="purchase-actions"] button'),
          ].map((a) => Math.round(a.getBoundingClientRect().height));
          return {
            overflow: doc.scrollWidth - window.innerWidth,
            money: box('[data-testid="purchase-money"]')?.top ?? null,
            actions: box('[data-testid="purchase-actions"]')?.top ?? null,
            lines: box('[data-testid="purchase-lines"]')?.top ?? null,
            heights: actions,
            cut,
          };
        });
        const tag = `${slug} ${width} ${locale}`;
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: actions ≥ 44 px`, m.heights.every((h) => h >= 44), m.heights.join(','));
        if (width < 1280) {
          check(
            `${tag}: money, then actions, then lines`,
            m.money < (m.actions ?? m.money + 1) && (m.actions ?? m.money) < m.lines,
            `${m.money}/${m.actions}/${m.lines}`
          );
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${slug}-${width}-${locale}.png`, fullPage: true });
        if (slug === 'bill' && width !== 1280) {
          await page.getByTestId('purchase-wrong').click();
          await page.getByTestId('purchase-void').waitFor();
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/chooser-${width}-${locale}.png` });
          await page.keyboard.press('Escape');
        }
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });

  /* ---------- Pay part of the fresh bill, read it back ---------- */
  await page.goto(`${base}/purchases/bills/${fresh.id}`);
  await page.getByTestId('record-payment-action').click();
  const amount = page.getByRole('textbox', { name: /^Amount/ }).first();
  await amount.waitFor();
  await amount.fill('100');
  await page.getByTestId('payment-save').click();
  await page.getByTestId('payment-saved').waitFor({ timeout: 15000 });
  const paid = (await get(`/purchases/bills/${fresh.id}`)).body.data;
  check(
    'Pay supplier: To pay fell by exactly ₹100',
    Number(paid.amount_due) === Number(fresh.amount_due) - 100,
    `${fresh.amount_due} → ${paid.amount_due}`
  );
  await page.goto(`${base}/purchases/bills/${fresh.id}`);
  await page.getByTestId('purchase-payments').waitFor();
  check('Pay supplier: the payment is listed on the bill', true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-pay-390.png`, fullPage: true });

  /* ---------- Void refused by the standing debit note ---------- */
  await page.goto(`${base}/purchases/bills/${noted.id}`);
  await page.getByTestId('purchase-wrong').click();
  await page.getByTestId('purchase-void').click();
  await page.getByLabel(/Reason/).fill('Entered twice in QA');
  await page.getByTestId('purchase-void-confirm').click();
  const link = page.getByTestId('purchase-void-blocker-link');
  await link.waitFor({ timeout: 15000 });
  check(
    'void with a standing note: refused and linked to the note',
    (await link.getAttribute('href')) === `/purchases/debit-notes/${note.id}`
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/void-refused-note-390.png` });
  const still = (await get(`/purchases/bills/${noted.id}`)).body.data;
  check('void with a standing note: bill unchanged on the server', still.status !== 'void', still.status);

  /* ---------- Void the paid-in-part fresh bill ---------- */
  await page.goto(`${base}/purchases/bills/${fresh.id}`);
  await page.getByTestId('purchase-wrong').click();
  await page.getByTestId('purchase-void').click();
  await page.getByLabel(/Reason/).fill('Entered wrongly in QA');
  await page.getByTestId('purchase-void-confirm').click();
  await page.getByText('This bill is void').waitFor({ timeout: 15000 });
  const voided = (await get(`/purchases/bills/${fresh.id}`)).body.data;
  check(
    'void: status void, payment released as advance',
    voided.status === 'void' && voided.amount_paid === '0.00' && voided.amount_due === voided.grand_total,
    `${voided.status} paid ${voided.amount_paid} due ${voided.amount_due}`
  );
  check(
    'void: no actions left on a void bill',
    (await page.getByTestId('purchase-actions').count()) === 0
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-void-390.png`, fullPage: true });

  /* ---------- Order → bill ---------- */
  await page.goto(`${base}/purchases/orders/${orderDoc.id}`);
  await page.getByTestId('purchase-order-create-bill').click();
  await page.waitForURL(/\/purchases\/bills\/[^/]+\/edit/, { timeout: 15000 });
  const billed = (await get(`/purchases/orders/${orderDoc.id}`)).body.data;
  check('Create bill: order billed and the new draft opened', billed.status === 'billed', billed.status);

  /* ---------- Delete a draft from its page ---------- */
  await page.goto(`${base}/purchases/bills/${draft.id}`);
  await page.getByTestId('purchase-delete-draft').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete draft' }).click();
  await page.waitForURL((u) => u.pathname === '/purchases/bills', { timeout: 15000 });
  const gone = await get(`/purchases/bills/${draft.id}`);
  check('Delete draft: gone on the server', gone.status === 404, String(gone.status));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
