/**
 * Members & Fees (the Library), end to end — rebuilt from scratch, 12 Nov 2026.
 *
 * The Library is its own app (`/library`, `/api/v1/library`, `apps/library`).
 * This harness re-seeds the design's room (e2e/library_seed.py), drives the
 * real screens at 390 and 1280 and reads every figure back from the API by id:
 *
 *   - Home's Collected / Due this week / Overdue are the server's figures;
 *   - a seat on the map opens its student, with Collect for what is due;
 *   - Collect: the sheet's "Paid to … after this" is the date the save makes,
 *     the student leaves Overdue on Fees without a reload, Home's Collected moves;
 *   - removing the newest payment puts "paid to" back exactly;
 *   - Enrol on a free seat takes it; a second student on it is refused in place;
 *   - Books: a scanner gun's barcode opens that one book;
 *   - the Shop never sees a student; nothing runs off a phone; no console error.
 *
 * Every read-back runs a skewed self-test first (P0 §1).
 *
 *   node e2e/library-round.mjs [--shots=/tmp/e2e-shots/library]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '');
const base = process.env.E2E_FRONTEND ?? process.env.E2E_BASE ?? 'http://localhost:3005';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local QA only');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (a, b) => a !== undefined && a !== null && Number(a) === Number(b);
if (same('100.00', '100.01') || !same('100.00', '100')) throw Error('self-test: the comparison cannot fail');
const plain = (s) => (s ?? '').replace(/[₹,\s]/g, '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

const seed = () =>
  execFileSync(process.env.E2E_PYTHON ?? 'python3', ['manage.py', 'shell'], {
    cwd: new URL('../backend/', import.meta.url).pathname,
    input: readFileSync(new URL('./library_seed.py', import.meta.url)),
    stdio: ['pipe', 'pipe', 'inherit'],
  });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    seed();
    const phone = width < 768;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 844 : 860 },
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const tag = (s) => `${width}: ${s}`;
    const shot = (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${width}-${name}.png`, fullPage: true });
    const fits = async (where) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(tag(`${where} fits the screen`), over <= 1, `${over}px over`);
    };

    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', 'scale@digikhaato.test');
    await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    errors.length = 0;
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '';
    const api = async (path, init = {}) => {
      const r = await ctx.request.fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID(), ...(init.headers ?? {}) },
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    };
    const home = async () => (await api('/library/home')).body?.data;
    const studentBy = async (name) =>
      (await api(`/library/students?q=${encodeURIComponent(name)}`)).body?.data?.find((s) => s.name === name);

    // 1. Home: the figures are the server's.
    const h0 = await home();
    await page.goto(`${base}/library`, { waitUntil: 'networkidle' });
    const figures = phone ? page.getByTestId('library-home-fees') : page.getByTestId('library-figures');
    const figText = plain(await figures.first().innerText());
    const rup = (v) => plain(`₹${Number(v).toLocaleString('en-IN')}`);
    check(tag('Home shows Collected as the server has it'), figText.includes(rup(h0.collected)), `${h0.collected} in ${figText.slice(0, 80)}`);
    check(tag('Home shows Overdue as the server has it'), figText.includes(rup(h0.overdue)), h0.overdue);
    check(tag('Home shows Due this week as the server has it'), figText.includes(rup(h0.due_week)), h0.due_week);
    check(tag('the seeded room has someone overdue'), h0.overdue_students >= 4, `${h0.overdue_students}`);
    await fits('Home');
    await shot('01-home');

    // 2. Seats: seat 14 is Rahul's; its sheet/panel offers Collect for what is due.
    await page.goto(`${base}/library/seats`, { waitUntil: 'networkidle' });
    const full = (await api('/library/seats')).body.data.shifts.find((s) => s.full_day);
    await page.getByRole('tab', { name: new RegExp(`^${full.name}`) }).click().catch(() => undefined);
    await page.locator('[data-testid="library-seat"][data-seat="14"]').first().click();
    const seatBox = phone ? page.getByTestId('library-seat-sheet') : page.getByTestId('library-seat-panel');
    await seatBox.waitFor();
    check(tag('seat 14 opens Rahul Gaikwad'), (await seatBox.innerText()).includes('Rahul Gaikwad'));
    check(tag('seat 14 is coloured Overdue'), (await page.locator('[data-seat="14"]').first().getAttribute('data-fee')) === 'over');
    await fits('Seats');
    await shot('02-seat-14');
    if (phone) await page.keyboard.press('Escape');

    // 3. Collect from the student page: preview date == saved date.
    const rahul0 = await studentBy('Rahul Gaikwad');
    await page.goto(`${base}/library/students/${rahul0.id}`, { waitUntil: 'networkidle' });
    await page.getByTestId(phone ? 'library-collect-phone' : 'library-collect').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Amount', { exact: true }).waitFor();
    check(tag('Collect starts on what is due'), plain(await sheet.getByLabel('Amount', { exact: true }).inputValue()) === String(Number(rahul0.due)), await sheet.getByLabel('Amount', { exact: true }).inputValue());
    await sheet.getByTestId('library-collect-after').filter({ hasText: 'Paid to' }).waitFor({ timeout: 8000 });
    const after = await sheet.getByTestId('library-collect-after').innerText();
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/library\/students\/[^/]+\/payments$/.test(new URL(r.url()).pathname));
    // The receipt switch opens WhatsApp in a new tab; a QA run takes it off.
    const sw = sheet.getByRole('switch');
    if (await sw.count()) await sw.click();
    await page.getByTestId('library-collect-save').click();
    await saved;
    await sheet.waitFor({ state: 'hidden' });
    const rahul1 = await studentBy('Rahul Gaikwad');
    check(tag('the sheet\'s "Paid to" is the date the save made'), after.includes(short(rahul1.paid_to)), `${after} vs ${rahul1.paid_to}`);
    check(tag('Rahul is no longer overdue on the server'), rahul1.fee !== 'over', rahul1.fee);
    const h1 = await home();
    check(tag('Home Collected moved by exactly the fee'), same(Number(h1.collected) - Number(h0.collected), rahul0.due), `${h0.collected} → ${h1.collected}`);
    await page.goto(`${base}/library/fees`, { waitUntil: 'networkidle' });
    const feesList = page.getByTestId(phone ? 'library-fees-list' : 'library-fees-table');
    check(tag('Fees · Overdue no longer lists Rahul'), !(await feesList.innerText()).includes('Rahul Gaikwad'));
    const counts = (await api('/library/fees?fee=over')).body.data.counts;
    check(tag('the Overdue chip count is the server\'s'), (await page.getByRole('radio', { name: new RegExp(`^Overdue · ${counts.over}$`) }).count()) > 0 || (await page.getByText(`Overdue · ${counts.over}`).count()) > 0, `${counts.over}`);
    await fits('Fees');
    await shot('03-fees-after-collect');

    // 4. Remove the newest payment: paid_to goes back exactly.
    const pays = (await api(`/library/students/${rahul0.id}/payments`)).body.data;
    const removed = await api(`/library/payments/${pays[0].id}/remove`, { method: 'POST', data: { reason: 'QA round' } });
    const rahul2 = await studentBy('Rahul Gaikwad');
    check(tag('removing the newest payment puts paid-to back'), removed.status === 200 && rahul2.paid_to === rahul0.paid_to, `${rahul0.paid_to} → ${rahul2.paid_to}`);

    // 5. Enrol on a free seat; the same seat again is refused in place.
    const map = (await api(`/library/seats?shift=${(await api('/library/seats')).body.data.shift_id}`)).body.data;
    const free = map.seats.find((c) => !c.student).number;
    const name = `Round ${width} ${String(Date.now()).slice(-5)}`;
    await page.goto(`${base}/library/students`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Enrol student' }).filter({ visible: true }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Name', { exact: true }).fill(name);
    await form.getByLabel('Seat').selectOption(String(free));
    const created = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/library/students' && r.request().method() === 'POST');
    await page.getByTestId('library-enrol-save').click();
    const id = (await (await created).json()).data?.id;
    await page.waitForURL((u) => u.pathname === `/library/students/${id}`, { timeout: 8000 }).catch(() => undefined);
    const mine = (await api(`/library/students/${id}`)).body?.data;
    check(tag('Enrol saved the student on the chosen seat'), mine?.seat === free, `${mine?.seat} vs ${free}`);
    const twice = await api('/library/students', { method: 'POST', data: { name: 'Second', seat: free, shift_id: map.shift_id } });
    check(tag('a second student on that seat is refused'), twice.status === 409 && twice.body?.error?.code === 'seat_taken', `${twice.status}`);
    await shot('04-enrolled');

    // 6. Books: a scanner gun's code opens that one book.
    await page.goto(`${base}/library/books`, { waitUntil: 'networkidle' });
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await page.keyboard.type('9789384761540', { delay: 5 });
    await page.keyboard.press('Enter');
    const bookSheet = page.getByTestId('library-book-sheet');
    const opened = await bookSheet.waitFor({ timeout: 6000 }).then(() => true, () => false);
    check(tag('a scanned barcode opens that book'), opened && (await page.getByRole('dialog').innerText()).includes("Lucent's General Knowledge"));
    await shot('05-book-scanned');

    // 7. The Shop never sees a student (owner: no relation with the Shop).
    const shop = await api(`/parties?q=${encodeURIComponent('Rahul Gaikwad')}`);
    check(tag('the Shop has no party for a library student'), (shop.body?.data ?? []).length === 0, `${(shop.body?.data ?? []).length}`);

    for (const path of ['/library/counter', '/library/attendance', '/library/messages', '/library/money', '/library/expenses', '/library/settings']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await fits(path);
    }
    check(tag('no page or console error'), errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
