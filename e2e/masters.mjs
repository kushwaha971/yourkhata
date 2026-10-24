/**
 * Revamp §8.5 — Categories and units on the LOCAL QA stack, through the real
 * API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/masters.mjs [--shots=/tmp/e2e-shots/masters]
 *
 *  * LOOKs at /items/masters at 390, 320 and 1280 in English and Hindi, both
 *    sections: no sideways scroll, every text node inside its box, + Add and
 *    the chips ≥ 44 px on a phone, the two panels side by side on a desktop;
 *  * the standard units come first and the shop's own below;
 *  * find → add: a category search that finds nothing offers "Add “…”", the
 *    dialog opens with the name, and the server holds the new category;
 *  * the same name again (other case) is refused as "Already exists" and the
 *    server still holds ONE;
 *  * a unit typed in the search becomes the code, and the server holds it;
 *  * two fast taps on Add category make one row.
 *
 * Local QA tenant only; nothing is sent to anybody.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('input, [role=combobox], .sr-only')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const target = (el) => {
    if (!el) return 0;
    const h = el.getBoundingClientRect().height;
    if (innerWidth > 639) return Math.round(h);
    const a = getComputedStyle(el, '::after');
    const over = -(parseFloat(a.top) || 0) - (parseFloat(a.bottom) || 0);
    return Math.round(h + Math.max(0, over));
  };
  const add = [...document.querySelectorAll('[data-testid^=masters-add-]')].find(
    (b) => b.getBoundingClientRect().width > 0
  );
  const tab = document.querySelector('[role=tab]');
  const cats = document.querySelector('[data-testid=masters-categories]')?.getBoundingClientRect();
  const units = document.querySelector('[data-testid=masters-units]')?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    add: target(add),
    tab: target(tab),
    tabFace: tab ? Math.round(tab.getBoundingClientRect().height) : 0,
    sideBySide: Boolean(cats && units && Math.abs(cats.top - units.top) < 2 && units.left > cats.right),
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const api = `${base}/api/v1`;
  const get = async (path) => (await (await ctx.request.get(`${api}${path}`)).json()).data;
  const allCategories = async () => {
    const rows = await get('/categories');
    return (rows ?? []).flatMap((r) => [r, ...(r.children ?? [])]);
  };
  const stamp = Date.now().toString(36).toUpperCase();

  const open = async () => {
    await page.goto(`${base}/items/masters`);
    await page.getByTestId('masters-categories').or(page.getByTestId('masters-units')).first().waitFor({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
  };

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 780 });
      await open();
      for (const section of width === 1280 ? ['both'] : ['categories', 'units']) {
        if (section === 'units') await page.getByRole('tab').nth(1).click();
        await page.waitForTimeout(250);
        const m = await page.evaluate(measure);
        const tag = `${section} ${width} ${locale}`;
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        if (width < 1280) {
          check(`${tag}: + Add target ≥ 44 px`, m.add >= 44, `${m.add}`);
          check(`${tag}: chip face 32 px, target ≥ 44 px`, m.tabFace === 32 && m.tab >= 44, `${m.tabFace}/${m.tab}`);
        } else {
          check(`${tag}: the two panels sit side by side`, m.sideBySide);
        }
        if (section !== 'categories') {
          const order = await page.evaluate(() => {
            const s = document.querySelector('[data-testid=unit-list-standard]');
            const o = document.querySelector('[data-testid=unit-group-own]');
            return Boolean(s && o && s.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING);
          });
          check(`${tag}: standard units first, the shop's own below`, order);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${section}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- a 60-character search on the narrowest phone ---------- */
  await page.setViewportSize({ width: 320, height: 780 });
  await open();
  await page.getByRole('searchbox', { name: 'Find a category' }).fill('Q'.repeat(30) + ' ' + 'W'.repeat(29));
  const long = await page.evaluate(measure);
  check('a long search that finds nothing fits a 320 px phone', long.overflow <= 0 && long.cut.length === 0, `${long.overflow}px ${long.cut.join(' | ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/no-match-long-320.png` });

  /* ---------- find → add a category (phone) ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await open();
  const name = `QA85 Dry fruits ${stamp}`;
  await page.getByRole('searchbox', { name: 'Find a category' }).fill(name);
  check('a search that finds nothing says so', await page.getByTestId('masters-no-match').isVisible());
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/no-match-390.png` });
  await page.getByTestId('masters-add-named').click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByRole('textbox', { name: /Category name/ });
  check('the dialog opens with the searched name', (await field.inputValue()) === name, await field.inputValue());
  await dialog.getByRole('button', { name: 'Add category' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  let made = (await allCategories()).filter((c) => c.name === name);
  check('the server holds the new category', made.length === 1, `${made.length}`);
  check('the list now shows it', await page.getByTestId('category-list').getByText(name).isVisible());

  /* ---------- the same name again ---------- */
  await page.getByTestId('masters-add-category').click();
  await dialog.getByRole('textbox', { name: /Category name/ }).fill(`  ${name.toUpperCase()} `);
  await dialog.getByRole('button', { name: 'Add category' }).click();
  check('the same name is refused as Already exists', await dialog.getByText('Already exists.').isVisible());
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/exists-390.png` });
  await page.keyboard.press('Escape');
  made = (await allCategories()).filter((c) => c.name.toLowerCase() === name.toLowerCase());
  check('the server still holds ONE', made.length === 1, `${made.length}`);

  /* ---------- two fast taps ---------- */
  const twice = `QA85 Twice ${stamp}`;
  await page.getByTestId('masters-add-category').click();
  await dialog.getByRole('textbox', { name: /Category name/ }).fill(twice);
  /* Two clicks in the same task, before React can disable the button: the
     double tap of a busy counter, which Playwright's own click waits out. */
  await dialog
    .getByRole('button', { name: 'Add category' })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(500);
  const twiceRows = (await allCategories()).filter((c) => c.name === twice);
  check('two fast taps make one category', twiceRows.length === 1, `${twiceRows.length}`);

  /* ---------- find → add a unit ---------- */
  const code = `Q${stamp.slice(-5)}`;
  await page.getByRole('tab').nth(1).click();
  await page.getByRole('searchbox', { name: 'Find a unit' }).fill(code.toLowerCase());
  await page.getByTestId('masters-add-named').click();
  const codeField = dialog.getByRole('textbox', { name: /Code/ });
  check('a short word becomes the unit code', (await codeField.inputValue()) === code, await codeField.inputValue());
  await dialog.getByRole('textbox', { name: /Unit name/ }).fill('QA85 tray');
  await dialog.getByRole('button', { name: 'Add unit' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  const units = await get('/units');
  const unit = (units ?? []).find((u) => u.code === code);
  check('the server holds the new unit', Boolean(unit), unit?.name ?? 'none');
  await page.getByRole('searchbox', { name: 'Find a unit' }).fill('');
  check('it is listed under the shop’s own', await page.getByTestId('unit-list-own').getByText(code).isVisible());

  /* ---------- the standard unit code is refused ---------- */
  await page.getByTestId('masters-add-unit').click();
  await dialog.getByRole('textbox', { name: /Code/ }).fill('nos');
  await dialog.getByRole('textbox', { name: /Unit name/ }).fill('Pieces');
  await dialog.getByRole('button', { name: 'Add unit' }).click();
  check('a standard code is refused as Already exists', await dialog.getByText('Already exists.').isVisible());
  await page.keyboard.press('Escape');
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
