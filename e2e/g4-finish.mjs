// Jewellery's last pieces, on the live stack: Settings' making, wastage and PAN
// figures read back and used by the tag form, the karigar form and the bill; tola
// beside grams; "make another" on a lot. `--skew` must fail. Then every jewellery
// screen is measured at 390/320/1280, light and dark, English and Hindi.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = `${base}/api/v1`;
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/g4';
mkdirSync(dir, { recursive: true });
const run = Date.now().toString(36).toUpperCase().slice(-5);
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${d ? ` — ${d}` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
let errs = 0;
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) { errs += 1; console.log('  console:', m.text().slice(0, 160)); } });
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'qa-jeweller@adcert.test');
await page.fill('input[type=password]', 'AdCert-Test-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
const hdr = async () => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' });
const get = async (p) => (await (await ctx.request.get(`${api}${p}`)).json()).data;
const post = async (p, data) => (await (await ctx.request.post(`${api}${p}`, { headers: await hdr(), data })).json()).data;

await page.goto(`${base}/settings/shop-features`);
const panel = page.getByTestId('jewel-defaults');
await panel.waitFor({ timeout: 15000 });
await panel.getByLabel('Making default').fill('12');
await panel.getByLabel('Wastage default').fill('2');
await panel.getByLabel('Wastage limit').fill('1.5');
await panel.getByLabel('PAN limit').fill('50000');
await panel.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(1500);
const rates = await get('/metal-rates/today');
check('Settings read back', rates?.defaults?.making_value === (skew ? '13.00' : '12.00') && rates.defaults.pan_limit === '50000.00', JSON.stringify(rates?.defaults));
await page.reload();
await panel.waitFor();
check('Settings survive a reload', (await panel.getByLabel('PAN limit').inputValue()).replace(/[,.]00$|,/g, '').startsWith('50000'));
await page.screenshot({ path: `${dir}/settings-1280.png`, fullPage: true });

await page.goto(`${base}/sales/custom-orders`);
await page.getByTestId('custom-orders').waitFor();
const name = `Mohan ${run}`;
const addBtn = page.getByRole('button', { name: /add karigar/i }).first();
await addBtn.click();
let d = page.getByRole('dialog');
await page.waitForTimeout(900);
check('a new karigar starts from the wastage limit', (await d.locator('input').nth(1).inputValue()).startsWith('1.5'));
await d.locator('input').first().fill(name);
await page.getByTestId('karigar-save').click();
await d.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
const kar = (await post('/sales/karigars', { name: `${name} B`, wastage_limit_pct: '1.5' }));
const lot = await post(`/sales/karigars/${kar.id}/issue`, { weight_g: '40', purity: 'gold_22k', client_key: `g4-${run}` });
await post(`/sales/karigar-lots/${lot.id}/receive`, { received_g: '39.6' });
await page.reload();
const row = page.getByTestId('karigar-to-tag').filter({ hasText: `${name} B` });
await row.getByRole('button', { name: 'Make tag' }).click();
d = page.getByRole('dialog');
await d.getByLabel('Gross').waitFor();
await page.waitForTimeout(900);
check('a new tag starts from the making default', (await d.getByLabel('Making', { exact: true }).locator('visible=true').first().inputValue()).startsWith('12'));
await d.getByLabel('Gross').fill('11.664');
await page.waitForTimeout(200);
check('tola shows beside grams', (await page.getByTestId('tag-tola').textContent())?.includes('1.000'));
await page.screenshot({ path: `${dir}/make-tag-1280.png` });
const items = (await (await ctx.request.get(`${api}/items?page_size=50`)).json()).data ?? [];
const item = items.find((i) => i.tracking === 'serial');
await d.getByRole('combobox').first().click().catch(() => undefined);
await page.keyboard.type(item.name.slice(0, 6));
await page.waitForTimeout(900);
await page.getByRole('option').first().click().catch(async () => { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); });
const t1 = `G4${run}A`;
await d.getByLabel('Tag no').fill(t1);
await page.getByTestId('karigar-save').click();
await page.getByTestId('make-another').waitFor({ timeout: 10000 });
check('after a tag: make another or print', (await page.getByTestId('tags-made').textContent())?.includes(t1));
await page.screenshot({ path: `${dir}/tag-made-1280.png` });
await page.getByTestId('make-another').click();
await d.getByLabel('Tag no').fill(`G4${run}B`);
check('the next piece starts blank but keeps the making', (await d.getByLabel('Gross').inputValue()) === '' && (await d.getByLabel('Making', { exact: true }).locator('visible=true').first().inputValue()).startsWith('12'));
await d.getByLabel('Gross').fill('10');
await page.getByTestId('karigar-save').click();
await page.getByTestId('make-another').waitFor({ timeout: 10000 });
check('two tags in one go', (await page.getByTestId('tags-made').textContent())?.includes(`G4${run}B`));
// Old gold over the bill, paid in cash, read back from the cashbook's own rows.
await page.goto(`${base}/sales/custom-orders?view=karigars`);
await page.getByTestId('karigars').waitFor();
await page.waitForTimeout(800);
check('the menu Karigars row lands on the panel', await page.getByTestId('karigars').evaluate((e) => e.getBoundingClientRect().top < innerHeight));
await page.goto(`${base}/sales/custom-orders`);
await page.getByTestId('custom-order-more').first().waitFor().catch(() => undefined);
check('a desktop order row is one line', (await page.locator('tbody tr').first().evaluate((e) => e.getBoundingClientRect().height)) <= 72);
// Back to the design's figure, and blanks for the next run.
await page.goto(`${base}/settings/shop-features`);
await panel.waitFor();
await panel.getByLabel('Making default').fill('');
await panel.getByLabel('Wastage default').fill('');
await panel.getByLabel('Wastage limit').fill('');
await panel.getByLabel('PAN limit').fill('200000');
await panel.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(1200);

