/**
 * The owner's 12 Nov additions to Lending, checked on screen and read back from
 * the API, at 390 and 1280, with a screenshot of each:
 *   1. Add borrower: "Choose from phone contacts" fills name and mobile where the
 *      browser can pick contacts (stubbed here as Chrome on Android does), and
 *      draws nothing where it cannot (desktop).
 *   2. ₹0 on Collect: Save says "visited, paid nothing"; no collection is stored,
 *      the stop turns Not paid, late and left do not move.
 *   3. A loan started two days ago: late on entry; Collect's calendar stops at
 *      the start day; a collection before it is refused; past days clear late.
 *
 *   node e2e/lending-new-checks.mjs --shots=/tmp/e2e-shots/lending-new
 * Run after `manage.py shell < e2e/lending_seed.py`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/lending-new');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
mkdirSync(SHOTS, { recursive: true });
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
// The LOCAL day, not UTC: before 05:30 IST toISOString() is still yesterday,
// which made "two days ago" three and the loan ₹500 later than expected.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 1280]) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  if (phone) {
    // Chrome on Android's contact picker, answering with one chosen contact.
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'contacts', {
        configurable: true,
        value: { select: async () => [{ name: ['Ramesh  Patil'], tel: ['+91 98765 43210'] }] },
      });
      window.ContactsManager = function ContactsManager() {};
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const api = async (path) => (await (await ctx.request.get(`${base}/api/v1/lending/${path}`)).json()).data;

  // 1. Phone contacts on Add borrower.
  await page.goto(`${base}/lending/borrowers`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add borrower' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').waitFor();
  const pick = dialog.getByRole('button', { name: 'Choose from phone contacts' });
  if (phone) {
    check(await pick.isVisible(), `${width}: Add borrower shows "Choose from phone contacts"`);
    await pick.click();
    await page.waitForTimeout(400);
    check((await dialog.getByLabel('Name').inputValue()) === 'Ramesh Patil', `${width}: the contact's name filled in`);
    check((await dialog.locator('input[type=tel]').first().inputValue()).replace(/\D/g, '').endsWith('9876543210'), `${width}: the contact's mobile filled in`);
  } else {
    check((await pick.count()) === 0, `${width}: no contacts button where the browser cannot pick contacts`);
  }
  await page.screenshot({ path: `${SHOTS}/${width}-borrower-contacts.png` });
  await page.keyboard.press('Escape');

  // 2. ₹0 on Collect (Kavita: due today, nothing late).
  const kavita = (await api('loans?q=Kavita'))[0];
  const before = await api(`loans/${kavita.id}`);
  await page.goto(`${base}/lending/loans/${kavita.id}`, { waitUntil: 'networkidle' });
  await page.getByTestId(phone ? 'lending-loan-collect-phone' : 'lending-loan-collect').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Amount').fill('0');
  await page.waitForTimeout(400);
  const save = sheet.getByTestId('lending-collect-save');
  check((await save.innerText()).includes('visited, paid nothing'), `${width}: Save reads "visited, paid nothing" at ₹0`);
  check((await sheet.getByText('Share receipt on WhatsApp').count()) === 0, `${width}: no WhatsApp receipt at ₹0`);
  await page.screenshot({ path: `${SHOTS}/${width}-collect-zero.png` });
  await save.click();
  await page.getByText(/nothing paid/).first().waitFor();
  const after = await api(`loans/${kavita.id}`);
  const todayIso = (await api('today')).day ?? null;
  check(after.collections.length === before.collections.length, `${width}: ₹0 stored no collection`);
  check(after.late === before.late && after.left === before.left, `${width}: late and left did not move (${after.late}, ${after.left})`);
  const stop = (await api('today')).stops.find((s) => s.loan_id === kavita.id || s.id === kavita.id || s.borrower === 'Kavita Gaikwad');
  check(stop?.state === 'not', `${width}: the round shows Kavita Not paid`);
  await page.screenshot({ path: `${SHOTS}/${width}-collect-zero-saved.png` });

  // 3. A loan started two days ago, entered today.
  const start = new Date();
  start.setDate(start.getDate() - (new Date().getDay() === 1 ? 3 : 2)); // two collection days back, Sunday skipped
  const ganesh = (await api('borrowers?q=Ganesh'))[0];
  const created = await ctx.request.post(`${base}/api/v1/lending/loans`, {
    headers: { 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': `new-checks-${width}-${Date.now()}` },
    data: { borrower_id: ganesh.id, lent: '10000', frequency: 'daily', count: 20, each: '500', starts_on: iso(start) },
  });
  const body = await created.json();
  if (!body.data) throw new Error(`new loan refused: ${created.status()} ${JSON.stringify(body)}`);
  const loan = body.data;
  const fresh = await api(`loans/${loan.id}`);
  check(fresh.late === '1000.00', `${width}: back-dated loan is ₹1,000 late on entry (${fresh.late})`);
  await page.goto(`${base}/lending/loans/${loan.id}`, { waitUntil: 'networkidle' });
  await page.getByTestId(phone ? 'lending-loan-collect-phone' : 'lending-loan-collect').click();
  await sheet.getByTestId('lending-collect-change-date').click();
  await sheet.getByLabel('Collected on').click();
  const dayBefore = new Date(start);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const cell = (d) => page.locator(`[data-day="${iso(d)}"] button`);
  await cell(start).waitFor();
  check(
    (await cell(dayBefore).isDisabled()) && !(await cell(start).isDisabled()),
    `${width}: Collect's calendar starts at the loan's first day (${iso(start)} open, ${iso(dayBefore)} shut)`
  );
  await page.screenshot({ path: `${SHOTS}/${width}-collect-backdate.png` });
  await page.keyboard.press('Escape');
  const early = new Date(start);
  early.setDate(early.getDate() - 1);
  const refused = await ctx.request.post(`${base}/api/v1/lending/loans/${loan.id}/collections`, {
    headers: { 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': `early-${width}-${Date.now()}` },
    data: { amount: '500', collected_on: iso(early) },
  });
  check(refused.status() === 400, `${width}: a collection before the start day is refused (${refused.status()})`);
  for (const d of fresh.schedule.filter((r) => r.state === "late").map((r) => r.due_on)) {
    await ctx.request.post(`${base}/api/v1/lending/loans/${loan.id}/collections`, {
      headers: { 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '', 'Idempotency-Key': `past-${width}-${d}-${Date.now()}` },
      data: { amount: '500', collected_on: d },
    });
  }
  const caught = await api(`loans/${loan.id}`);
  check(caught.late === '0.00' && caught.left === '9000.00', `${width}: past days collected, nothing late, ₹9,000 left (${caught.late}, ${caught.left})`);
  await page.goto(`${base}/lending/loans/${loan.id}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/${width}-backdated-loan.png`, fullPage: true });
  check(errors.length === 0, `${width}: no page error${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
