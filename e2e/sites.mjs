/**
 * G7 — a contractor's sites on the LOCAL QA stack, as the hardware kind shop.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/sites.mjs [--shots=/tmp/e2e-shots/sites]
 *
 * New site from the form; a contractor with two sites is asked "Which site?";
 * the bill lands on the chosen site, whose page shows the API's due (self-tested);
 * a payment split on the contractor's page lands on each site's own bills.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).hardware;
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', shop.email);
    await page.fill('input[type=password]', shop.password);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
    const api = async (method, path, data) =>
      (await ctx.request.fetch(`${base}/api/v1${path}`, {
        method, data, headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      })).json();
    const stamp = `${width}${Date.now().toString(36).slice(-4)}`;
    const units = (await api('GET', '/units')).data;
    const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
    const made = await api('POST', '/items', { name: `QA97 Cement ${stamp}`, unit_id: nos, selling_price: '1000', purchase_price: '10', tax_code: 'GST5', opening_stock: { qty: '50', unit_cost: '10' } });
    const item = made.data.item ?? made.data;
    const party = (await api('POST', '/parties', { name: `QA97 Suresh ${stamp}`, mobile: `96${String(Date.now()).slice(-8)}`, type: 'customer' })).data;

    await page.goto(`${base}/sales/sites`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Sites`, (await page.locator('a[href="/sales/sites"]').count()) > 0);
    const add = width < 1024 ? page.getByTestId('page-cta').getByRole('button') : page.getByTestId('site-new');
    await add.click();
    const drawer = page.getByRole('dialog').last();
    await drawer.waitFor();
    await page.getByTestId('site-save').click();
    await page.waitForTimeout(300);
    check(`${width}: an empty form says what is missing`, /Choose the contractor/.test(await drawer.innerText()));
    await drawer.getByRole('combobox').first().click();
    await page.keyboard.type(`QA97 Suresh ${stamp}`);
    await page.getByRole('option', { name: new RegExp(stamp) }).first().click();
    await drawer.getByLabel('Site name').fill(`Patil Bungalow ${stamp}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/new-${width}.png` });
    await page.getByTestId('site-save').click();
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    const listed = (await api('GET', `/sales/sites?party=${party.id}`)).data.sites;
    check(`${width}: the form saves one site`, listed.length === 1 && listed[0].name === `Patil Bungalow ${stamp}`);
    const one = listed[0];

    // One site: the bill form does not ask, and the server takes it.
    await page.goto(`${base}/sales/invoices/new?party=${party.id}&partyName=${encodeURIComponent(party.name)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    check(`${width}: one site is not asked about`, (await page.getByTestId('bill-site').count()) === 0);
    const two = (await api('POST', '/sales/sites', { party_id: party.id, name: `Shinde House ${stamp}`, client_key: crypto.randomUUID() })).data;
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('bill-site').waitFor({ timeout: 10000 });
    check(`${width}: two sites are asked about`, /Which site\?/.test(await page.getByTestId('bill-site').innerText()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-${width}.png`, fullPage: true });

    const bill = async (siteId) => {
      const d = (await api('POST', '/sales/invoices', { party_id: party.id, site_id: siteId, lines: [{ item_id: item.id, qty: '2' }] })).data;
      return (await api('POST', `/sales/invoices/${d.id}/issue`, { version: d.version })).data;
    };
    const b1 = await bill(one.id);
    const b2 = await bill(two.id);
    await page.goto(`${base}/sales/sites/${one.id}`, { waitUntil: 'networkidle' });
    const due = (await page.getByTestId('site-due').innerText()).replace(/[₹,\s]/g, '');
    const api1 = (await api('GET', `/sales/sites/${one.id}`)).data;
    check(`${width}: the site page shows the API's due`, Number(due) === Number(api1.due) && Number(due) === Number(b1.amount_due), `${due} vs ${api1.due}`);
    check(`${width}: self-test — ₹1 more would fail`, Number(due) + 1 !== Number(api1.due));
    const shown = await page.getByTestId('site-bills').innerText();
    check(`${width}: it lists only its own bills`, shown.includes(b1.number) && !shown.includes(b2.number));
    check(`${width}: New bill carries the site`, (await page.getByTestId('site-new-bill').getAttribute('href')).includes(`site=${one.id}`));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-${width}.png`, fullPage: true });
    check(`${width}: one bill reads "1 bill"`, /\b1 bill\b/.test(await page.locator('main').innerText()));
    const row = await page.getByTestId('site-bill').first().boundingBox();
    const card = await page.getByTestId('site-bills').boundingBox();
    const amountEnd = await page.getByTestId('site-bill').first().evaluate((el) => Math.max(...[...el.querySelectorAll('*')].map((n) => n.getBoundingClientRect().right)));
    check(`${width}: the bill row spreads across its card`, amountEnd > card.x + card.width - 40, `${Math.round(amountEnd)} of ${Math.round(card.x + card.width)}, row ${Math.round(row.width)}`);
    check(`${width}: site page has no sideways scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    check(`${width}: no raw message key`, !/\b(common|sales)\.[a-zA-Z.]+/.test(await page.locator('main').innerText()));

    await page.goto(`${base}/sales/sites`, { waitUntil: 'networkidle' });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}.png` });
    check(`${width}: the list has no sideways scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

    // Split on the contractor's page.
    await page.goto(`${base}/parties/${party.id}?book=shop`, { waitUntil: 'networkidle' });
    const panel = page.getByTestId('contractor-sites');
    await panel.waitFor({ timeout: 10000 });
    await panel.getByLabel(`Payment for ${one.name}`).fill('300');
    await panel.getByLabel(`Payment for ${two.name}`).fill('200');
    if (SHOTS) await panel.screenshot({ path: `${SHOTS}/split-${width}.png` });
    await panel.getByRole('radio', { name: 'UPI' }).or(panel.getByRole('button', { name: 'UPI' })).first().click();
    await page.getByTestId('site-pay').dblclick();
    await page.waitForTimeout(2500);
    const a = (await api('GET', `/sales/invoices/${b1.id}`)).data;
    const c = (await api('GET', `/sales/invoices/${b2.id}`)).data;
    check(`${width}: ₹300 landed on the first site once`, Number(b1.amount_due) - Number(a.amount_due) === 300, a.amount_due);
    check(`${width}: ₹200 landed on the second site once`, Number(b2.amount_due) - Number(c.amount_due) === 200, c.amount_due);
    check(`${width}: no page errors`, errors.length === 0, errors[0] ?? '');
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
