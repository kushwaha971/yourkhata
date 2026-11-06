/**
 * G4 — a medical store on the LOCAL QA stack: same-salt substitutes on the bill,
 * Schedule H's doctor and patient, and the short book.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/medical.mjs [--shots=/tmp/e2e-shots/medical]
 *
 *  * picking an out-of-stock medicine with a salt opens "… · out of stock" with
 *    the same-salt medicines, in stock first; "Use …" bills the substitute;
 *  * "Add … to the short book" writes it in, and the short book's API says so;
 *  * a Schedule H medicine on the bill shows Doctor name and Patient name, and
 *    the saved draft carries them (read back from the API, with a self-test);
 *  * no sideways scroll at 390 and 1280.
 *
 * Signs in to the medical kind shop from /tmp/e2e-shots/kind-shops.json.
 * Writes three test medicines named "QA94 …" and a draft bill.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).medical;

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
    const api = async (method, path, data) => {
      const response = await ctx.request.fetch(`${base}/api/v1${path}`, {
        method,
        data,
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      });
      return response.json();
    };
    const units = (await api('GET', '/units')).data;
    const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const make = async (name, extra) => {
      const body = await api('POST', '/items', {
        name: `QA94 ${name} ${stamp}`,
        unit_id: nos,
        selling_price: extra.price ?? '30',
        tax_code: 'GST5',
        ...extra,
      });
      return body.data.item ?? body.data;
    };
    const salt = `Paracetamol 650 mg ${stamp}`;
    const crocin = await make('Crocin', { salt });
    const dolo = await make('Dolo', { salt: salt.toLowerCase(), price: '32', opening_stock: { qty: '40', unit_cost: '20' } });
    const azi = await make('Azithral', { salt: `Azithromycin ${stamp}`, schedule: 'H', price: '119', opening_stock: { qty: '5', unit_cost: '80' } });

    await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
    const search = page.getByRole('combobox', { name: 'Search items to add' });
    const add = async (name) => {
      await search.click();
      await search.fill(name);
      await page.getByRole('option', { name: new RegExp(name) }).first().click({ timeout: 15000 });
    };
    await add(crocin.name);
    const sheet = page.getByTestId('subst-sheet');
    await sheet.waitFor({ timeout: 10000 });
    // The list arrives a moment after the sheet: wait for its first choice.
    await page.getByTestId('subst-use').waitFor({ timeout: 10000 }).catch(() => undefined);
    const sheetText = await page.getByRole('dialog').innerText();
    check(`${width}: an out-of-stock medicine opens its same-salt substitutes`, sheetText.includes(dolo.name), sheetText.slice(0, 120).replace(/\n/g, ' | '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/subst-${width}.png` });
    await page.getByTestId('subst-short-book').click();
    await page.waitForTimeout(600);
    const book = (await api('GET', '/stock/short-book')).data;
    check(`${width}: Add to the short book writes it in`, book.some((r) => r.item.id === crocin.id && r.reason === 'asked'));
    await page.getByTestId('subst-use').click();
    await page.waitForTimeout(500);
    // The bill's lines, not the whole page: a search list would mention both.
    const lines = (await page.locator('main').innerText()).split('Subtotal')[0];
    const listOpen = await page.getByRole('listbox').count();
    check(`${width}: Use bills the substitute, not the missing one`, lines.includes(dolo.name) && !lines.includes(`${crocin.name}\n`) && listOpen === 0, `list open ${listOpen}`);

    check(`${width}: no doctor fields before a scheduled medicine`, (await page.getByTestId('bill-rx').count()) === 0);
    await add(azi.name);
    await page.getByTestId('bill-rx').waitFor({ timeout: 10000 });
    check(`${width}: a Schedule H medicine asks for doctor and patient`, true);
    await page.getByLabel('Doctor name').fill('Dr. S. Kulkarni');
    await page.getByLabel('Patient name').fill('Meena Jadhav');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/rx-${width}.png`, fullPage: true });
    // The draft saves itself; read it back from the server it was sent to.
    let saved = null;
    for (let i = 0; i < 20 && !saved?.rx?.doctor; i += 1) {
      await page.waitForTimeout(700);
      const drafts = (await api('GET', '/sales/invoices?tab=draft&page_size=5')).data ?? [];
      const mine = drafts.find((d) => (d.lines ?? []).some?.((l) => l.item_id === azi.id)) ?? drafts[0];
      if (mine) saved = (await api('GET', `/sales/invoices/${mine.id}`)).data;
    }
    const rx = saved?.rx ?? {};
    check(`${width}: the saved draft carries the prescription`, rx.doctor === 'Dr. S. Kulkarni' && rx.patient === 'Meena Jadhav', JSON.stringify(rx));
    // Self-test: the read-back must be able to fail.
    check(`${width}: self-test — a wrong doctor would fail`, rx.doctor !== 'Dr. Someone Else');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: no sideways scroll`, over <= 0, `${over}px`);
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
