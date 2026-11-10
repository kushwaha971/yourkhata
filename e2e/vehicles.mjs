/**
 * G8 — an auto parts shop's vehicles and parts that fit, on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/vehicles.mjs [--shots=/tmp/e2e-shots/vehicles] [--hi]
 *
 *  * two bills for "mh 12 kt NNNN" (spaces, small letters) and one for another
 *    number: the vehicle page shows 2 bills and their exact total, read back
 *    from the API (self-tested), and the other vehicle stays apart;
 *  * New bill from the vehicle page opens a bill with the vehicle filled in;
 *  * Parts that fit: "splendor" lists the part with its rack and price and not
 *    the Pulsar one;
 *  * the menu has Vehicles; no raw message key; no sideways scroll at 390 and 1280.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
const HI = process.argv.includes('--hi');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shop = JSON.parse(readFileSync('/tmp/e2e-shots/kind-shops.json', 'utf8')).auto;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const RAW = /\b(common|sales|nav)\.[a-zA-Z]+\.[a-zA-Z.]+/;

const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 860 } });
    if (HI) await ctx.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
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
    const digits = String(Date.now()).slice(-4);
    const plate = `MH12KT${digits}`;
    const units = (await api('GET', '/units')).data;
    const nos = (units.find((u) => u.code === 'NOS') ?? units[0]).id;
    const mkItem = async (name, fits, rack, price) => {
      const made = await api('POST', '/items', { name, unit_id: nos, selling_price: price, purchase_price: '10', tax_code: 'GST18', fits_vehicle: fits, rack, opening_stock: { qty: '9', unit_cost: '10' } });
      return made.data.item ?? made.data;
    };
    const shoe = await mkItem(`QA98 Brake shoe ${stamp}`, `Hero Splendor+ ${stamp}`, 'B-4', '320');
    await mkItem(`QA98 Brake shoe Pulsar ${stamp}`, `Bajaj Pulsar ${stamp}`, 'B-6', '300');
    const party = (await api('POST', '/parties', { name: `QA98 Ramesh ${stamp}`, mobile: `97${String(Date.now()).slice(-8)}`, type: 'customer' })).data;
    const bill = async (vehicle, extra = {}) => {
      const d = (await api('POST', '/sales/invoices', { party_id: party.id, vehicle_number: vehicle, lines: [{ item_id: shoe.id, qty: '1' }], ...extra })).data;
      return (await api('POST', `/sales/invoices/${d.id}/issue`, { version: d.version })).data;
    };
    const one = await bill(`mh 12 kt ${digits}`, { vehicle_model: `Hero Splendor+ ${stamp}`, mechanic: 'Raju Garage' });
    const two = await bill(plate);
    await bill(`MH14ZZ${digits}`);
    const read = (await api('GET', `/sales/vehicles/${plate}`)).data;
    const want = Number(one.grand_total) + Number(two.grand_total);
    check(`${width}: API — two bills, exact total`, read.bills === 2 && Math.abs(Number(read.spent) - want) < 0.001, `${read.bills} · ${read.spent} vs ${want}`);
    check(`${width}: self-test — one ₹ more would fail`, Math.abs(Number(read.spent) - (want + 1)) >= 0.001);

    await page.goto(`${base}/sales/vehicles`, { waitUntil: 'networkidle' });
    check(`${width}: the menu has Vehicles`, (await page.locator('a[href="/sales/vehicles"]').count()) > 0);
    const list = await page.locator('main').innerText();
    check(`${width}: the list shows the vehicle once`, list.split(plate).length - 1 === 1, plate);
    check(`${width}: the list shows no raw key`, !RAW.test(list));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}.png` });
    const listOver = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: the list does not scroll sideways`, listOver <= 0, `${listOver}px`);

    await page.getByText(plate).first().click();
    await page.getByTestId('vehicle-screen').waitFor({ timeout: 15000 });
    const tiles = await page.getByTestId('vehicle-tiles').innerText();
    const grouped = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(want);
    check(`${width}: the page shows 2 bills and the spent`, /\b2\b/.test(tiles) && tiles.includes(grouped), tiles.replace(/\n/g, ' | '));
    check(`${width}: the page lists two bills`, (await page.getByTestId('vehicle-bill').count()) === 2);
    const words = await page.locator('main').innerText();
    check(`${width}: the page names model and mechanic`, words.includes(`Hero Splendor+ ${stamp}`) && words.includes('Raju Garage'));
    check(`${width}: the page shows no raw key`, !RAW.test(words));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/vehicle-${width}.png`, fullPage: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: the vehicle page does not scroll sideways`, over <= 0, `${over}px`);

    await page.getByTestId('vehicle-new-bill').click();
    await page.waitForURL(/\/sales\/invoices\/new/, { timeout: 15000 });
    const fold = page.getByRole('button', { name: HI ? /और जानकारी/ : /More details/ });
    await fold.first().waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(600);
    const foldText = (await fold.count()) ? await fold.first().innerText() : '';
    if (width < 500) check(`${width}: the closed fold names the vehicle`, foldText.includes(plate), foldText.replace(/\n/g, ' '));
    if ((await fold.count()) && (await fold.first().getAttribute('aria-expanded')) === 'false') await fold.first().click();
    const field = page.getByLabel(HI ? 'गाड़ी नंबर' : 'Vehicle no.', { exact: true });
    await field.waitFor({ timeout: 15000 }).catch(async () => {
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/bill-missing-${width}.png`, fullPage: true });
    });
    await page.waitForTimeout(800);
    check(`${width}: New bill comes with the vehicle filled in`, (await field.inputValue()) === plate, await field.inputValue());
    check(`${width}: …and its model`, (await page.getByLabel(HI ? 'कंपनी · मॉडल' : 'Make · model', { exact: true }).inputValue()) === `Hero Splendor+ ${stamp}`);

    await page.goto(`${base}/sales/vehicles/parts`, { waitUntil: 'networkidle' });
    await page.getByTestId('fits-vehicle').fill(`splendor ${stamp}`);
    await page.getByTestId('fits-part').first().waitFor({ timeout: 15000 });
    const parts = await page.getByTestId('fits-parts').innerText();
    check(`${width}: Parts that fit lists the Splendor part with rack and price`, parts.includes(`QA98 Brake shoe ${stamp}`) && parts.includes('B-4') && parts.includes('320'), parts.replace(/\n/g, ' | '));
    check(`${width}: …and not the Pulsar part`, !parts.includes('Pulsar'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/parts-${width}.png` });
    const partsOver = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${width}: Parts that fit does not scroll sideways`, partsOver <= 0, `${partsOver}px`);
    check(`${width}: Parts that fit shows no raw key`, !RAW.test(await page.locator('main').innerText()));
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
