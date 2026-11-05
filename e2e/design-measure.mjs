// Measures the running app against the artifact's own mock: every text the two share is
// found on both sides and its computed box and type are compared, so a button 4 px short
// or a word 1 px large fails here where a side-by-side screenshot would not show it.
//   node e2e/design-measure.mjs --mock=pHome --kind=kirana [--email= --password= --route=]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const mockId = arg('mock');
const kind = arg('kind', 'kirana');
const pair = JSON.parse(readFileSync(new URL('./design-pairs.json', import.meta.url))).find((p) => p.mock === mockId);
const phone = mockId.startsWith('p') || mockId.endsWith('-p');
const width = Number(arg('width', phone ? 390 : 1280));
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

const collect = (root) => {
  const out = new Map();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!text || text.length > 60 || out.has(text) || el.closest('nav,aside,header,[data-testid=ub-bottom-nav]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // The control the words sit in, when there is one: its box is what the design sizes.
    const box = el.closest('button,a,.btn,.badge,.chip,[role=tab]') ?? el;
    const c = getComputedStyle(el), k = getComputedStyle(box), q = box.getBoundingClientRect();
    out.set(text, {
      fontSize: c.fontSize, fontWeight: c.fontWeight, color: c.color,
      boxH: box === el ? null : box.offsetHeight, radius: box === el ? null : k.borderTopLeftRadius,
      bg: box === el ? null : k.backgroundColor, border: box === el ? null : k.borderTopColor,
      padX: box === el ? null : k.paddingLeft,
    });
  }
  return [...out];
};

const dp = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await dp.goto(`file://${resolve('docs/revamp/design/shop-fixes-and-business-types.html')}`);
await dp.waitForTimeout(1500);
await dp.locator('select').filter({ has: dp.locator('option[value=jewel]') }).first().selectOption(kind);
await dp.waitForTimeout(2000);
// Boxes the words cannot reach: same-role parts, compared by height and padding.
const HEAD = '[data-ub-page-header]', FRAME = '[data-ub-register-frame]';
const PARTS = [
  ['day line cell', '.dayl>div', '[data-testid=home-figures]>div', ['fontSize']],
  ['panel head', '.panel>.ph2', '[data-testid=home-followups-head]', ['fontSize']],
  ['list row', '.lst>.li', '[data-testid=home-follow-row],[data-testid=home-promise-row]', ['fontSize']],
  ['strip tile', '.card[style*="display:grid;gap:2px"]', '[data-testid^=home-strip-],[data-testid^=jewel-home-]', ['fontSize']],
  // Register parts: measured whatever the sample data says, because the words never match.
  ['page title', '.phd h1,.ptitle', 'main h1', ['h']],
  ['page subtitle', '.phd p', '[data-ub-page-subtitle]', ['h']],
  ['header button', '.acts .btn:not(.cta)', `${HEAD} a:not(.bg-cta),${HEAD} button:not(.bg-cta)`],
  ['header CTA', '.acts .btn.cta', `${HEAD} .bg-cta`],
  ['count line', '.countline', '[data-testid=count-line]', ['h', 'bg']],
  ['count value', '.countline b:not(.get):not(.give)', '[data-testid=count-line] b.text-text-primary', ['h', 'bg']],
  ['register frame', '.tf', FRAME, ['h', 'padT', 'padL']],
  ['search box', '.inp', `main input[type=search]`, [], (e) => e.parentElement],
  ['tool button', '.tools .btn', `${FRAME} [data-part=tool],${FRAME} [role=combobox]`],
  ['table head', '.tf th', `${FRAME} th`],
  ['table cell', '.tf tbody td', `${FRAME} tbody td`, ['h', 'bg']],
  ['table row', '.tf tbody tr', `${FRAME} tbody tr`, ['padT', 'padL', 'bg', 'fontSize', 'fontWeight', 'color']],
  ['status badge', '.tf .badge,.lst .badge', 'main [data-part=badge],main [data-testid=ub-status-badge]'],
  ['pager', '.pager', '[data-testid=ub-grid-pager],[data-part=pager]', ['bg']],
  ['pager button', '.pager .btn', '[data-testid=ub-grid-pager] button,[data-part=pager] button'],
  ['filter chip', '.pills .chp:not(.on)', 'main button[aria-pressed=false]'],
  ['filter chip on', '.pills .chp.on', 'main button[aria-pressed=true]'],
  ['card row', '.lst>.li', 'main [data-testid=ub-grid-card],main [data-part=card-row]', ['bg']],
];
const readPart = ([sel, hop]) => {
  let e = [...document.querySelectorAll(sel)].find((n) => n.offsetWidth);
  if (!e) return null;
  if (hop) e = e.parentElement;
  const c = getComputedStyle(e);
  return { h: e.offsetHeight, padT: c.paddingTop, padL: c.paddingLeft, radius: c.borderTopLeftRadius, fontSize: c.fontSize, fontWeight: c.fontWeight, color: c.color, bg: c.backgroundColor };
};
const dark = process.argv.includes('--dark');
if (dark) await dp.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const el = dp.locator(`[data-mock="${mockId}"]`).first();
await el.scrollIntoViewIfNeeded();
const design = new Map(await el.evaluate(collect));

