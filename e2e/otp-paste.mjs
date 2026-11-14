/**
 * Pasting the sign-in code (owner, 12 and 14 Nov 2026: "not able to paste otp
 * directly"). The code is six digits, as WhatsApp sends it. On the live sign-in
 * page at 1280 and 390, every way a code arrives must send THAT code:
 *   - Ctrl/Cmd+V of the code, into the first box or a later one, or grouped;
 *   - Ctrl/Cmd+V of a whole message that carries other numbers ("valid for
 *     10 minutes", the phone number) — this sent "1048" for "...is 4821";
 *   - a keyboard insert of the code or of the message (iOS autofill, Android's
 *     clipboard chip), which arrives without a paste event.
 * One case per size pastes the REAL code from the API log and must sign in.
 *
 *   node e2e/otp-paste.mjs
 */
import { readFileSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const API_LOG = process.env.E2E_API_LOG ?? '/tmp/api.log';
let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};
const codeFor = async (mobile, notBefore) => {
  for (let i = 0; i < 30; i += 1) {
    const log = readFileSync(API_LOG, 'utf8').slice(notBefore);
    const hits = [...log.matchAll(/sms\.console to=\+91…(\d{3}) body=(\d{4,6}) is your/g)].filter((m) => m[1] === mobile.slice(-3));
    if (hits.length) return hits[hits.length - 1][2];
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};
const CASES = [
  ['the code', (c) => c, 0, 'paste'],
  ['the code into box 4', (c) => c, 3, 'paste'],
  ['the code grouped "482 193"', (c) => `${c.slice(0, 3)} ${c.slice(3)}`, 0, 'paste'],
  ['a message, code first', (c) => `${c} is your YourKhata code. Valid 10 min. Do not share.`, 0, 'paste'],
  ['a message, code last', (c) => `Valid for 10 minutes. Your code is ${c}`, 0, 'paste'],
  ['a message with the phone number', (c) => `Code for +91 98111 22255 is ${c}`, 0, 'paste'],
  ['a keyboard insert of the code', (c) => c, 0, 'insert'],
  ['a keyboard insert of a message', (c) => `Valid for 10 minutes. Your code is ${c}`, 0, 'insert'],
];
const b = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
let n = 10;
for (const width of [1280, 390]) {
  for (const [i, [name, make, at, how]] of CASES.entries()) {
    const phone = width < 768;
    const ctx = await b.newContext({ viewport: { width, height: 844 }, ...(phone ? { isMobile: true, hasTouch: true } : {}), permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage();
    n += 1;
    const mobile = `97000${String(n).padStart(5, '0')}`;
    const from = statSync(API_LOG).size;
    await p.goto(`${base}/login`, { waitUntil: 'networkidle' });
    await p.locator('input[type=tel]').first().fill(mobile);
    await p.getByRole('button', { name: /Send code|Get code|Continue/i }).first().click();
    const cells = p.locator('[role=group] input[inputmode=numeric]');
    await cells.first().waitFor({ timeout: 15000 });
    if (i === 0) check((await cells.count()) === 6, `${width}: six boxes`);
    // The first case uses the real code and must sign in; the rest a made-up
    // one, read off the request, so a wrong pick shows as the wrong digits.
    const real = i === 0 ? await codeFor(mobile, from) : null;
    const code = real ?? '482193';
    const sent = [];
    p.on('request', (r) => r.url().includes('/otp/verify') && sent.push(JSON.parse(r.postData() || '{}').code));
    await cells.nth(at).focus();
    if (how === 'paste') {
      await p.evaluate((t) => navigator.clipboard.writeText(t), make(code));
      await p.keyboard.press('ControlOrMeta+V');
    } else await p.keyboard.insertText(make(code));
    await p.waitForTimeout(900);
    check(sent[0] === code, `${width}: ${how} ${name} → sent ${JSON.stringify(sent[0])}`);
    if (real) {
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
      check(!new URL(p.url()).pathname.startsWith('/login'), `${width}: the pasted real code signs in (${new URL(p.url()).pathname})`);
    }
    await ctx.close();
  }
}
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
