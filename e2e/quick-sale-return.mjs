/**
 * Shop round (11 Nov 2026, owner relaxing SAL-04 EC-7): a walk-in brings goods
 * back on a QUICK-SALE bill. Before, the bill offered only "cancel the whole
 * bill". Now ⋯ → Goods came back → the return refunds from the till.
 *
 * On the kirana QA shop, at 390 and 1280: make a ₹ quick-sale bill by API,
 * return one of two through the SCREEN, then read back by id — the note is
 * applied, stock came back, a payout with nobody named left the till, the
 * summary names the walk-in (not "refunded to" and nothing), and cancelling
 * the refund alone is refused with the server's own words.
 *
 *   node e2e/quick-sale-return.mjs
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).kirana;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width >= 1024 ? 860 : 780 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const api = async (method, path, data) =>
      (
        await ctx.request.fetch(`${base}/api/v1${path}`, {
          method,
          data,
          headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
        })
      ).json();

    const item = (await api('GET', '/items?q=QA11-ATTA-12-002&page_size=5')).data.find((i) => i.track_stock !== false);
    const stockOf = async () => Number((await api('GET', `/items/${item.id}`)).data.stock?.on_hand ?? (await api('GET', `/items/${item.id}`)).data.on_hand);
    const bill = (await api('POST', '/sales/invoices', { ...(width >= 1024 ? { walk_in_name: `Return ${width}` } : {}), lines: [{ item_id: item.id, qty: '2' }] })).data;
    const paid = await api('POST', `/sales/invoices/${bill.id}/issue`, {
      version: bill.version,
      payment: { mode_breakup: [{ mode: 'cash', amount: bill.grand_total }] },
    });
    check(`${width}: the quick-sale bill issued`, paid.data?.status === 'paid', JSON.stringify(paid.error ?? paid.data?.status));
    const stockAfterSale = await stockOf();

    // Through the screen, the way a merchant does it.
    await page.goto(`${base}/sales/invoices/${bill.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /more|⋯|actions/i }).first().click();
    const goods = page.getByText('Goods came back');
    check(`${width}: the bill offers Goods came back`, await goods.isVisible());
    await goods.click();
    await page.waitForURL(/credit-notes\/new/);
    const qty = page.locator('input[inputmode=decimal]').first();
    await qty.waitFor();
    await qty.fill('1');
    await page.waitForTimeout(400);
    const text = await page.locator('main').innerText();
    check(`${width}: no hold-as-credit choice, only the refund`, /Quick sale: give back/.test(text) && !/Keep as advance|hold/i.test(text));
    const named = text.match(/refunded to\s*(.*)/)?.[1]?.trim() ?? '';
    // At 390 the bill has no walk-in name, as most counter bills don't.
    const want = width >= 1024 ? `Return ${width}` : 'Quick sale';
    check(`${width}: the summary names who is refunded`, named.startsWith(want), `"refunded to ${named}"`);
    await page.getByTestId('credit-note-issue').click();
    await page.waitForURL(/credit-notes\/[0-9a-f-]{36}$/, { timeout: 15000 });
    const noteId = page.url().split('/').pop();

    const note = (await api('GET', `/sales/credit-notes/${noteId}`)).data;
    check(`${width}: the return is applied, nothing open`, note.status === 'applied' && note.amount_due === '0.00', `${note.status} due ${note.amount_due}`);
    check(`${width}: the return is half the bill`, Math.abs(Number(note.grand_total) * 2 - Number(bill.grand_total)) <= 0.02, `${note.grand_total} of ${bill.grand_total}`);
    check(`${width}: one unit came back into stock`, (await stockOf()) === stockAfterSale + 1, `${stockAfterSale} → ${await stockOf()}`);
    const refundId = note.meta?.refund?.payment_id ?? note.links?.refund?.payment_id ?? note.links?.refund?.id;
    const payouts = (await api('GET', '/payments?direction=out&page_size=20')).data;
    const payout = (payouts.results ?? payouts).find((p) => p.id === refundId) ?? (payouts.results ?? payouts).find((p) => p.amount === note.grand_total && !p.party);
    check(`${width}: a payout with nobody named left the till`, payout && !payout.party && payout.amount === note.grand_total, JSON.stringify(payout && [payout.number, payout.amount, payout.party]));
    if (payout) {
      const alone = await api('POST', `/payments/${payout.id}/void`, { reason: 'Wrong bill' });
      check(`${width}: cancelling the refund alone is refused in words`, alone.error?.code === 'cancel_the_return' && /Cancel the return/.test(alone.error?.message ?? ''), alone.error?.message);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
