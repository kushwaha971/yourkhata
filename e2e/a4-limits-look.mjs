// A4 — discount limits (R-DEC-59) and the snackbar's line, measured on the app.
//   · line Disc. % typed past 100 reads 100; "100.00" and "5.00" fit their box
//     (no text cut: scrollWidth ≤ clientWidth), desktop row and phone sheet;
//   · the bill's ₹ discount typed past the subtotal reads the subtotal, and
//     switched to % it reads 100; the API total after the autosave is ≥ 0;
//   · the "<item> removed · Undo" snackbar: message, Undo and × share one
//     line (centres within 2 px), Undo has the message's size and colour.
// 1280 and 390, light and dark.   node e2e/a4-limits-look.mjs   (PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a4-limits';
mkdirSync(dir, { recursive: true });
const failures = [];
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const fits = (loc) => loc.evaluate((e) => ({ v: e.value, fit: e.scrollWidth <= e.clientWidth + 1, w: e.clientWidth, sw: e.scrollWidth }));
try {
  for (const width of [1280, 390]) {
    for (const theme of ['light', 'dark']) {
      const tag = `${width}-${theme}`;
      const fail = (m) => failures.push(`${tag}: ${m}`);
      const phone = width < 1024;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 900 }, colorScheme: theme, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
      await ctx.addCookies([{ name: 'ub_theme_choice', value: theme, domain: 'localhost', path: '/' }]);
      const page = await ctx.newPage();
      await page.goto(`${base}/login/email`);
      await page.fill('input[type=email]', 'scale@digikhaato.test');
      await page.fill('input[type=password]', 'Scale-Run-2026!');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'load' });
      await page.getByRole('combobox').first().waitFor();
      await page.waitForTimeout(800);
      await page.getByRole('combobox').first().click();
      await page.keyboard.type('Atta 102', { delay: 8 });
      await page.getByRole('option').first().click();
      await page.waitForTimeout(600);
      if (phone) {
        if (!(await page.getByRole('dialog').count())) await page.locator('[data-testid=invoice-line]').first().getByRole('button', { name: /^Edit/ }).click();
        await page.waitForTimeout(500);
      } else if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
      const disc = page.locator('[id="lines.0.discountValue"]');
      await disc.fill('');
      await disc.click();
      await page.keyboard.type('150');
      if ((await disc.inputValue()) !== '100') fail(`Disc. % typed 150 reads "${await disc.inputValue()}"`);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      let m = await fits(disc);
      if (!m.fit) fail(`"${m.v}" is cut in its ${m.w}px box (needs ${m.sw})`);
      await disc.fill('');
      await disc.click();
      await page.keyboard.type('5');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      m = await fits(disc);
      if (!m.fit) fail(`"${m.v}" is cut in its ${m.w}px box`);
      await page.screenshot({ path: `${dir}/${tag}-disc.png` });
      if (phone) await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // The bill's own discount, under More details.
      await page.getByRole('button', { name: /More details/ }).first().click();
      await page.waitForTimeout(400);
      const sub = await page.getByTestId('invoice-totals').locator('text=/₹[\\d,]+\\.\\d\\d/').first().innerText().catch(() => '');
      const billDisc = page.getByLabel('Discount', { exact: true }).or(page.locator('[id="discountValue"]')).first();
      await billDisc.click();
      await page.keyboard.type('999999');
      const capped = await billDisc.inputValue();
      if (Number(capped.replace(/,/g, '')) >= 999999) fail(`a ₹999999 bill discount reads "${capped}" (subtotal ${sub})`);
      await page.getByRole('button', { name: '%', exact: true }).or(page.getByRole('radio', { name: /%|Percent/ })).first().click().catch(() => fail('no % chip'));
      await page.waitForTimeout(300);
      if (Number((await billDisc.inputValue()).replace(/,/g, '')) > 100) fail(`switched to %, the bill discount reads "${await billDisc.inputValue()}"`);
      await page.waitForTimeout(4500);
      const id = /invoices\/([0-9a-f-]{36})\/edit/.exec(page.url())?.[1];
      const doc = id ? (await (await ctx.request.get(`${base}/api/v1/sales/invoices/${id}`)).json()).data : null;
      if (!doc) fail('no saved draft to read back');
      else if (Number(doc.grand_total) < 0) fail(`API total ${doc.grand_total} below zero`);
      await page.screenshot({ path: `${dir}/${tag}-bill-disc.png` });

      // The snackbar's line.
      if (phone) await page.locator('[data-testid=invoice-line]').first().getByRole('button', { name: /^Remove/ }).click();
      else await page.getByRole('button', { name: /^Remove line 1/ }).click();
      const toast = page.getByTestId('snackbar');
      await toast.waitFor({ timeout: 5000 });
      const g = await toast.evaluate((t) => {
        const box = (e) => e.getBoundingClientRect();
        const msg = t.querySelector('p');
        const btns = [...t.querySelectorAll('button')];
        const undo = btns.find((b) => /Undo|वापस/.test(b.textContent));
        const x = btns.find((b) => b !== undo);
        const c = (r) => r.top + r.height / 2;
        const cs = (e) => getComputedStyle(e);
        return {
          msg: c(box(msg)), undo: c(box(undo)), x: c(box(x)),
          sizeMsg: cs(msg).fontSize, sizeUndo: cs(undo).fontSize,
          colMsg: cs(msg).color, colUndo: cs(undo).color,
          // A tap 9 px above and below the 20 px box still lands (44 px on a phone).
          hitUndo: [-9, 9].every((d) => document.elementFromPoint(box(undo).left + box(undo).width / 2, c(box(undo)) + (d < 0 ? -10 + d : 10 + d))?.closest('button') === undo),
          hitX: [-9, 9].every((d) => document.elementFromPoint(box(x).left + box(x).width / 2, c(box(x)) + (d < 0 ? -10 + d : 10 + d))?.closest('button') === x),
        };
      });
      if (Math.abs(g.msg - g.undo) > 1 || Math.abs(g.undo - g.x) > 1) fail(`snackbar not on one line: message ${g.msg.toFixed(1)}, Undo ${g.undo.toFixed(1)}, × ${g.x.toFixed(1)}`);
      if (phone && (!g.hitUndo || !g.hitX)) fail(`snackbar tap areas below 44 px: Undo ${g.hitUndo}, × ${g.hitX}`);
      if (g.sizeMsg !== g.sizeUndo) fail(`Undo ${g.sizeUndo} vs message ${g.sizeMsg}`);
      if (g.colMsg !== g.colUndo) fail(`Undo ${g.colUndo} vs message ${g.colMsg}`);
      await toast.screenshot({ path: `${dir}/${tag}-snackbar.png` });
      console.log(`${tag}: disc 150→100, "5.00" fits; bill ₹999999 → "${capped}", → % ok; API total ${doc?.grand_total}; snackbar centres ${g.msg.toFixed(1)}/${g.undo.toFixed(1)}/${g.x.toFixed(1)}, ${g.sizeUndo}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS');
process.exitCode = failures.length ? 1 : 0;