const c = await b.newContext({ viewport: { width, height: phone ? 844 : 800 } });
const p = await c.newPage();
if (process.argv.includes('--hi')) await c.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
await p.goto(`${base}/login/email`);
await p.locator('input[type=email]').first().fill(arg('email', 'scale@digikhaato.test'));
await p.locator('input[type=password]').first().fill(arg('password', 'Scale-Run-2026!'));
await p.keyboard.press('Enter');
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
await p.goto(base + arg('route', pair.route));
await p.waitForTimeout(3000);
if (dark) { await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await p.waitForTimeout(400); }
const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
if (over > 0) console.log('OVERFLOW', over);
const app = new Map(await p.locator('main').first().evaluate(collect));

// The one agreed token difference: ink-3 fails 4.5:1 on white, so the app's tertiary is darker (CLAUDE.md gate 7).
const SAME = { 'rgb(122, 129, 140)': 'rgb(101, 109, 120)' };
if (process.argv.includes('--hi')) design.clear();
const bad = [], unmatched = [];
const scoped = (root, [sel]) => {
  const e = [...root.querySelectorAll(sel)].find((n) => n.offsetWidth);
  if (!e) return null;
  const c = getComputedStyle(e);
  return { h: e.offsetHeight, padT: c.paddingTop, padL: c.paddingLeft, radius: c.borderTopLeftRadius, fontSize: c.fontSize, fontWeight: c.fontWeight, color: c.color, bg: c.backgroundColor };
};
for (const [name, ds, as, skip = [], hop] of PARTS) {
  const d = await el.evaluate(scoped, [ds]);
  const a = await p.evaluate(readPart, [as, Boolean(hop)]);
  if (!d) continue; // this mock does not draw the part
  if (!a) { console.log(`part ${name}: not found on the app`); continue; }
  for (const k of Object.keys(d)) {
    if (skip.includes(k) || String(d[k]) === String(a[k])) continue;
    if (k === 'color' && SAME[d[k]] === a[k]) continue;
    bad.push({ text: `[${name}]`, key: k, design: d[k], app: a[k] });
  }
}
for (const [text, d] of design) {
  const a = app.get(text);
  if (!a) { unmatched.push(text); continue; }
  for (const key of Object.keys(d)) {
    if (d[key] === null || a[key] === null) continue;
    if (key === 'color' && SAME[d[key]] === a[key]) continue;
    const tol = 0;
    if (String(d[key]) !== String(a[key]) && !(typeof d[key] === 'number' && Math.abs(d[key] - a[key]) <= tol))
      bad.push({ text, key, design: d[key], app: a[key] });
  }
}
for (const r of bad) console.log(`${r.text.padEnd(32)} ${r.key.padEnd(11)} design ${r.design}  app ${r.app}`);
console.log(`\n${mockId} @${width}: ${design.size} design texts, ${bad.length} mismatches, ${unmatched.length} not on the app`);
if (process.argv.includes('--missing')) console.log('not on the app:', unmatched.join(' | '));
await b.close();
if (bad.length) process.exitCode = 1;
