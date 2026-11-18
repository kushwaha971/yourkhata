/**
 * Edge-case catalogue, the Purchases, Payments and Items/stock columns
 * (16 Nov 2026, go-live gate §11). The Bill column was run by a4-edges; these
 * three were "not run". Server side of each case, read back by the document's
 * own id, on a fresh business so nothing else moves its figures.
 *
 *   node e2e/shop-edges-ppi.mjs [--skew]   (--skew must fail: proves the read-back can fail)
 */
import { newOwner, must, api, uniqMobile } from './lib/fixtures.mjs';

const SKEW = process.argv.includes('--skew') ? 1 : 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const n = (v) => Number(v ?? NaN);
const reason = (r) => r.body?.error?.message ?? '';
const plainReason = (r) => reason(r).length > 3 && !/something went wrong/i.test(reason(r));

const owner = await newOwner({ shop: 'Edge Kirana', name: 'Edge Owner', prefix: 'qa-edges-ppi' });
const T = owner.token;
const unit = (await must('GET', '/units', null, T)).find((u) => u.code === 'NOS');
const item = await must('POST', '/items', { name: 'Edge Soap', unit_id: unit.id, purchase_price: '20.00', selling_price: '30.00', tax_code: 'GST0', track_stock: true }, T);
const supplier = await must('POST', '/parties', { name: 'Edge Supplier', is_supplier: true, is_customer: false, mobile: uniqMobile(), state_code: '27' }, T);
const onHand = async () => n((await must('GET', `/items/${item.id}`, null, T)).on_hand);
const books = async (id) => {
  const shop = await must('GET', `/parties/${id}?book=shop`, null, T);
  const main = await must('GET', `/parties/${id}`, null, T);
  return { shop: n(shop.shop_balance), main: n(main.balance) };
};
const billBody = (qty, cost, extra = {}) => ({
  party_id: supplier.id, supplier_invoice_number: `E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, supplier_invoice_date: today,
  lines: [{ item_id: item.id, description: item.name, qty, unit_code: 'NOS', unit_cost: cost, tax_code: 'GST0' }], ...extra,
});

// ── Purchases ────────────────────────────────────────────────────────────────
{
  // E1: the same save sent twice (a lost reply retried) is one document.
  // A draft is not keyed (like sales); the step that moves stock and money is.
  const bill = await must('POST', '/purchases/bills', billBody('2', '20.00'), T);

  // E6: lines add up to the total.
  const sum = bill.lines.reduce((s, l) => s + n(l.line_total ?? l.amount ?? n(l.qty) * n(l.unit_cost)), 0);
  check('P E6: the lines add up to the total', Math.abs(sum - n(bill.grand_total)) < 0.005 && n(bill.grand_total) === 40 + SKEW, `${sum} vs ${bill.grand_total}`);

  // E9 + E10: recording adds the stock and moves only the Shop's book.
  const stock0 = await onHand();
  const b0 = await books(supplier.id);
  const key = { 'Idempotency-Key': `edge-rec-${Date.now()}` };
  const [rec, rec2] = await Promise.all([api('POST', `/purchases/bills/${bill.id}/record`, {}, T, key), api('POST', `/purchases/bills/${bill.id}/record`, {}, T, key)]);
  const rec3 = await api('POST', `/purchases/bills/${bill.id}/record`, {}, T, key);
  check('P: recording the purchase is accepted', [rec, rec2].some((r) => r.status < 300), `${rec.status}/${rec2.status} ${reason(rec)}${reason(rec2)}`);
  check('P E1: Record sent twice at once, then retried, is never a 500', [rec, rec2, rec3].every((r) => r.status < 500), `${rec.status}/${rec2.status}/${rec3.status}`);
  const stock1 = await onHand();
  const b1 = await books(supplier.id);
  check('P E9: stock rises by exactly the bought quantity', stock1 - stock0 === 2 + SKEW, `${stock0} → ${stock1}`);
  check('P E10: the supplier\'s Shop balance moves by the total', Math.abs(Math.abs(b1.shop - b0.shop) - 40) < 0.005, `${b0.shop} → ${b1.shop}`);
  check('P E10: the Money book balance does not move', b1.main === b0.main, `${b0.main} → ${b1.main}`);

  // E19: a recorded purchase cannot be edited, recorded again or deleted.
  const fresh = await must('GET', `/purchases/bills/${bill.id}`, null, T);
  // BR-7: only the note may change after recording; a line may not.
  const note = await api('PATCH', `/purchases/bills/${bill.id}`, { notes: 'late note', version: fresh.version }, T);
  check('P E19: the note can still be changed (BR-7)', note.status < 300, `${note.status}`);
  const noted = await must("GET", `/purchases/bills/${bill.id}`, null, T);
  const edit = await api('PATCH', `/purchases/bills/${bill.id}`, { version: noted.version, lines: [{ item_id: item.id, description: item.name, qty: '9', unit_code: 'NOS', unit_cost: '20.00', tax_code: 'GST0' }] }, T);
  const again = await api('POST', `/purchases/bills/${bill.id}/record`, {}, T);
  const del = await api('DELETE', `/purchases/bills/${bill.id}`, null, T);
  check('P E19: editing a recorded purchase is refused', edit.status >= 400, `${edit.status}`);
  check('P E19: recording it again is refused or a no-op', again.status >= 400 || (await onHand()) === stock1, `${again.status}`);
  check('P E19: deleting it is refused', del.status >= 400, `${del.status}`);
  check('P E15: each refusal gives a plain reason', [edit, del].every(plainReason), [edit, del].map(reason).join(' | '));

  // E23: paying more than is due is refused.
  const payOut = (amt, alloc = amt) => api('POST', '/payments', { direction: 'out', party_id: supplier.id, amount: amt, payment_date: today, mode_breakup: [{ mode: 'cash', amount: amt }], allocations: [{ document_type: 'purchase_document', document_id: bill.id, amount: alloc }] }, T);
  const over = await payOut('41.00');
  check('P E23: putting more than is due against the purchase is refused with a reason', over.status >= 400 && plainReason(over), `${over.status} ${reason(over)}`);
  const right = await payOut('40.00');
  const paid = await must('GET', `/purchases/bills/${bill.id}`, null, T);
  const onPaid = await payOut('1.00');
  check('P E23: the full amount pays it', right.status < 300 && n(paid.amount_due) === 0 && n(paid.amount_paid) <= n(paid.grand_total), `${right.status} due ${paid.amount_due} paid ${paid.amount_paid}`);
  check('P E23: paying a paid purchase is refused with a reason', onPaid.status >= 400 && plainReason(onPaid), `${onPaid.status} ${reason(onPaid)}`);

  // E12: voiding a recorded purchase puts stock and money back and keeps the record.
  const second = await must('POST', '/purchases/bills', billBody('3', '10.00'), T);
  await must('POST', `/purchases/bills/${second.id}/record`, {}, T);
  const s2 = await onHand();
  const v = await api('POST', `/purchases/bills/${second.id}/void`, { reason: 'entered twice' }, T);
  const after = await must('GET', `/purchases/bills/${second.id}`, null, T);
  check('P E12: voiding is accepted', v.status < 300, `${v.status} ${reason(v)}`);
  check('P E12: the voided purchase is kept, marked void', after.status === 'void' || after.status === 'voided', after.status);
  check('P E12: stock goes back by the voided quantity', s2 - (await onHand()) === 3, `${s2} → ${await onHand()}`);
  const voidAgain = await api('POST', `/purchases/bills/${second.id}/void`, { reason: 'again' }, T);
  check('P E19: voiding twice is refused', voidAgain.status >= 400, `${voidAgain.status}`);

  // E13: a back-dated purchase is accepted and keeps its date.
  const back = await api('POST', '/purchases/bills', { ...billBody('1', '20.00'), supplier_invoice_date: daysAgo(20), bill_date: daysAgo(20), document_date: daysAgo(20) }, T);
  check('P E13: a purchase dated 20 days ago is accepted with that date', back.status < 300 && [back.body.data.supplier_invoice_date, back.body.data.document_date].includes(daysAgo(20)), `${back.status} ${back.body?.data?.document_date}`);

  // E7 + E25: absurd amounts and negative totals refused.
  const huge = await api('POST', '/purchases/bills', billBody('1', '99999999999.00'), T);
  const negQty = await api('POST', '/purchases/bills', billBody('-2', '20.00'), T);
  const bigDisc = await api('POST', '/purchases/bills', billBody('1', '20.00', { discount_type: 'amount', discount_value: '200.00' }), T);
  const pct = await api('POST', '/purchases/bills', billBody('1', '20.00', { discount_type: 'percent', discount_value: '150' }), T);
  check('P E7: a cost of 99,999,999,999 is refused with a reason', huge.status >= 400 && plainReason(huge), `${huge.status} ${reason(huge)}`);
  check('P E8: a negative quantity is refused', negQty.status >= 400, `${negQty.status}`);
  check('P E25: a discount above the total never makes it negative', bigDisc.status >= 400 || n(bigDisc.body?.data?.grand_total) >= 0, `${bigDisc.status} ${bigDisc.body?.data?.grand_total}`);
  check('P E25: a discount above 100 % is refused', pct.status >= 400, `${pct.status}`);

  // E21: an empty purchase is not saved.
  const empty = await api('POST', '/purchases/bills', { ...billBody('1', '1'), lines: [] }, T);
  const emptyRec = empty.status < 300 ? await api('POST', `/purchases/bills/${empty.body.data.id}/record`, {}, T) : { status: 400 };
  check('P E21: a purchase with no lines cannot be recorded', emptyRec.status >= 400, `create ${empty.status}, record ${emptyRec.status}`);

  // E5: two devices — the one a version behind is refused.
  const draft = await must('POST', '/purchases/bills', billBody('1', '5.00'), T);
  const one = await api('PATCH', `/purchases/bills/${draft.id}`, { notes: 'device one', version: draft.version }, T);
  const two = await api('PATCH', `/purchases/bills/${draft.id}`, { notes: 'device two', version: draft.version }, T);
  check('P E5: the second device, a version behind, is refused', one.status < 300 && two.status === 409, `${one.status}/${two.status}`);
  check('P E15: that refusal says why', plainReason(two), reason(two));

  // E17: a 200-character Hindi + emoji supplier saves whole.
  const long = `${'आटा दाल चावल 🌾 '.repeat(14)}`.slice(0, 200);
  const lp = await api('POST', '/parties', { name: long, is_supplier: true, is_customer: false, state_code: '27' }, T);
  check('P E17: a 200-character Hindi + emoji supplier is kept whole', lp.status >= 400 ? plainReason(lp) : lp.body.data.name === long.trim(), `${lp.status} ${reason(lp)}`);
}

// ── Payments ─────────────────────────────────────────────────────────────────
{
  const cust = await must('POST', '/parties', { name: 'Edge Customer', is_customer: true, mobile: uniqMobile(), state_code: '27' }, T);
  await must('POST', '/stock-adjustments', { reason: 'other', note: 'edge stock', lines: [{ item_id: item.id, qty: '50', unit_cost: '20' }] }, T);
  const inv = await api('POST', '/sales/invoices?issue=true', { party_id: cust.id, document_date: today, lines: [{ item_id: item.id, qty: '10', unit_price: '30.00' }] }, T);
  check('Pay: a ₹300 credit bill is issued', inv.status < 300, `${inv.status} ${reason(inv)}`);
  const bill = inv.body.data;
  const b0 = await books(cust.id);

  // E1: one receipt for a save sent twice.
  const key = { 'Idempotency-Key': `edge-pay-${Date.now()}` };
  const body = { direction: 'in', party_id: cust.id, document_id: bill.id, payment_date: today, mode_breakup: [{ mode: 'cash', amount: '100.00' }] };
  const [a, b] = await Promise.all([api('POST', '/payments', body, T, key), api('POST', '/payments', body, T, key)]);
  const ids = new Set([a.body?.data?.id, b.body?.data?.id].filter(Boolean));
  check('Pay E1: a receipt sent twice with one key is one receipt', ids.size === 1, `${a.status}/${b.status}`);
  const pay = await must('GET', `/payments/${[...ids][0]}`, null, T);
  const b1 = await books(cust.id);
  check('Pay E10: the Shop book moves by exactly ₹100', Math.abs(Math.abs(b0.shop - b1.shop) - (100 + SKEW)) < 0.005, `${b0.shop} → ${b1.shop}`);
  check('Pay E10: the Money book does not move', b0.main === b1.main, `${b0.main} → ${b1.main}`);
  const parts = (pay.mode_breakup ?? []).reduce((s, m) => s + n(m.amount), 0);
  check('Pay E6: the modes add up to the amount', Math.abs(parts - n(pay.amount)) < 0.005 && n(pay.amount) === 100, `${parts} vs ${pay.amount}`);
  const billNow = await must('GET', `/sales/invoices/${bill.id}`, null, T);
  check('Pay E6: the bill now shows ₹200 due', n(billNow.amount_due) === 200, billNow.amount_due);

  // E23: more than due, and on a paid bill.
  const alloc = (amt) => api('POST', '/payments', { direction: 'in', party_id: cust.id, payment_date: today, amount: amt, mode_breakup: [{ mode: 'cash', amount: amt }], allocations: [{ document_type: 'sales_document', document_id: bill.id, amount: amt }] }, T);
  const over = await alloc('250.00');
  check('Pay E23: putting more than is due against a bill is refused with a reason', over.status >= 400 && plainReason(over), `${over.status} ${reason(over)}`);
  await must('POST', '/payments', { ...body, mode_breakup: [{ mode: 'upi', amount: '200.00' }] }, T);
  const onPaid = await alloc('1.00');
  check('Pay E23: any amount on a paid bill is refused', onPaid.status >= 400 && plainReason(onPaid), `${onPaid.status} ${reason(onPaid)}`);
  const paidBill = await must('GET', `/sales/invoices/${bill.id}`, null, T);
  check('Pay E23: the bill never shows paid above its total', n(paidBill.amount_paid) <= n(paidBill.grand_total) && n(paidBill.amount_due) === 0, `${paidBill.amount_paid}/${paidBill.grand_total}`);

  // E7: extra zeros and zero/negative amounts.
  for (const amt of ['99999999999.00', '0', '-50']) {
    const r = await api('POST', '/payments', { direction: 'in', party_id: cust.id, payment_date: today, amount: amt, mode_breakup: [{ mode: 'cash', amount: amt }] }, T);
    check(`Pay E7: an amount of ${amt} is refused with a reason`, r.status >= 400 && plainReason(r), `${r.status} ${reason(r)}`);
  }

  // E12 + E19: cancel a receipt — the bill is due again, the record stays, twice is refused.
  const beforeVoid = await books(cust.id);
  const v = await api('POST', `/payments/${pay.id}/void`, { reason: 'wrong amount' }, T);
  const kept = await must('GET', `/payments/${pay.id}`, null, T);
  const reopened = await must('GET', `/sales/invoices/${bill.id}`, null, T);
  const b2 = await books(cust.id);
  check('Pay E12: cancelling the receipt is accepted', v.status < 300, `${v.status} ${reason(v)}`);
  check('Pay E12: the receipt is kept, marked cancelled', /void|cancel/i.test(kept.status ?? ''), kept.status);
  check('Pay E12: the bill is ₹100 due again', n(reopened.amount_due) === 100, reopened.amount_due);
  check('Pay E12: cancelling moves the Shop book back by exactly ₹100', Math.abs(Math.abs(b2.shop - beforeVoid.shop) - 100) < 0.005, `${beforeVoid.shop} → ${b2.shop}`);
  const again = await api('POST', `/payments/${pay.id}/void`, { reason: 'again' }, T);
  check('Pay E19: cancelling twice is refused', again.status >= 400, `${again.status}`);

  // E13: a receipt dated last week is accepted and keeps its date.
  const backBody = { direction: 'in', party_id: cust.id, payment_date: daysAgo(7), amount: '10.00', mode_breakup: [{ mode: 'cash', amount: '10.00' }] };
  const early = await api('POST', '/payments', backBody, T);
  check('Pay E13: a receipt dated before the open bill is not put against it silently', early.status === 400 && /before the bill/i.test(JSON.stringify(early.body?.error?.details ?? '')), `${early.status} ${JSON.stringify(early.body?.error?.details ?? '')}`);
  const back = await api('POST', '/payments', { ...backBody, allocations: 'none' }, T);
  check('Pay E13: kept as an advance, the receipt dated 7 days ago keeps that date', back.status < 300 && back.body.data.payment_date === daysAgo(7), `${back.status} ${back.body?.data?.payment_date} ${JSON.stringify(back.body?.error?.details ?? '')}`);
  const future = await api('POST', '/payments', { direction: 'in', party_id: cust.id, payment_date: daysAgo(-30), amount: '10.00', mode_breakup: [{ mode: 'cash', amount: '10.00' }] }, T);
  check('Pay E13: a receipt dated a month ahead is refused', future.status >= 400, `${future.status} ${reason(future)}`);

  // E17: long Hindi + emoji note kept whole.
  const note = 'नकद मिला 🙏 '.repeat(20).slice(0, 200);
  const ln = await api('POST', '/payments', { direction: 'in', party_id: cust.id, payment_date: today, amount: '5.00', mode_breakup: [{ mode: 'cash', amount: '5.00' }], note }, T);
  check('Pay E17: a 200-character Hindi + emoji note is kept or refused with a reason', ln.status < 300 ? (ln.body.data.note ?? '').length > 0 : plainReason(ln), `${ln.status}`);
}

// ── Items / stock ────────────────────────────────────────────────────────────
{
  // E7 + E8: absurd prices and quantities.
  const huge = await api('POST', '/items', { name: 'Huge price', unit_id: unit.id, selling_price: '99999999999.00', tax_code: 'GST0' }, T);
  check('I E7: a price of 99,999,999,999 is refused with a reason', huge.status >= 400 && plainReason(huge), `${huge.status} ${reason(huge)}`);
  const neg = await api('POST', '/items', { name: 'Negative price', unit_id: unit.id, selling_price: '-5.00', tax_code: 'GST0' }, T);
  check('I E7: a negative price is refused', neg.status >= 400, `${neg.status}`);
  const frac = await api('POST', '/stock-adjustments', { reason: 'other', note: 'frac', lines: [{ item_id: item.id, qty: '1.5', unit_cost: '20' }] }, T);
  check('I E8: half a piece of a whole-number item is refused', frac.status >= 400 && plainReason(frac), `${frac.status} ${reason(frac)}`);
  const z0 = await onHand();
  const zero = await api('POST', '/stock-adjustments', { reason: 'other', note: 'zero', lines: [{ item_id: item.id, qty: '0', unit_cost: '20' }] }, T);
  check('I E8: a zero adjustment changes nothing', (await onHand()) === z0, `${zero.status} ${z0} → ${await onHand()}`);

  // E9: an adjustment moves stock by exactly its quantity.
  const s0 = await onHand();
  await must('POST', '/stock-adjustments', { reason: 'other', note: 'count', lines: [{ item_id: item.id, qty: '-4', unit_cost: '20' }] }, T);
  check('I E9: taking 4 out lowers stock by exactly 4', s0 - (await onHand()) === 4 + SKEW, `${s0} → ${await onHand()}`);

  // E11: selling more than is in stock.
  const left = await onHand();
  const cust = await must('POST', '/parties', { name: 'Edge Buyer', is_customer: true, mobile: uniqMobile(), state_code: '27' }, T);
  const sell = await api('POST', '/sales/invoices?issue=true', { party_id: cust.id, document_date: today, lines: [{ item_id: item.id, qty: String(left + 5), unit_price: '30.00' }] }, T);
  const afterSell = await onHand();
  check('I E11: selling past stock is refused naming the item, or allowed to go negative as set',
    (sell.status >= 400 && /soap|stock/i.test(reason(sell))) || (sell.status < 300 && afterSell === left - (left + 5)), `${sell.status} ${reason(sell)} stock ${left} → ${afterSell}`);

  // E5: two devices edit the same item.
  const it = await must('GET', `/items/${item.id}`, null, T);
  const one = await api('PATCH', `/items/${item.id}`, { selling_price: '31.00', version: it.version }, T);
  const two = await api('PATCH', `/items/${item.id}`, { selling_price: '32.00', version: it.version }, T);
  check('I E5: the second device, a version behind, is refused', one.status < 300 && two.status === 409, `${one.status}/${two.status} (version ${it.version})`);

  // E12: archive keeps history; restore brings it back.
  const withStock = await api('POST', `/items/${item.id}/archive`, {}, T);
  check('I E12: an item still holding stock is not archived, with a reason', withStock.status === 409 && plainReason(withStock), `${withStock.status} ${reason(withStock)}`);
  const spare = await must('POST', '/items', { name: 'Edge Spare', unit_id: unit.id, selling_price: '10.00', tax_code: 'GST0', track_stock: true }, T);
  const arch = await api('POST', `/items/${spare.id}/archive`, {}, T);
  const moves = await api('GET', `/items/${item.id}/movements`, null, T);
  const rest = await api('POST', `/items/${spare.id}/restore`, {}, T);
  check('I E12: an empty item archives and restores; history stays readable', arch.status < 300 && rest.status < 300 && moves.status === 200, `${arch.status}/${rest.status}/${moves.status}`);

  // E17: a 200-character Hindi + emoji item name saves whole.
  const long = 'बासमती चावल 🍚 '.repeat(16).slice(0, 200);
  const li = await api('POST', '/items', { name: long, unit_id: unit.id, selling_price: '10.00', tax_code: 'GST0' }, T);
  check('I E17: a 200-character Hindi + emoji item is kept whole or refused with a reason', li.status < 300 ? li.body.data.name === long.trim() : plainReason(li), `${li.status} ${reason(li)}`);

  // E21: an item with no name is refused.
  const blank = await api('POST', '/items', { name: '  ', unit_id: unit.id, selling_price: '10.00', tax_code: 'GST0' }, T);
  check('I E21: an item with a blank name is refused with a reason', blank.status >= 400 && plainReason(blank), `${blank.status} ${reason(blank)}`);
}

const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
