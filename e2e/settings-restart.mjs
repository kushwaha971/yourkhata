// Edge case E16 (catalogue): a setting the merchant changed is still there
// after the API restarts. Phase "write" flips shop.wholesale on the jeweller
// QA shop and prints the value; phase "read" (after a restart) reads it back
// and puts it back the way it was.
//   node e2e/settings-restart.mjs --phase=write   # then restart the API
//   node e2e/settings-restart.mjs --phase=read
import { chromium } from 'playwright';
const phase = process.argv.find((a) => a.startsWith('--phase='))?.slice(8) ?? 'write';
const B = process.env.E2E_BASE ?? 'http://localhost:3005';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME });
const c = await b.newContext();
const p = await c.newPage();
await p.goto(B + '/login/email');
await p.fill('input[type=email]', 'qa-jeweller@adcert.test');
await p.fill('input[type=password]', 'AdCert-Test-2026!');
await p.keyboard.press('Enter');
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
const read = async () => {
  const g = await c.request.get(B + '/api/v1/tenants/current/settings');
  const body = await g.json();
  const values = body.data?.values ?? body.values ?? {};
  return { etag: g.headers()['etag'], wholesale: values['shop.wholesale']?.value };
};
const put = async (etag, value) => {
  const csrf = (await c.cookies()).find((x) => x.name === 'ub_csrf')?.value ?? '';
  const r = await c.request.put(B + '/api/v1/tenants/current/settings', {
    headers: { 'X-CSRF-Token': csrf, 'If-Match': etag },
    data: { values: { 'shop.wholesale': { value } } },
  });
  return r.status();
};
let ok = true;
const now = await read();
if (phase === 'write') {
  const status = await put(now.etag, true);
  const after = await read();
  ok = status < 300 && after.wholesale === true;
  console.log(`${ok ? 'pass' : 'FAIL'} write — status ${status}, wholesale ${now.wholesale} → ${after.wholesale}`);
} else {
  ok = now.wholesale === true;
  console.log(`${ok ? 'pass' : 'FAIL'} read after restart — wholesale ${now.wholesale}`);
  // Put it back: the QA jeweller runs with wholesale off (e2e/_reset.mjs).
  console.log(`restored ${await put(now.etag, false)}`);
}
await b.close();
process.exit(ok ? 0 : 1);
