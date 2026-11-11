/**
 * Money Book (rebuilt 11 Nov 2026): fills the scale owner's own book with the
 * design's sample people (Part I, `UP` and `UE`), through the API, so the look
 * sweep and the design comparison photograph the same story the mocks tell.
 * Local QA only. Running it twice adds nothing: a name already there is reused,
 * and the entries are only written to a person who has none.
 *
 *   node e2e/moneybook-seed.mjs
 */
import { chromium } from 'playwright';

const base = process.env.E2E_FRONTEND ?? process.env.E2E_BASE ?? 'http://localhost:3005';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local QA only');

const day = (offset) => {
  const d = new Date(Date.now() + 5.5 * 3600e3 - offset * 86400e3);
  return d.toISOString().slice(0, 10);
};
// [name, mobile, [[kind, amount, note, days ago], …]] — the design's I1/I2 people.
const PEOPLE = [
  ['Suresh Jadhav', '9822041178', [['gave', '3000', 'Hand loan', 37], ['gave', '3500', 'Rent share for October', 20], ['got', '2000', 'Paid by UPI', 0]]],
  ['Priya (sister)', '9822041118', [['gave', '1200', 'Mobile recharge', 1]]],
  ['Mahesh Kale', '9822041187', [['got', '2000', 'Bike repair', 3]]],
  ['Anita Pawar', '9822041164', [['gave', '8000', 'Hand loan', 30]]],
  ['Vijay Shinde', '9822041194', [['got', '1500', 'Wedding gift return', 40]]],
  ['Raju (milkman)', '9822041118', [['gave', '600', 'Milk for September', 44], ['got', '600', '', 44]]],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
  const post = async (path, data) => {
    const r = await ctx.request.post(`${base}/api/v1/moneybook/${path}`, {
      data,
      headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-CSRF-Token': csrf },
    });
    return { status: r.status(), body: await r.json().catch(() => null) };
  };
  for (const [name, mobile, entries] of PEOPLE) {
    let made = await post('people', { name, mobile });
    const id = made.status === 201 ? made.body.data.id : made.body?.error?.details?.id;
    if (!id) throw Error(`${name}: ${made.status} ${JSON.stringify(made.body)}`);
    const has = (await (await ctx.request.get(`${base}/api/v1/moneybook/people/${id}/entries`)).json()).meta.total;
    if (has) continue;
    for (const [kind, amount, note, ago] of entries) {
      made = await post(`people/${id}/entries`, { kind, amount, note, entry_date: day(ago) });
      if (made.status !== 201) throw Error(`${name} ${kind} ${amount}: ${made.status} ${JSON.stringify(made.body)}`);
    }
  }
  const book = await (await ctx.request.get(`${base}/api/v1/moneybook/people?page_size=1`)).json();
  console.log('book', JSON.stringify(book.meta.totals));
} finally {
  await browser.close();
}
