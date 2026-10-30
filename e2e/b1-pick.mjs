// B1 — "What do you sell?" tiles, measured against the design's `.tiles` /
// `.tile` / `.tile.on` (docs/performance/2026-10-28-shop-b1-pick-what-you-sell.md).
//
// Signs in ONCE (the per-IP sign-in budget is 20) and reuses the session for
// every width, theme and locale. Opens the wizard's type step, picks a tile and
// MEASURES what the design states: columns, tile height, radius, padding,
// border, icon size, type sizes, and that nothing is cut or wider than the page.
//
//   node e2e/b1-pick.mjs [--tag=now] [--width=390,320,1024,1280]   (E2E_BASE, PW_CHROME)
//
// Screenshots: /tmp/e2e-shots/b1/<tag>-<width>-<theme>-<locale>.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const tag = arg('tag', 'now');
const widths = arg('width', '390,320,1024,1280').split(',').map(Number);
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/b1';
mkdirSync(dir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Runs in the page: the design's numbers, read from the rendered tiles. */
const measure = () => {
  const group = document.querySelector('[role=radiogroup]');
  if (!group) return null;
  const tiles = [...group.querySelectorAll('[role=radio]')];
  const R = (e) => e.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const tops = [...new Set(tiles.map((t) => Math.round(R(t).top)))];
  const firstRow = tiles.filter((t) => Math.round(R(t).top) === tops[0]).length;
  const on = tiles.find((t) => t.getAttribute('aria-checked') === 'true');
  const off = tiles.find((t) => t.getAttribute('aria-checked') !== 'true');
  const tileInfo = (t) => {
    if (!t) return null;
    const s = cs(t);
    const svg = t.querySelector('svg');
    const spans = [...t.querySelectorAll('span')];
    return {
      h: Math.round(R(t).height),
      radius: s.borderTopLeftRadius,
      border: s.borderTopWidth,
      borderStyle: s.borderTopStyle,
      padding: `${s.paddingTop} ${s.paddingRight}`,
      icon: svg ? Math.round(R(svg).width) : 0,
      name: spans[0] ? `${cs(spans[0]).fontSize}/${cs(spans[0]).fontWeight}` : '',
      hint: spans[1] ? `${cs(spans[1]).fontSize}/${cs(spans[1]).fontWeight}` : '',
      bg: s.backgroundColor,
      color: spans[0] ? cs(spans[0]).color : '',
      align: s.textAlign,
    };
  };
  const gapX = tiles.length > 1 && Math.round(R(tiles[1]).top) === Math.round(R(tiles[0]).top)
    ? Math.round(R(tiles[1]).left - R(tiles[0]).right) : null;
  const cut = [...group.querySelectorAll('span')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
    .map((e) => e.textContent.trim().slice(0, 30));
  const minTarget = Math.min(...tiles.map((t) => Math.min(R(t).width, R(t).height)));
  return {
    count: tiles.length,
    columns: firstRow,
    gapX,
    on: tileInfo(on),
    off: tileInfo(off),
    cut,
    minTarget: Math.round(minTarget),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    labels: tiles.map((t) => t.textContent.trim()),
  };
};

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
// One sign-in, reused everywhere.
const first = await browser.newContext();
{
  const page = await first.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}
const storageState = await first.storageState();
await first.close();

const out = {};
for (const width of widths) {
  for (const theme of ['light', 'dark']) {
    for (const locale of ['en', 'hi']) {
      const key = `${width}-${theme}-${locale}`;
      const ctx = await browser.newContext({
        storageState,
        viewport: { width, height: width < 1024 ? 860 : 900 },
        colorScheme: theme,
        isMobile: width < 1024,
        hasTouch: width < 1024,
      });
      // ub_theme_choice is what picks the theme; colorScheme alone drew every
      // "dark" case light (B-thread, 30 Oct 2026).
      await ctx.addCookies([
        { name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' },
        { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' },
      ]);
      const page = await ctx.newPage();
      try {
        await page.goto(`${base}/onboarding/step/1`, { waitUntil: 'networkidle' });
        // The type tiles show only once the Shop is ticked.
        if (!(await page.locator('[role=radiogroup]').count())) {
          const shop = page.getByRole('checkbox', { name: /Shop|दुकान/ }).first();
          if (await shop.count()) await shop.click();
        }
        await page.locator('[role=radiogroup]').waitFor({ timeout: 15000 });
        // Hardware first (R-DEC-51 #4); the old build has no such tile.
        const hw = page.locator('[role=radiogroup] [data-kind=hardware]');
        await ((await hw.count()) ? hw : page.locator('[role=radiogroup] [role=radio]').first()).click();
        await page.waitForTimeout(300);
        const m = await page.evaluate(measure);
        out[key] = m;
        // The Continue bar is sticky: at the END of the page (where a merchant
        // can always scroll) the last tile must sit fully above it. Scrolling
        // the tile to the viewport's bottom is NOT the test — a sticky bar
        // covers it there by design and one more swipe uncovers it.
        const dockCover = await page.evaluate(() => {
          const grid = document.querySelector('[role=radiogroup]');
          const btn = [...document.querySelectorAll('button')].find((b) => /Continue|आगे/.test(b.textContent));
          if (!grid || !btn) return null;
          const last = [...grid.querySelectorAll('[role=radio]')].pop();
          window.scrollTo(0, document.documentElement.scrollHeight);
          const d = btn.getBoundingClientRect();
          const t = last.getBoundingClientRect();
          return Math.max(0, Math.round(t.bottom - d.top));
        });
        if (dockCover !== null) check(`${key} last tile reachable above the Continue dock`, dockCover === 0, `${dockCover}px under`);
        await page.locator('[role=radiogroup]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${dir}/${tag}-${key}.png`, fullPage: true });
        // What the eye sees at this scroll, with the sticky dock where it really is.
        await page.screenshot({ path: `${dir}/${tag}-${key}-view.png` });
        await page.locator('[role=radiogroup]').screenshot({ path: `${dir}/${tag}-${key}-tiles.png` });
        // R-DEC-64: Wholesale opens "Wholesale of what?" (the grid without it).
        const ws = page.locator('[role=radiogroup] [data-kind=wholesale]').first();
        if (await ws.count()) {
          await ws.click();
          await page.waitForTimeout(250);
          const groups = await page.locator('[role=radiogroup]').count();
          const second = page.locator('[role=radiogroup]').nth(1);
          const secondCount = groups > 1 ? await second.locator('[role=radio]').count() : 0;
          const hasWs = groups > 1 ? await second.locator('[data-kind=wholesale]').count() : -1;
          if (theme === 'light' && locale === 'en') {
            check(`${key} wholesale opens "of what?" with 9 kinds`, groups === 2 && secondCount === 9 && hasWs === 0, `${groups}/${secondCount}/${hasWs}`);
          }
          if (groups > 1) {
            await second.locator('[data-kind=kirana]').click();
            await second.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${dir}/${tag}-${key}-wholesale.png`, fullPage: true });
            const m2 = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth }));
            check(`${key} wholesale: no page overflow`, m2.overflow <= 0, String(m2.overflow));
          }
        }
        if (theme === 'light' && locale === 'en') {
          const phone = width < 1024;
          check(`${key} tile count (design 10)`, m.count === 10, String(m.count));
          check(`${key} columns (design ${phone ? 3 : 5})`, m.columns === (phone ? 3 : 5), String(m.columns));
          check(`${key} gap 10`, m.gapX === null || m.gapX === 10, String(m.gapX));
          check(`${key} tile min-height 96`, m.off.h >= 96, String(m.off.h));
          check(`${key} radius 12`, m.off.radius === '12px', m.off.radius);
          check(`${key} icon 34`, m.off.icon === 34, String(m.off.icon));
          check(`${key} name 13/600`, m.off.name === '13px/600', m.off.name);
          check(`${key} hint 11.5/500`, m.off.hint === '11.5px/500', m.off.hint);
          check(`${key} picked border 2px`, m.on.border === '2px', m.on.border);
          check(`${key} centred`, m.off.align === 'center', m.off.align);
        }
        check(`${key} no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${key} no page overflow`, m.overflow <= 0, String(m.overflow));
        check(`${key} target ≥ 44`, m.minTarget >= 44, String(m.minTarget));
      } catch (e) {
        check(`${key} opened`, false, e.message.slice(0, 160));
        await page.screenshot({ path: `${dir}/${tag}-${key}-error.png`, fullPage: true }).catch(() => {});
      }
      await ctx.close();
    }
  }
}
await browser.close();
writeFileSync(`${dir}/${tag}-measure.json`, JSON.stringify(out, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed · ${dir}/${tag}-measure.json`);
process.exitCode = failed ? 1 : 0;
