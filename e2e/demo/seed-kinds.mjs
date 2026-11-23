/**
 * e2e/demo/seed-kinds.mjs — one demo shop for each kind on the sign-up screen,
 * so each kind's guide on /solutions/shop-<kind> is photographed from a shop
 * that sells what that kind sells, with that kind's preset (units, words,
 * features) switched on by the server at sign-up exactly as for a merchant.
 *
 *   E2E_BACKEND=http://127.0.0.1:8100/api/v1 DEMO_API_LOG=<log> node e2e/demo/seed-kinds.mjs
 *
 * Run it after seed-demo.mjs (same owner, same demo database). Every name,
 * mobile and figure is invented; mobiles are in ranges nobody is texted from.
 * Writes e2e/demo/.kinds-state.json: { <kind>: { name, ramesh, item } }.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { api, must } from '../lib/fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG = process.env.DEMO_API_LOG;
if (!LOG) throw new Error('DEMO_API_LOG is required: the demo API log the OTP is read from.');
if (!/8100/.test(process.env.E2E_BACKEND ?? '')) throw new Error('Refusing to seed anything but the demo API on :8100.');

const OWNER = { name: 'Ramesh Sharma', mobile: '9876543210' };
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
const from = readFileSync(LOG, 'utf8').length;
const challenge = await must('POST', '/auth/otp/request', { mobile: OWNER.mobile });
const tok = (await must('POST', '/auth/otp/verify', { challenge_id: challenge.challenge_id, code: await codeFor(OWNER.mobile, from) })).access_token;

// [kind, shop name, items: [name, unit, price, cost, gst, hsn, opening qty, reorder], customers, supplier]
const KINDS = [
  ['kirana', 'Gupta Kirana Store', [
    ['Aashirvaad Atta 10kg', 'NOS', '460.00', '410.00', 'GST5', '1101', '30', '8'],
    ['Fortune Soyabean Oil 1L', 'NOS', '155.00', '138.00', 'GST5', '1507', '48', '12'],
    ['Loose Sugar', 'KGS', '44.00', '39.00', 'GST5', '1701', '120', '25'],
    ['Parle-G 250g', 'NOS', '25.00', '21.00', 'GST18', '1905', '6', '24'],
  ], ['Sunita Patil', 'Raju Tea Stall', 'Meena Joshi'], 'Laxmi Wholesale'],
  ['electronics', 'Shree Electricals & Mobile', [
    ['Redmi 13C 4/128', 'NOS', '9499.00', '8600.00', 'GST18', '8517', '8', '2'],
    ['boAt Earbuds Airdopes 141', 'NOS', '1299.00', '950.00', 'GST18', '8518', '15', '4'],
    ['Havells LED Bulb 9W', 'NOS', '110.00', '82.00', 'GST18', '8539', '60', '20'],
    ['Polycab Wire 1.5 sq mm', 'MTR', '22.00', '17.00', 'GST18', '8544', '3', '50'],
  ], ['Anil Mobile Repair', 'Kavita Deshpande', 'Om Construction'], 'Mehta Distributors'],
  ['jewellery', 'Soni Jewellers', [
    ['Gold Ring 22K', 'GMS', '6900.00', '6600.00', 'GST3', '7113', '40', '10'],
    ['Silver Payal', 'GMS', '95.00', '86.00', 'GST3', '7113', '500', '100'],
    ['Gold Chain 22K', 'GMS', '6950.00', '6640.00', 'GST3', '7113', '60', '15'],
    ['Silver Coin 10g', 'NOS', '980.00', '900.00', 'GST3', '7118', '4', '10'],
  ], ['Rekha Bansal', 'Pooja Wedding Order', 'Sanjay Verma'], 'Zaveri Bullion'],
  ['hardware', 'Patel Hardware & Paints', [
    ['Asian Paints Tractor Emulsion 20L', 'NOS', '3150.00', '2800.00', 'GST18', '3209', '12', '3'],
    ['Fevicol SH 1kg', 'NOS', '420.00', '360.00', 'GST18', '3506', '25', '6'],
    ['PVC Pipe 1 inch', 'MTR', '68.00', '55.00', 'GST18', '3917', '200', '40'],
    ['Wood Screws 1.5 inch (box)', 'BOX', '140.00', '110.00', 'GST18', '7318', '5', '10'],
  ], ['Om Construction', 'Ravi Carpenter', 'Sai Interiors'], 'Bharat Paint Depot'],
  ['wholesale', 'Agarwal Traders (Wholesale)', [
    ['Basmati Rice 25kg bag', 'BAG', '2150.00', '1950.00', 'GST5', '1006', '80', '20'],
    ['Toor Dal 30kg bag', 'BAG', '4200.00', '3900.00', 'GST5', '0713', '40', '10'],
    ['Sugar 50kg bag', 'BAG', '2050.00', '1940.00', 'GST5', '1701', '60', '15'],
    ['Tata Salt 1kg (box of 25)', 'BOX', '560.00', '505.00', 'GST5', '2501', '8', '20'],
  ], ['Gupta Kirana Store', 'Shree Ram Provision', 'Annapurna Mess'], 'Mahalaxmi Mills'],
  ['medical', 'Jeevan Medical Store', [
    ['Paracetamol 650 (strip of 15)', 'NOS', '33.00', '24.00', 'GST5', '3004', '200', '50'],
    ['Cough Syrup 100ml', 'BTL', '115.00', '86.00', 'GST5', '3004', '40', '10'],
    ['ORS Sachet', 'PAC', '22.00', '16.00', 'GST5', '3004', '150', '40'],
    ['Digital Thermometer', 'NOS', '240.00', '170.00', 'GST18', '9025', '3', '5'],
  ], ['Dr. Kulkarni Clinic', 'Asha Pawar', 'Vijay Rane'], 'Sanjivani Pharma Agency'],
  ['garments', 'Fashion Point Clothes & Shoes', [
    ['Cotton Shirt', 'PCS', '799.00', '520.00', 'GST5', '6205', '40', '10'],
    ['Denim Jeans', 'PCS', '1299.00', '850.00', 'GST5', '6203', '30', '8'],
    ['Kurti', 'PCS', '649.00', '420.00', 'GST5', '6204', '45', '10'],
    ['Sports Shoes', 'PRS', '1499.00', '980.00', 'GST5', '6404', '4', '6'],
  ], ['Neha Shah', 'Saint Mary School', 'Amit Kale'], 'Surat Textiles'],
  ['auto_parts', 'Sai Auto Parts', [
    ['Brake Shoe (Splendor)', 'SET', '420.00', '310.00', 'GST18', '8714', '25', '6'],
    ['Engine Oil 1L 20W-40', 'LTR', '390.00', '320.00', 'GST18', '2710', '40', '10'],
    ['Clutch Plate (Activa)', 'NOS', '650.00', '480.00', 'GST18', '8714', '12', '4'],
    ['Spark Plug', 'NOS', '120.00', '85.00', 'GST18', '8511', '5', '20'],
  ], ['Bajaj Service Garage', 'Imran Mechanic', 'Rohit Jadhav'], 'Pune Auto Distributors'],
  ['stationery', 'Vidya Stationery & Xerox', [
    ['Classmate Notebook 172 pages', 'NOS', '65.00', '48.00', 'GST5', '4820', '200', '50'],
    ['Reynolds Pen (pack of 10)', 'PAC', '100.00', '72.00', 'GST18', '9608', '30', '10'],
    ['A4 Paper Rim', 'NOS', '310.00', '255.00', 'GST5', '4802', '20', '5'],
    ['Geometry Box', 'NOS', '120.00', '85.00', 'GST18', '9017', '4', '10'],
  ], ['Sunrise English School', 'Kiran Mane', 'Tejas Coaching'], 'Navneet Agency'],
  ['agri', 'Kisan Krishi Kendra', [
    ['Urea 45kg bag', 'BAG', '267.00', '250.00', 'GST5', '3102', '100', '25'],
    ['DAP 50kg bag', 'BAG', '1350.00', '1280.00', 'GST5', '3105', '60', '15'],
    ['Cotton Seed Packet', 'PAC', '864.00', '760.00', 'GST0', '1207', '40', '10'],
    ['Pesticide Spray 1L', 'LTR', '540.00', '430.00', 'GST18', '3808', '6', '10'],
  ], ['Shankar Patil (Farmer)', 'Ganesh More (Farmer)', 'Village Co-op Society'], 'Mahadhan Fertilisers'],
  ['furniture', 'Royal Furniture & Home', [
    ['Sofa Set 3+1+1', 'SET', '28500.00', '21000.00', 'GST18', '9401', '4', '1'],
    ['Wooden Double Bed', 'NOS', '18900.00', '14000.00', 'GST18', '9403', '5', '1'],
    ['Plastic Chair', 'NOS', '650.00', '480.00', 'GST18', '9401', '60', '20'],
    ['Study Table', 'NOS', '4200.00', '3100.00', 'GST18', '9403', '2', '3'],
  ], ['Deshmukh Family', 'Hotel Sai Palace', 'Nikhil Joshi'], 'Godrej Dealer Pune'],
  ['food', 'Shree Sweets & Bakery', [
    ['Kaju Katli', 'KGS', '980.00', '720.00', 'GST5', '1704', '12', '3'],
    ['Gulab Jamun (tin 1kg)', 'NOS', '320.00', '230.00', 'GST5', '2106', '20', '6'],
    ['Milk Bread 400g', 'NOS', '45.00', '34.00', 'GST0', '1905', '30', '10'],
    ['Birthday Cake 1kg', 'NOS', '650.00', '420.00', 'GST18', '1905', '2', '3'],
  ], ['Mahesh Caterers', 'Shubh Mangal Hall', 'Priya Sweets Order'], 'Amul Distributor'],
];

// A GSTIN with a valid check digit that belongs to nobody, one per demo shop.
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gstinFor = (i) => {
  const body = `27AAGFK${String(4300 + i)}F1Z`;
  let sum = 0;
  [...body].forEach((ch, j) => { const p = B36.indexOf(ch) * (j % 2 ? 2 : 1); sum += Math.floor(p / 36) + (p % 36); });
  return body + B36[(36 - (sum % 36)) % 36];
};

const state = {};
let n = 0;
for (const [kind, name, items, customers, supplier] of KINDS) {
  n += 1;
  const made = await must('POST', '/tenants', { name, apps: ['shop'], business_type: kind, state_code: '27', owner_name: OWNER.name }, tok);
  const t = made.access_token ?? (await must('POST', '/auth/switch-tenant', { tenant_id: made.id ?? made.tenant?.id }, tok)).access_token;
  for (const step of [2, 3, 4]) await must('PATCH', '/tenants/current', { onboarding_step: step }, t);
  await must('PATCH', '/tenants/current', { phone: '9876543210', address: { line1: '12 Station Road', city: 'Pune', pincode: '411001', state_code: '27' }, gst_type: 'regular', gstin: gstinFor(n) }, t);
  const units = await must('GET', '/units', null, t);
  const unit = (code) => units.find((x) => x.code === code)?.id ?? units.find((x) => x.code === 'NOS')?.id ?? units[0].id;
  const made_items = [];
  for (const [iname, ucode, price, cost, tax, hsn, qty, reorder] of items) {
    made_items.push(await must('POST', '/items', {
      name: iname, unit_id: unit(ucode), selling_price: price, purchase_price: cost, tax_code: tax, hsn_sac: hsn,
      reorder_point: reorder, opening_stock: { qty, unit_cost: cost, as_of: iso(-30) },
    }, t));
  }
  const mob = (i) => `98${String(30 + n).padStart(2, "0")}${String(1000000 + i).slice(1)}`;
  const people = [];
  for (const [i, cname] of customers.entries()) people.push(await must('POST', '/parties', { state_code: '27', name: cname, is_customer: true, mobile: mob(i) }, t));
  const sup = await must('POST', '/parties', { state_code: '27', name: supplier, is_supplier: true, is_customer: false, mobile: mob(9) }, t);
  const line = (it, q) => ({ item_id: it.id, qty: String(q) });
  const big = Number(items[0][2]) > 5000;
  await must('POST', '/sales/invoices?issue=true', { party_id: people[0].id, document_date: iso(-5), due_on: iso(5), lines: [line(made_items[0], big ? 1 : 2), line(made_items[2], 3)] }, t);
  await must('POST', '/sales/invoices?issue=true', { party_id: people[1].id, document_date: iso(-2), due_on: iso(8), lines: [line(made_items[1], 2)] }, t);
  await must('POST', '/sales/invoices?issue=true', { party_id: people[2].id, document_date: iso(0), due_on: iso(10), lines: [line(made_items[2], 2), line(made_items[1], 1)] }, t);
  await api('POST', '/purchases/bills?record=true', { party_id: sup.id, document_date: iso(-4), supplier_invoice_no: `SUP/${100 + n}`, lines: [{ item_id: made_items[0].id, qty: '5', unit_cost: items[0][3] }] }, t);
  state[kind] = { name, customer: customers[0], customerId: people[0].id, supplier, item: items[0][0], itemId: made_items[0].id, low: items[3][0] };
  console.log(kind, name);
}
writeFileSync(path.join(REPO, 'e2e', 'demo', '.kinds-state.json'), `${JSON.stringify(state, null, 1)}\n`);
