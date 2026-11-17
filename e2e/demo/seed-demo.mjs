/**
 * e2e/demo/seed-demo.mjs — the demo book the landing page's recordings and the
 * narrated demo films are shot from.
 *
 * Everything is written through the public API, the way a merchant would make
 * it, so nothing on screen in a recording is a figure the product did not
 * compute. One owner (signed up with a mobile number and an OTP, like anybody),
 * three businesses:
 *
 *   Sharma General Store   Shop & billing   customers, suppliers, items, bills
 *   Vidya Reading Room     Library          catalogue, members, issues, returns
 *   Verma Finance          Lending          borrowers, loans, collections
 *
 * Run it against the DEMO stack only — its own database, the console OTP
 * provider (the code is read from that API's log), unreleased modules shown:
 *
 *   E2E_BACKEND=http://127.0.0.1:8100/api/v1 DEMO_API_LOG=<log> \
 *   DEMO_DB=yourkhata_demo node e2e/demo/seed-demo.mjs
 *
 * Prints one JSON line with the ids the recorders open. Names are invented and
 * the mobiles are in ranges nobody is texted from here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { api, must } from '../lib/fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG = process.env.DEMO_API_LOG;
const OUT = process.env.DEMO_STATE ?? path.join(REPO, 'e2e', 'demo', '.demo-state.json');
if (!LOG) throw new Error('DEMO_API_LOG is required: the demo API log the OTP is read from.');
if (!/8100/.test(process.env.E2E_BACKEND ?? '')) throw new Error('Refusing to seed anything but the demo API on :8100.');

export const OWNER = { name: 'Ramesh Sharma', mobile: '9876543210' };
const iso = (days = 0) => new Date(Date.now() + 5.5 * 3600e3 + days * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const codeFor = async (mobile, from) => {
  for (let i = 0; i < 20; i += 1) {
    const log = readFileSync(LOG, 'utf8').slice(from);
    const hits = [...log.matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits.at(-1)[2];
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('no OTP in the demo API log');
};

// ── The owner signs up with a mobile and a code ─────────────────────────────
const from = readFileSync(LOG, 'utf8').length;
const challenge = await must('POST', '/auth/otp/request', { mobile: OWNER.mobile });
const signedIn = await must('POST', '/auth/otp/verify', { challenge_id: challenge.challenge_id, code: await codeFor(OWNER.mobile, from) });
let tok = signedIn.access_token;

// Each business chooses what it runs at sign-up, the way a merchant now does
// (`apps` on POST /tenants). The reading room is a Library and nothing else;
// the finance business is Lending and nothing else. Until 11 Oct 2026 this
// seed had to switch those modules on behind the API's back.
const business = async (name, apps, extra = {}) => {
  const made = await must('POST', '/tenants', { name, apps, ...(apps.includes('shop') ? { business_type: 'retail' } : {}), state_code: '27', owner_name: OWNER.name }, tok);
  const token = made.access_token ?? (await must('POST', '/auth/switch-tenant', { tenant_id: made.id ?? made.tenant?.id }, tok)).access_token;
  for (const step of [2, 3, 4]) await must('PATCH', '/tenants/current', { onboarding_step: step }, token);
  await must('PATCH', '/tenants/current', { phone: '9876543210', address: { line1: '12 Station Road', city: 'Pune', pincode: '411001', state_code: '27' }, ...extra }, token);
  const me = await must('GET', '/auth/me', null, token);
  return { id: me.active_tenant_id, token };
};

// ── 1. Shop & billing ───────────────────────────────────────────────────────
// A GSTIN with a valid check digit that belongs to nobody (the PAN part is letters from digits).
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const demoGstin = (() => {
  const body = '27AAGFS4321F1Z';
  let sum = 0;
  [...body].forEach((ch, i) => { const p = B36.indexOf(ch) * (i % 2 ? 2 : 1); sum += Math.floor(p / 36) + (p % 36); });
  return body + B36[(36 - (sum % 36)) % 36];
})();
const shop = await business('Sharma General Store', ['shop'], { upi_vpa: 'sharmastore.demo@example', gst_type: 'regular', gstin: demoGstin });
{
  const t = shop.token;
  const units = await must('GET', '/units', null, t);
  const u = (code) => units.find((x) => x.code === code)?.id ?? units[0].id;
  const item = (name, price, tax, hsn, qty, cost, reorder = '10') =>
    must('POST', '/items', { name, unit_id: u('NOS'), selling_price: price, purchase_price: cost, tax_code: tax, hsn_sac: hsn, reorder_point: reorder, opening_stock: { qty, unit_cost: cost, as_of: iso(-30) } }, t);
  const rice = await item('Basmati Rice 5kg', '450.00', 'GST5', '1006', '40', '380.00');
  const dal = await item('Toor Dal 1kg', '165.00', 'GST5', '0713', '60', '130.00');
  const oil = await item('Mustard Oil 1L', '180.00', 'GST5', '1514', '24', '150.00');
  const sugar = await item('Sugar 1kg', '48.00', 'GST5', '1701', '100', '40.00', '20');
  const tea = await item('Tea 250g', '120.00', 'GST5', '0902', '4', '95.00');
  const soap = await item('Bath Soap', '35.00', 'GST18', '3401', '9', '24.00', '12');

  const party = (body) => must('POST', '/parties', { state_code: '27', ...body }, t);
  const ramesh = await party({ name: 'Ramesh Traders', is_customer: true, mobile: '9822012345', opening_balance_amount: '2300.00', opening_balance_direction: 'debit', opening_balance_as_of: iso(-30) });
  const anita = await party({ name: 'Anita General Store', is_customer: true, mobile: '9822012346' });
  const suresh = await party({ name: 'Suresh Kumar', is_customer: true, mobile: '9822012347' });
  const priya = await party({ name: 'Priya Sweets', is_customer: true, mobile: '9822012348' });
  await party({ name: 'Mohan Lal', is_customer: true, mobile: '9822012349' });
  const gupta = await party({ name: 'Gupta Wholesale', is_supplier: true, is_customer: false, mobile: '9822012350' });
  await party({ name: 'Agro Traders', is_supplier: true, is_customer: false, mobile: '9822012351' });

  const line = (it, qty) => ({ item_id: it.id, qty: String(qty) });
  const bill = (body, payment) => must('POST', '/sales/invoices?issue=true', { document_date: iso(0), ...body, ...(payment ? { payment } : {}) }, t);
  await bill({ party_id: ramesh.id, due_on: iso(7), document_date: iso(-6), lines: [line(rice, 2), line(dal, 3)] });
  await bill({ party_id: anita.id, due_on: iso(10), document_date: iso(-3), lines: [line(sugar, 10), line(soap, 3)] });
  await bill({ party_id: suresh.id, due_on: iso(5), document_date: iso(-2), lines: [line(oil, 4), line(tea, 2)] });
  await bill({ party_id: priya.id, due_on: iso(3), lines: [line(sugar, 25), line(oil, 2)] });
  const cashBill = await api('POST', '/sales/invoices?issue=true', { document_date: iso(0), walk_in_name: 'Walk-in customer', lines: [line(rice, 1), line(soap, 1)] }, t);
  if (cashBill.status < 400) {
    const total = cashBill.body.data.grand_total ?? cashBill.body.data.total;
    if (total) await api('POST', '/payments', { direction: 'in', document_id: cashBill.body.data.id, payment_date: iso(0), mode_breakup: [{ mode: 'cash', amount: total }] }, t);
  }
  await must('POST', `/parties/${ramesh.id}/ledger-entries`, { direction: 'credit', amount: '1500.00', entry_date: iso(-1), mode: 'upi', note: 'Part payment' }, t).catch(async () =>
    must('POST', `/parties/${ramesh.id}/ledger-entries`, { type: 'got', amount: '1500.00', entry_date: iso(-1), note: 'Part payment' }, t).catch(() => null));
  await api('POST', '/purchases/bills?record=true', { party_id: gupta.id, document_date: iso(-4), supplier_invoice_no: 'GW/1182', lines: [{ item_id: rice.id, qty: '20', unit_cost: '380.00' }, { item_id: tea.id, qty: '10', unit_cost: '95.00' }] }, t);
  const cats = await must('GET', '/expense-categories', null, t);
  const cat = (re) => (cats.find((c) => re.test(c.name)) ?? cats[0]).id;
  await api('POST', '/expenses', { amount: '8000.00', expense_date: iso(-5), category_id: cat(/rent/i), mode: 'bank', note: 'Shop rent' }, t);
  await api('POST', '/expenses', { amount: '1840.00', expense_date: iso(-2), category_id: cat(/electric|utilit/i), mode: 'upi', note: 'Electricity bill' }, t);
  await api('POST', '/expenses', { amount: '120.00', expense_date: iso(0), category_id: cat(/tea|misc|other/i), mode: 'cash', note: 'Tea and snacks' }, t);
  shop.ramesh = ramesh.id;
  shop.tea = tea.id;
}

// ── 2. Library ──────────────────────────────────────────────────────────────
const library = await business('Vidya Reading Room', ['library']);
// The Library was rebuilt (students, seats, fees, books) and its old title /
// membership API is gone, so the old content here no longer seeds. Until it
// is rewritten for the new API the business exists with an empty book; the
// Ledger page work (17 Nov 2026) needed only Verma Finance.
// ── 3. Lending ──────────────────────────────────────────────────────────────
const lending = await business('Verma Finance', ['lending'], { upi_vpa: 'vermafinance.demo@example' });
{
  const t = lending.token;
  // Lending was rebuilt on 12 Nov 2026: a loan is a borrower on a route, an
  // amount lent, a count of collections and the amount of each. Collections
  // are dated on the round they were taken, so the book has a history, and
  // each borrower stays a little behind so Today has someone to collect from.
  const market = await must('POST', '/lending/routes', { name: 'Market road' }, t);
  const station = await must('POST', '/lending/routes', { name: 'Station side' }, t);
  await must('PATCH', '/lending/settings', { sign_as: 'Verma Finance', upi_id: 'vermafinance.demo@upi' }, t);
  const loan = async (name, mobile, work, route, lent, count, each, startedDaysAgo, charges = '0') => {
    const b = await must('POST', '/lending/borrowers', { name, mobile, work, route_id: route.id }, t);
    return must('POST', '/lending/loans', {
      borrower_id: b.id, lent, count, each, charges, frequency: 'daily', skip_sundays: false, starts_on: iso(-startedDaysAgo),
    }, t);
  };
  const collect = (l, amount, daysAgo = 0, mode = 'cash') => must('POST', `/lending/loans/${l.id}/collections`, { amount, mode, collected_on: iso(-daysAgo) }, t);
  const geeta = await loan('Geeta Devi', '9820011223', 'Vegetable cart', market, '20000.00', 100, '220.00', 6, '1000.00');
  for (const d of [5, 4, 3, 2]) await collect(geeta, '220.00', d);
  await collect(geeta, '150.00', 1);
  const ramu = await loan('Ramu Kaka', '9820011224', 'Tea stall', market, '5000.00', 50, '110.00', 4);
  await collect(ramu, '220.00', 2, 'upi');
  const salma = await loan('Salma Begum', '9820011225', 'Tailor', station, '10000.00', 100, '115.00', 10, '500.00');
  for (const d of [9, 8, 7, 6, 5, 4]) await collect(salma, '115.00', d);
  await loan('Kishore Yadav', '9820011226', 'Auto driver', station, '8000.00', 80, '110.00', 2);
  const paid = await loan('Meena Tai', '9820011227', 'Flower seller', market, '1000.00', 10, '110.00', 12);
  await collect(paid, '1100.00', 1);
  lending.loan = geeta.id;
}

const state = { owner: OWNER, shop: { id: shop.id, ramesh: shop.ramesh, tea: shop.tea }, library: { id: library.id }, lending: { id: lending.id, loan: lending.loan } };
writeFileSync(OUT, JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
