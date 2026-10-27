// A4 — remove a line with the bin at one, and Undo (owner, 27 Oct 2026).
// Looked at, measured, and read back from the API, on a phone:
//   · at qty 1 the − is a bin the same size as the stepper's buttons (34 px
//     wide, the stepper 36 px tall), with a 44 px tap area;
//   · above 1 it is − again;
//   · tapping it removes the line and shows "<item> removed · Undo", and the
//     snackbar does not cover the pay buttons;
//   · the real Undo button puts the line back with the same qty and rate, and
//     after the autosave the server has it too;
//   · a double tap on the bin removes one line, not two;
//   · two removals, then Undo: the last one comes back.
// 390 and 320, light and dark, EN and HI.
//   node e2e/a4-remove-undo.mjs   (PW_CHROME, E2E_SHOTS)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4-remove-undo';
mkdirSync(dir, { recursive: true });
const failures = [];
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORDS = {
  en: { remove: (n) => `Remove ${n}`, less: (n) => `One less ${n}`, more: (n) => `One more ${n}`, removed: 'removed', undo: 'Undo' },
  hi: { remove: (n) => `${n} हटाएँ`, less: null, more: null, removed: 'हटाया गया', undo: 'वापस लाएँ' },
};
try {
  for (const locale of ['en', 'hi']) {
    for (const width of [390, 320]) {
      for (const theme of ['light', 'dark']) {
        const tag = `${width}-${theme}-${locale}`;
        const fail = (m) => failures.push(`${tag}: ${m}`);
        // A touch phone: the 44 px tap areas apply to a coarse pointer only.
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: theme, hasTouch: true, isMobile: true });
        await ctx.addCookies([
          { name: 'ub_locale', value: locale, domain: 'localhost', path: '/' },
          { name: 'ub_theme_choice', value: theme, domain: 'localhost', path: '/' },
        ]);
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', (m) => m.type() === 'error' && !/status of 4/.test(m.text()) && errors.push(m.text().slice(0, 160)));
        await page.goto(`${base}/login/email`);
        await page.fill('input[type=email]', 'scale@digikhaato.test');
        await page.fill('input[type=password]', 'Scale-Run-2026!');
        await page.keyboard.press('Enter');
        await page.waitForURL((u) => !u.pathname.startsWith('/login'));
        const api = async (p) => (await (await ctx.request.get(`${base}/api/v1${p}`)).json()).data;
        const items = (await api('/items?page_size=40&ordering=name')).filter((i) => Number(i.selling_price) > 0);
        const [a, b] = [items[2], items[9]];
        await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
        await page.getByRole('combobox').first().waitFor();
        await page.waitForTimeout(800);
        const add = async (name) => {
          await page.getByRole('combobox').first().click();
          await page.keyboard.type(name, { delay: 8 });
          await page.getByRole('option', { name: new RegExp(esc(name)) }).first().click();
          await page.waitForTimeout(400);
          if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        };
        const W = WORDS[locale];
        const lineCount = () => page.locator('[data-testid=invoice-line]').count();
        await add(a.name);
        await add(b.name);

        // Measure the bin against the stepper.
        const bin = page.getByRole('button', { name: W.remove(a.name) });
        if (!(await bin.count())) {
          fail('no bin at qty 1');
          await ctx.close();
          continue;
        }
        const m = await bin.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const group = el.closest('[role=group]').getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // The tap area: points 5 px outside the visible box still land on it.
          const hit = (x, y) => document.elementFromPoint(x, y)?.closest('button') === el;
          const plus = el.parentElement.querySelectorAll('button')[1].getBoundingClientRect();
          return {
            w: Math.round(r.width), h: Math.round(r.height), groupH: Math.round(group.height),
            plusW: Math.round(plus.width),
            hitTall: hit(cx, r.top - 4) && hit(cx, r.bottom + 4),
            colour: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor,
            radius: getComputedStyle(el.closest('[role=group]')).borderTopLeftRadius,
            weight: getComputedStyle(el.closest('[role=group]').querySelector('[aria-live]')).fontWeight,
          };
        });
        if (m.w !== 34 || m.w !== m.plusW) fail(`bin ${m.w}px wide, + is ${m.plusW}px (design 34)`);
        if (m.groupH !== 36) fail(`stepper ${m.groupH}px tall (design 36)`);
        if (!m.hitTall) fail('bin tap area does not reach 44 px');
        if (m.radius !== '8px') fail(`stepper radius ${m.radius} (design .step 8px)`);
        if (m.weight !== '700') fail(`quantity weight ${m.weight} (design .step span 700)`);
        await page.locator('[data-testid=invoice-line]').first().screenshot({ path: `${dir}/${tag}-bin.png` });

        // Above one it is − again.
        if (W.more) {
          await page.getByRole('button', { name: W.more(a.name) }).click();
          if (!(await page.getByRole('button', { name: W.less(a.name) }).count())) fail('at qty 2 there is no −');
          await page.getByRole('button', { name: W.less(a.name) }).click();
        }

        // Double tap the bin: one line goes, not two.
        await bin.dblclick();
        await page.waitForTimeout(500);
        if ((await lineCount()) !== 1) fail(`a double tap on the bin left ${await lineCount()} lines of 2`);
        // The next line moved up under the finger: its bin must not look armed.
        const tint = await page.locator('[data-testid=invoice-line]').first().locator('[role=group] button').evaluateAll((bs) => bs.map((x) => getComputedStyle(x).color));
        if (tint.length === 2 && tint[0] !== tint[1]) fail(`after a removal the next line's bin is ${tint[0]}, its + is ${tint[1]} (sticky hover)`);
        const snack = page.getByRole('status').filter({ hasText: W.removed }).or(page.getByRole('alert').filter({ hasText: W.removed }));
        const shown = await snack.first().innerText().catch(() => '');
        if (!shown.includes(a.name)) fail(`snackbar says "${shown}"`);
        await page.screenshot({ path: `${dir}/${tag}-snackbar.png` });
        // The snackbar must not cover the pay buttons.
        const cover = await page.evaluate(() => {
          const t = document.querySelector('[role=status]')?.closest('div')?.getBoundingClientRect();
          const toast = [...document.querySelectorAll('[role=status] *, [role=alert] *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 20)[0];
          const pay = [...document.querySelectorAll('button')].find((x) => /Paid cash|नकद मिला/.test(x.textContent ?? ''))?.getBoundingClientRect();
          if (!toast || !pay) return null;
          return toast.bottom > pay.top && toast.top < pay.bottom;
        });
        if (cover) fail('the snackbar covers the pay buttons');

        // Undo with the real button.
        await page.getByRole('button', { name: W.undo, exact: true }).click();
        await page.waitForTimeout(600);
        const names = await page.locator('[data-testid=invoice-line] [data-part=name]').allInnerTexts();
        if (!names.includes(a.name)) fail(`Undo did not bring ${a.name} back (lines: ${names.join(', ')})`);
        if (names.indexOf(a.name) !== 0) fail(`Undo put ${a.name} back at position ${names.indexOf(a.name) + 1}, not 1`);
        const rate = await page.locator('[data-testid=invoice-line]').first().locator('[data-part=rate]').innerText();
        if (!rate.includes(Number(a.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })))
          fail(`the restored line's rate reads "${rate}", the item sells at ${a.selling_price}`);

        // The server agrees after the autosave.
        await page.waitForTimeout(4500);
        const id = /invoices\/([0-9a-f-]{36})\/edit/.exec(page.url())?.[1];
        const saved = id ? (await api(`/sales/invoices/${id}`)).lines.map((l) => l.description) : [];
        if (!saved.includes(a.name) || !saved.includes(b.name)) fail(`server has ${JSON.stringify(saved)} after Undo`);

        // Two removals, then Undo: the last one comes back.
        const stepperOf = async (n) => page.locator('[data-testid=invoice-line]').filter({ hasText: n }).locator('[role=group] button').evaluateAll((bs) => bs.map((x) => x.getAttribute('aria-label')));
        if (!(await page.getByRole('button', { name: W.remove(a.name) }).count())) {
          fail(`after Undo and the autosave, ${a.name} has no bin; its stepper reads ${JSON.stringify(await stepperOf(a.name))}, qty "${await page.locator('[data-testid=invoice-line]').filter({ hasText: a.name }).locator('[aria-live]').innerText().catch(() => '?')}"`);
          await page.screenshot({ path: `${dir}/${tag}-after-undo.png` });
          console.log(failures.join('\n'));
          await ctx.close();
          continue;
        }
        await page.getByRole('button', { name: W.remove(a.name) }).click();
        // A deliberate second removal, not the second tap of a double tap
        // (the bin ignores 400 ms after a removal; see InvoiceLinesSection).
        await page.waitForTimeout(600);
        await page.getByRole('button', { name: W.remove(b.name) }).click();
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: W.undo, exact: true }).click();
        await page.waitForTimeout(600);
        const after2 = await page.locator('[data-testid=invoice-line] [data-part=name]').allInnerTexts();
        if (after2.length !== 1 || after2[0] !== b.name) fail(`two removals then Undo left ${JSON.stringify(after2)}, expected [${b.name}]`);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (wide > 0) fail(`page ${wide}px wider than the screen`);
        for (const e of errors) fail(`console: ${e}`);
        console.log(`${tag}: bin ${m.w}×${m.h} in a ${m.groupH}px stepper, + ${m.plusW}px, tap area 44: ${m.hitTall}; snackbar "${shown.replace(/\n/g, ' ')}"; server after Undo ${saved.length} lines`);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS');
process.exitCode = failures.length ? 1 : 0;
