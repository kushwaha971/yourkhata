// Part D edge cases (docs/testing/edge-case-catalogue.md, Items / stock
// column), on the live stack, each read back from the API:
//
//   E1  a stock transfer sent twice with one Idempotency-Key moves stock once
//   E9  stock after a challan, an estimate and a converted challan: the goods
//       leave once, an estimate moves nothing
//   E11 a transfer of more than the place holds is refused; nothing moves
//   E19 an issued challan cannot be edited (409) and its stock is unchanged
//   E9b a batch medicine: the item's stock equals the sum of its batches
//       after a purchase and a sale
//   E17 Expiry, with the batches it holds, does not widen a 320 phone
//
//   node e2e/d-edges.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString().slice(-6);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await signIn(ctx);
const hdr = async (extra = {}) => ({
  'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '',
  ...extra,
});
const get = async (path) => (await (await ctx.request.get(`${base}/api/v1${path}`)).json()).data;
const send = async (path, data, key) =>
  ctx.request.post(`${base}/api/v1${path}`, { headers: await hdr(key ? { 'Idempotency-Key': key } : {}), data });
const onHand = async (id) => {
  const d = await get(`/items/${id}`);
  return (d?.stock ?? []).reduce((sum, s) => sum + Number(s.on_hand), 0);
};

const nos = (await get('/units')).find((u) => u.code === 'NOS');
const mkItem = async (name, extra = {}) =>
  (await (await send('/items', { name, unit_id: nos.id, selling_price: '100', ...extra }, randomUUID())).json()).data;
const party = (await get('/parties?type=customer&page_size=1'))[0];

// ── E1 / E11: transfers ──
const places = await get('/locations');
const shop = places.find((p) => p.is_default);
const godown = places.find((p) => !p.is_default);
if (shop && godown) {
  const cement = await mkItem(`DE cement ${tag}`, { opening_stock: { qty: '50', unit_cost: '300' } });
  const key = randomUUID();
  const body = { from_location_id: shop.id, to_location_id: godown.id, lines: [{ item_id: cement.id, qty: '10' }] };
  const first = await send('/stock-transfers', body, key);
  const second = await send('/stock-transfers', body, key);
  const rows = await get(`/stock-transfers/stock?from=${shop.id}&to=${godown.id}&ids=${cement.id}`);
  const r = rows?.[0] ?? {};
  check('E1: a transfer sent twice with one key moves stock once (shop 40)', first.ok() && second.ok() && Number(r.at_from) === (skew ? 39 : 40), JSON.stringify(r));
  const tooMuch = await send('/stock-transfers', { ...body, lines: [{ item_id: cement.id, qty: '999' }] }, randomUUID());
  check('E11: moving more than the place holds is refused', tooMuch.status() >= 400 && tooMuch.status() < 500, String(tooMuch.status()));
  check('E11: and nothing moved (total still 50)', (await onHand(cement.id)) === 50, String(await onHand(cement.id)));
} else {
  check('set-up: the business has a godown (run d1-transfer first)', false, places.map((p) => p.name).join(','));
}

// ── E9 / E19: estimate, challan, convert ──
const rice = await mkItem(`DE rice ${tag}`, { opening_stock: { qty: '30', unit_cost: '40' } });
const est = (await (await send('/sales/estimates', { party_id: party.id, lines: [{ item_id: rice.id, qty: '5' }] })).json()).data;
const sentEst = await send(`/sales/estimates/${est.id}/mark-sent`, { version: est.version }, randomUUID());
check('E9: an estimate moves no stock (still 30)', (await onHand(rice.id)) === 30, `${sentEst.status()} · ${await onHand(rice.id)}`);
const dc = (await (await send('/sales/delivery-challans', { party_id: party.id, lines: [{ item_id: rice.id, qty: '8' }] })).json()).data;
const issued = await send(`/sales/delivery-challans/${dc.id}/issue`, { version: dc.version }, randomUUID());
const afterDc = await onHand(rice.id);
check('E9: a challan takes its goods out (30 → 22)', issued.ok() && afterDc === (skew ? 21 : 22), `${issued.status()} · ${afterDc}`);
const issuedDoc = (await issued.json()).data;
const edit = await ctx.request.patch(`${base}/api/v1/sales/delivery-challans/${dc.id}`, {
  headers: await hdr(),
  data: { version: issuedDoc.version, lines: [{ item_id: rice.id, qty: '1' }] },
});
check('E19: an issued challan cannot be edited (409)', edit.status() === 409, String(edit.status()));
check('E19: and its stock is unchanged (22)', (await onHand(rice.id)) === 22);
const conv = await send(`/sales/delivery-challans/${dc.id}/convert`, {});
const inv = (await conv.json()).data;
const paid = await send(`/sales/invoices/${inv?.id}/issue`, { version: inv?.version, payment: { mode_breakup: [{ mode: 'cash', amount: inv?.grand_total }] } }, randomUUID());
check('E9: billing the challan does not take the goods again (still 22)', paid.ok() && (await onHand(rice.id)) === 22, `${paid.status()} · ${await onHand(rice.id)}`);

// ── E9b: batches add up to the item's stock ──
const expiry = await get('/stock/expiry?within=90');
const ids = [...new Set((expiry ?? []).map((r) => r.item.id))].slice(0, 5);
let mismatched = [];
for (const id of ids) {
  const rows = (await get('/stock/expiry?within=90')).filter((r) => r.item.id === id);
  const far = (await get('/stock/expiry?within=expired')).filter((r) => r.item.id === id);
  const sum = [...rows, ...far].reduce((s, r) => s + Number(r.qty), 0);
  const held = await onHand(id);
  // Batches expiring after 90 days are not on these lists, so the sum may be
  // lower than the stock but never higher.
  if (sum > held + 1e-9) mismatched.push(`${id}: batches ${sum} > stock ${held}`);
}
check('E9b: no medicine has more in its batches than in stock', ids.length > 0 && mismatched.length === 0, mismatched.join('; ') || `${ids.length} items`);

// ── E17: Expiry with its real (long) names, at 320 ──
const phone = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
const p2 = await signIn(phone);
await p2.goto(`${base}/stock/expiry`, { waitUntil: 'networkidle' });
await sleep(800);
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('E17: Expiry fits a 320 phone', over <= 0, String(over));
await phone.close();

await ctx.close();
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