// Every jewellery screen: sizes, themes, languages.
const SCREENS = ['/stock/rates', '/sales/custom-orders', '/sales/old-gold', '/items/labels', '/settings/shop-features', '/home'];
for (const [w, h] of [[390, 844], [320, 640], [1280, 860]]) for (const scheme of ['light', 'dark']) for (const lang of ['en', 'hi']) {
  const c2 = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, storageState: await ctx.storageState(), locale: lang === 'hi' ? 'hi-IN' : 'en-IN' });
  await c2.addInitScript(([l, s]) => { try { localStorage.setItem('ub_locale', l); localStorage.setItem('ub_theme', s); document.cookie = `ub_locale=${l};path=/`; } catch {} }, [lang, scheme]);
  const p = await c2.newPage();
  for (const path of SCREENS) {
    await p.goto(`${base}${path}`);
    await p.waitForTimeout(1300);
    const m = await p.evaluate(() => {
      const over = document.documentElement.scrollWidth - innerWidth;
      const clipped = [...document.querySelectorAll('main button,main a,main h1,main h2,main th,main label')].filter((e) => { const s = getComputedStyle(e); return e.offsetParent && e.scrollWidth > e.clientWidth + 1 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis' && e.clientWidth > 0 && e.tagName !== 'TD'; }).map((e) => e.textContent.trim().slice(0, 24));
      const small = innerWidth < 768 ? [...document.querySelectorAll('main button, main a')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 28 && !['switch','checkbox'].includes(e.getAttribute('role')) && getComputedStyle(e,'::after').content === 'none' && getComputedStyle(e,'::before').content === 'none'; }).map((e) => e.textContent.trim().slice(0, 20)) : [];
      const raw = (document.body.innerText.match(/\b(?:nav|items|sales|stock|settings|common|purchases)\.[a-zA-Z.]+\b/g) ?? []).filter((x) => !/adcert|digikhaato/.test(x));
      return { over, clipped: [...clipped.slice(0, 3), ...raw.slice(0, 3)], small: small.slice(0, 3) };
    });
    check(`${path} ${w} ${scheme} ${lang}`, m.over <= 0 && !m.clipped.length && !m.small.length, m.over > 0 || m.clipped.length || m.small.length ? JSON.stringify(m) : '');
    if (lang === 'en' && scheme === 'light' || (lang === 'hi' && scheme === 'dark')) await p.screenshot({ path: `${dir}/${path.replace(/\//g, '_')}-${w}-${scheme}-${lang}.png` });
  }
  await c2.close();
}
check('no console errors', errs === 0, String(errs));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
