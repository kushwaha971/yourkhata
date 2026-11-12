/**
 * Loans & Collections, end to end — rebuilt from scratch, 12 Nov 2026.
 *
 * Re-seeds the design's round (e2e/lending_seed.py), drives the real screens at
 * 390 and 1280 and reads every figure back from the API by id:
 *
 *   - Today's card (collected of due, short) is the server's round;
 *   - Collect on a late stop: the sheet's "After this" is what the save makes,
 *     the stop turns Collected and the round's collected moves by the amount;
 *   - Not paid moves the stop to Not paid with its reason;
 *   - a new loan's schedule is shown before Save and is the one saved;
 *   - Messages · Late lists the late loans with the server's amounts;
 *   - edge cases: extra zeros, more than is left, offline, three fast taps,
 *     a back-dated collection, a long Hindi name, nothing red on open;
 *   - the Shop never sees a borrower; nothing runs off a phone; no console error.
 *
 *   node e2e/lending-round.mjs [--shots=/tmp/e2e-shots/lending]
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
const rup = (v) => plain(`₹${Number(v).toLocaleString('en-IN')}`);

const seed = () =>
  execFileSync(process.env.E2E_PYTHON ?? 'python3', ['manage.py', 'shell'], {
    cwd: new URL('../backend/', import.meta.url).pathname,
    input: readFileSync(new URL('./lending_seed.py', import.meta.url)),
    stdio: ['pipe', 'pipe', 'inherit'],
  });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    seed();
    const phone = width < 768;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
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
    const loanOf = async (name) => (await api(`/lending/loans?q=${encodeURIComponent(name)}`)).body?.data?.[0];
    const round = async () => (await api('/lending/today')).body?.data;

    // 1. Today: the card is the server's round.
    const r0 = await round();
    await page.goto(`${base}/lending`, { waitUntil: 'networkidle' });
    const card = plain(await (phone ? page.getByTestId('lending-round') : page.getByTestId('lending-figures')).innerText());
    check(tag('Today shows collected as the server has it'), card.includes(rup(r0.collected)), `${r0.collected}`);
    check(tag(phone ? 'Today shows the due as the server has it' : 'Today shows still due as the server has it'),
      card.includes(rup(phone ? r0.due : r0.short)), phone ? r0.due : r0.short);
    check(tag('the seeded round has late, due, done and not-paid stops'),
      ['late', 'due', 'done', 'not'].every((s) => r0.stops.some((x) => x.state === s)), r0.stops.map((x) => x.state).join(','));
    await fits('Today');
    await shot('01-today');

    // 2. Collect on Sunil (two days late): "After this" == the save.
    const sunil0 = await loanOf('Sunil');
    await page.goto(`${base}/lending/loans/${sunil0.id}`, { waitUntil: 'networkidle' });
    await page.getByTestId(phone ? 'lending-loan-collect-phone' : 'lending-loan-collect').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Amount', { exact: true }).waitFor();
    check(tag('Collect starts on today + late'), same(plain(await sheet.getByLabel('Amount', { exact: true }).inputValue()), Number(sunil0.due_today) + Number(sunil0.late)));
    await sheet.getByTestId('lending-collect-after').filter({ hasText: 'After this' }).waitFor({ timeout: 8000 });
    const after = await sheet.getByTestId('lending-collect-after').innerText();
    if (await sheet.getByRole('switch').count()) await sheet.getByRole('switch').click();
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/lending\/loans\/[^/]+\/collections$/.test(new URL(r.url()).pathname));
    await page.getByTestId('lending-collect-save').click();
    await saved;
    await sheet.waitFor({ state: 'hidden' });
    const sunil1 = await loanOf('Sunil');
    check(tag('nothing late after collecting today + late'), same(sunil1.late, 0) && same(sunil1.due_today, 0), `${sunil1.late}/${sunil1.due_today}`);
    check(tag('"After this" said the left the save made'), plain(after).includes(rup(sunil1.left)), `${after} vs ${sunil1.left}`);
    const r1 = await round();
    check(tag('the round collected moved by exactly the amount'),
      same(Number(r1.collected) - Number(r0.collected), Number(sunil0.due_today) + Number(sunil0.late)), `${r0.collected} → ${r1.collected}`);
    check(tag('Sunil is Collected in the round'), r1.stops.find((s) => s.borrower === 'Sunil Mane')?.state === 'done');

    // 3. Not paid on Kavita (due today).
    const kavita = await loanOf('Kavita');
    await page.goto(`${base}/lending/loans/${kavita.id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Not paid' }).filter({ visible: true }).first().click();
    await page.getByTestId('lending-not-paid-save').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const k = (await round()).stops.find((s) => s.borrower === 'Kavita Gaikwad');
    check(tag('Not paid moves Kavita to Not paid with the reason'), k?.state === 'not' && k?.reason === 'Shop closed', `${k?.state} ${k?.reason}`);

    // 4. New loan: the schedule before Save is the one saved.
    const kb = (await api('/lending/borrowers?q=Kavita')).body.data[0];
    await page.goto(`${base}/lending/loans/new?borrower=${kb.id}`, { waitUntil: 'networkidle' });
    await page.getByLabel('Amount lent').fill('20000');
    await page.getByLabel('Each day').fill('500');
    const preview = page.waitForResponse((r) => r.url().includes('/lending/loans?preview=true'));
    const pv = await (await preview).json();
    const made = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/lending/loans' && r.request().method() === 'POST' && !r.url().includes('preview'));
    await page.getByTestId('lending-new-loan-save').click();
    const loan = (await (await made).json()).data;
    check(tag('New loan saves the schedule it showed'),
      loan?.schedule?.length === pv.data.schedule.length && loan.schedule.at(-1).due_on === pv.data.last_day, `${loan?.schedule?.length} / ${pv.data.last_day}`);
    await page.waitForURL((u) => u.pathname === `/lending/loans/${loan.id}`, { timeout: 8000 }).catch(() => undefined);
    await shot('02-new-loan-saved');

    // 5. Messages · Late lists the late loans with the server's amounts.
    const late = (await api('/lending/remind?kind=late')).body.data;
    await page.goto(`${base}/lending/messages`, { waitUntil: 'networkidle' });
    const list = plain(await page.getByTestId('lending-remind-list').innerText());
    check(tag('Messages · Late lists every late loan with its amount'), late.every((l) => list.includes(plain(l.borrower)) && list.includes(rup(l.late))), `${late.length}`);
    const preview2 = await page.getByTestId('lending-remind-preview').innerText();
    check(tag('the message is signed by the lender, not the product'), preview2.includes('Shiv Finance') && !/YourKhata/i.test(preview2));
    await fits('Messages');

    // 6. Edge cases.
    const rekha = await loanOf('Rekha');
    const before = (await api(`/lending/loans/${rekha.id}`)).body.data.collections.length;
    const zero = await api(`/lending/loans/${rekha.id}/collections`, { method: 'POST', data: { amount: '99999999999' } });
    check(tag('E7 an extra-zero amount is refused'), zero.status === 400);
    const toomuch = await api(`/lending/loans/${rekha.id}/collections`, { method: 'POST', data: { amount: '9999999' } });
    check(tag('E23 more than is left is refused, naming what is left'), toomuch.status === 409 && toomuch.body?.error?.code === 'more_than_left');
    await page.goto(`${base}/lending/loans/${rekha.id}`, { waitUntil: 'networkidle' });
    await page.getByTestId(phone ? 'lending-loan-collect-phone' : 'lending-loan-collect').click();
    let d = page.getByRole('dialog');
    await d.getByLabel('Amount', { exact: true }).waitFor();
    if (await d.getByRole('switch').count()) await d.getByRole('switch').click();
    // A lone "-" typed mid-amount must not throw (Lending monkey seed 111, 12 Nov).
    const before2 = errors.length;
    await d.getByLabel('Amount', { exact: true }).fill('');
    await d.getByLabel('Amount', { exact: true }).type('-');
    await page.waitForTimeout(600);
    check(tag('typing "-" in the amount throws nothing and keeps the sheet'), errors.length === before2 && (await d.isVisible()), errors.slice(before2).join(' | ').slice(0, 120));
    await d.getByLabel('Amount', { exact: true }).fill('200');
    await ctx.setOffline(true);
    await page.getByTestId('lending-collect-save').click();
    await page.waitForTimeout(1500);
    const kept = await d.isVisible();
    const stored = (await api(`/lending/loans/${rekha.id}`).catch(() => ({ body: null }))).body;
    await ctx.setOffline(false);
    const n1 = (await api(`/lending/loans/${rekha.id}`)).body.data.collections.length;
    check(tag('E4 offline Save keeps the sheet'), kept, `${kept}`);
    await d.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    if (await d.isVisible()) await page.getByTestId('lending-collect-save').click();
    await d.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    const n2 = (await api(`/lending/loans/${rekha.id}`)).body.data.collections.length;
    check(tag('E4 back online it is stored exactly once'), n2 === before + 1 && n1 <= before + 1, `${before} → ${n2}`);
    void stored;
    // E1: three fast taps make one collection (a fresh sheet, Prakash).
    const prakash = await loanOf('Prakash');
    const p0 = (await api(`/lending/loans/${prakash.id}`)).body.data.collections.length;
    await page.goto(`${base}/lending/loans/${prakash.id}`, { waitUntil: 'networkidle' });
    await page.getByTestId(phone ? 'lending-loan-collect-phone' : 'lending-loan-collect').click();
    d = page.getByRole('dialog');
    await d.getByLabel('Amount', { exact: true }).waitFor();
    if (await d.getByRole('switch').count()) await d.getByRole('switch').click();
    const tap = page.getByTestId('lending-collect-save');
    await Promise.all([0, 1, 2].map(() => tap.click({ force: true, timeout: 2000 }).catch(() => undefined)));
    await d.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    check(tag('E1 three fast taps make one collection'), (await api(`/lending/loans/${prakash.id}`)).body.data.collections.length === p0 + 1);
    // E13: a back-dated collection is stored on its own day.
    const anil = await loanOf('Anil');
    const back = await api(`/lending/loans/${anil.id}/collections`, { method: 'POST', data: { amount: '100', collected_on: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10) } });
    const anilRow = (await api(`/lending/loans/${anil.id}`)).body.data.collections.find((c) => c.amount === '100.00') ?? {};
    check(tag('E13 a back-dated collection keeps its day'), back.status === 201 && anilRow.collected_on === new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), anilRow.collected_on);
    // E17: a long Hindi name fits the round and the loan page.
    const route = (await api('/lending/routes')).body.data[0];
    const longB = (await api('/lending/borrowers', { method: 'POST', data: { name: 'श्रीमती राधाकृष्णन वेंकटसुब्रमण्यम पाटिल देशमुख', work: 'बहुत लंबा काम का नाम', route_id: route.id } })).body.data;
    const longL = (await api('/lending/loans', { method: 'POST', data: { borrower_id: longB.id, lent: '1240378', count: 40, each: '31010', starts_on: new Date().toISOString().slice(0, 10) } })).body.data;
    await page.goto(`${base}/lending/loans/${longL.id}`, { waitUntil: 'networkidle' });
    await fits('E17 a long Hindi name on the loan page');
    await page.goto(`${base}/lending`, { waitUntil: 'networkidle' });
    await fits('E17 a long Hindi name in the round');
    // E26: nothing red when a form opens.
    await page.goto(`${base}/lending/borrowers`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add borrower' }).filter({ visible: true }).first().click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).waitFor();
    await page.waitForTimeout(400);
    check(tag('E26 Add borrower opens with no error shown'), (await page.getByRole('dialog').locator('[role=alert], [aria-invalid=true]').count()) === 0);
    // Add borrower with NO mobile saves (H70).
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(`No Mobile ${width}`);
    const bsave = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/lending/borrowers' && r.request().method() === 'POST');
    await page.getByTestId('lending-borrower-save').click();
    check(tag('H70 a borrower with no mobile saves'), (await bsave).status() === 201);

    // 7. The Shop never sees a borrower.
    const shop = await api(`/parties?q=${encodeURIComponent('Sunil Mane')}`);
    check(tag('the Shop has no party for a borrower'), (shop.body?.data ?? []).length === 0);

    for (const path of ['/lending/loans', '/lending/borrowers', '/lending/routes', '/lending/settings', '/lending/loans/new']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await fits(path);
    }
    const real = errors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'));
    check(tag('no page or console error'), real.length === 0, real.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
