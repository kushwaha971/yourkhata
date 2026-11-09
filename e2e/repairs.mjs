/**
 * G5 — a mobile shop's repairs on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/repairs.mjs [--shots=/tmp/e2e-shots/repairs]
 *
 *  * New repair from the form, a walk-in with a mobile: one job, read back;
 *  * a saved customer's job with a ₹500 advance: the advance is a held receipt
 *    and the customer's shop balance moves by exactly ₹500 (self-tested);
 *  * Ready from the job's sheet, then Make bill opens a bill that says it
 *    delivers the job and takes the advance off;
 *  * no sideways scroll at 390 and 1280; the menu has Repairs.
 *
 * Signs in to the mobile kind shop from /tmp/e2e-shots/kind-shops.json.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).mobile;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.click('button[type=submit]');
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
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const mobile = `98${String(Date.now()).slice(-8)}`;

    await page.goto(`${base}/sales/repairs`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Repairs`, (await page.locator('a[href="/sales/repairs"]').count()) > 0);
    const add = width < 1024 ? page.getByTestId('page-cta').getByRole('button') : page.getByTestId('repair-new');
    await add.click();
    const drawer = page.getByRole('dialog').last();
    await drawer.waitFor();
    await drawer.getByLabel('Mobile').fill(mobile);
    await drawer.getByLabel('Phone', { exact: true }).fill(`QA95 Redmi ${stamp}`);
    await drawer.getByLabel('Fault').fill('Screen cracked');
    await drawer.getByRole('button', { name: 'Charger' }).click();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/new-${width}.png`, fullPage: true });
    const words = await drawer.innerText();
    check(`${width}: the form shows no raw message key`, !/\b(common|sales)\.[a-zA-Z.]+/.test(words));
    await page.getByTestId('repair-save').click();
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    const walkIn = (await api('GET', `/sales/repairs?q=${encodeURIComponent(stamp)}`)).data ?? [];
    check(`${width}: the form saves one walk-in job`, walkIn.length === 1 && walkIn[0].walk_in_mobile === mobile && walkIn[0].came_with.includes('charger'), JSON.stringify(walkIn.map((j) => j.number)));
    await page.waitForTimeout(500);
    check(`${width}: the list shows it`, (await page.locator('main').innerText()).includes(`QA95 Redmi ${stamp}`));

    // A saved customer's job with an advance, made through the API the form uses.
    const party = (await api('POST', '/parties', { name: `QA95 Customer ${stamp}`, mobile, type: 'customer' })).data;
    const before = Number((await api('GET', `/parties/${party.id}?book=shop`)).data.shop_balance ?? 0);
    const job = (
      await api('POST', '/sales/repairs', {
        client_key: crypto.randomUUID(),
        party_id: party.id,
        phone_model: `QA95 iPhone ${stamp}`,
        fault: 'Battery',
        estimate: '3200',
        ready_by: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
        advance: '500',
        advance_mode: 'cash',
      })
    ).data;
    const after = Number((await api('GET', `/parties/${party.id}?book=shop`)).data.shop_balance ?? 0);
    check(`${width}: the advance moves the shop balance by exactly ₹500`, Math.abs(before - after - 500) < 0.001, `${before} → ${after}`);
    check(`${width}: self-test — ₹400 would fail`, Math.abs(before - after - 400) >= 0.001);

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(job.number).first().click();
    const sheet = page.getByTestId('repair-actions');
    await sheet.waitFor({ timeout: 10000 });
    await page.getByTestId('repair-ready').click();
    await page.waitForTimeout(800);
    const ready = (await api('GET', `/sales/repairs/${job.id}`)).data;
    check(`${width}: Ready moves the job`, ready.status === 'ready', ready.status);
    await page.getByText(job.number).first().click();
    await page.getByTestId('repair-bill').click();
    await page.waitForURL(/\/sales\/invoices\/new/, { timeout: 15000 });
    await page.getByTestId('bill-repair-note').waitFor({ timeout: 15000 });
    const note = await page.getByTestId('bill-repair-note').innerText();
    check(`${width}: the bill says it delivers the job and takes the advance off`, note.includes(job.number) && note.includes('500'), note);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-${width}.png` });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: no sideways scroll`, over <= 0, `${over}px`);
    await page.goto(`${base}/sales/repairs`, { waitUntil: 'networkidle' });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}.png` });
    const listOver = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: the list does not scroll sideways`, listOver <= 0, `${listOver}px`);
    await ctx.close();
  }
} catch (error) {
  check('harness ran to the end', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
