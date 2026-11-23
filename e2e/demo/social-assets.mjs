/**
 * e2e/demo/social-assets.mjs — the profile picture, banners and launch posts
 * for Instagram, LinkedIn, YouTube and Medium, in the site's own theme (teal
 * cover #0E7C86, amber action #F59E1B, Plus Jakarta Sans) and with real
 * screens from the guide pages. Writes e2e/demo/social/*.png.
 *
 *   PW_CHROME=… node e2e/demo/social-assets.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { HERE } from './lib.mjs';

const OUT = path.join(HERE, 'social');
mkdirSync(OUT, { recursive: true });
const PUB = path.join(HERE, '..', '..', 'frontend', 'public');
const uri = (rel, type) => `data:${type};base64,${readFileSync(path.join(PUB, rel)).toString('base64')}`;
const MARK = uri('brand/yourkhata-mark.svg', 'image/svg+xml');
const FULL = uri('brand/yourkhata-maskable.svg', 'image/svg+xml');
// The home page's own phone poster: real screens, without a guide's numbered marker.
const PHONE = uri('media/landing/hero-mobile-poster.jpg', 'image/jpeg');

const BASE = `
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:100%;height:100%}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1B1E24;background:#fff;overflow:hidden}
.teal{color:#0E7C86}.amber{background:#F59E1B;color:#1B1E24}
.glow{background:radial-gradient(60% 70% at 85% 10%,rgba(14,124,134,.16),transparent 70%),radial-gradient(50% 60% at 0% 100%,rgba(245,158,27,.16),transparent 70%),#fff}
.brand{display:flex;align-items:center;gap:.35em;font-weight:700;letter-spacing:-.02em}
.brand img{height:1.6em;width:1.6em}
.btn{display:inline-block;border-radius:.6em;padding:.55em 1.1em;font-weight:700}
.chip{display:inline-flex;align-items:center;gap:.4em;border:1px solid #DDE3E8;background:#fff;border-radius:999px;padding:.35em .9em;font-weight:600;color:#3A4049}
.chip b{color:#0E7C86}
.phone{border-radius:44px;border:14px solid #1B1E24;overflow:hidden;box-shadow:0 40px 80px -30px rgba(14,124,134,.45);background:#fff}
.phone img{display:block;width:100%}
</style>`;

const ASSETS = {
  // Square; Instagram, YouTube and LinkedIn crop it to a circle, so the full-bleed cover.
  'profile-800': [800, 800, `<body style="background:#0E7C86"><img src="${FULL}" style="width:800px;height:800px"></body>`],

  // LinkedIn puts the page logo over the left of the cover on desktop, so the words start right of it.
  'linkedin-cover-1128x191': [1128, 191, `<body class="glow" style="display:flex;align-items:center;justify-content:space-between;padding:0 56px 0 300px">
    <div><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Bills, stock and dues — <span class="teal">on your phone.</span></div>
    <div style="font-size:17px;color:#5E6470;margin-top:8px">GST billing and stock for every kind of business in India</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px"><div class="brand" style="font-size:26px"><img src="${MARK}">YourKhata</div>
    <div class="btn amber" style="font-size:16px">yourkhata.com</div></div></body>`],

  // YouTube shows only the centre 1546×423 on every device; everything that matters sits there.
  'youtube-banner-2560x1440': [2560, 1440, `<body class="glow" style="display:flex;align-items:center;justify-content:center">
    <div style="width:1546px;height:423px;display:flex;align-items:center;justify-content:space-between">
    <div><div class="brand" style="font-size:44px"><img src="${MARK}">YourKhata</div>
    <div style="font-size:64px;font-weight:800;letter-spacing:-.03em;margin-top:18px;line-height:1.05">Bills, stock and dues —<br><span class="teal">on your phone.</span></div></div>
    <div style="text-align:right"><div style="font-size:30px;color:#5E6470;line-height:1.5">Step-by-step guides<br>for every kind of shop</div>
    <div class="btn amber" style="font-size:30px;margin-top:22px">yourkhata.com</div></div></div></body>`],

  // Medium's lead image and LinkedIn's link card are 1.91:1.
  'medium-cover-1600x840': [1600, 840, `<body class="glow" style="display:flex;align-items:center;gap:80px;padding:0 110px">
    <div style="flex:1"><div class="brand" style="font-size:40px"><img src="${MARK}">YourKhata</div>
    <div style="font-size:76px;font-weight:800;letter-spacing:-.03em;line-height:1.04;margin-top:28px">Your shop's records,<br><span class="teal">on your phone.</span></div>
    <div style="font-size:30px;color:#5E6470;margin-top:24px;line-height:1.4">GST bills, stock, purchases, payments<br>and who owes you — in one place.</div></div>
    <div class="phone" style="width:380px;transform:rotate(3deg)"><img src="${PHONE}"></div></body>`],

  'post-1-hero-1080x1350': [1080, 1350, `<body class="glow" style="padding:84px 80px;display:flex;flex-direction:column">
    <div class="brand" style="font-size:38px"><img src="${MARK}">YourKhata</div>
    <div style="font-size:84px;font-weight:800;letter-spacing:-.03em;line-height:1.02;margin-top:44px">Your shop's records,<br><span class="teal">on your phone.</span></div>
    <div style="font-size:32px;color:#5E6470;margin-top:24px">Bills, stock and who owes you — in one place.</div>
    <div style="flex:1;display:flex;justify-content:center;align-items:flex-end;margin-top:40px;overflow:hidden">
    <div class="phone" style="width:470px;margin-bottom:-260px"><img src="${PHONE}"></div></div></body>`],

  'post-2-jobs-1080x1350': [1080, 1350, `<body style="background:#F3F5F7;padding:84px 72px">
    <div class="brand" style="font-size:34px"><img src="${MARK}">YourKhata</div>
    <div style="font-size:70px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin-top:36px">Six jobs,<br><span class="teal">done in a few taps.</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:52px">
    ${[['🧾', 'GST bills', 'CGST, SGST or IGST, worked out'], ['📒', 'Who owes you', 'Every customer, bill by bill'], ['🔔', 'Reminders', 'Sent from your WhatsApp'], ['📦', 'Stock', 'Goes down with every bill'], ['🚚', 'Purchases', 'Supplier bills and payments'], ['📊', 'Reports', 'Day book, GST and more']]
      .map(([i, t, s]) => `<div style="background:#fff;border:1px solid #E3E7EB;border-radius:28px;padding:30px"><div style="width:68px;height:68px;border-radius:18px;background:#0E7C86;display:flex;align-items:center;justify-content:center;font-size:34px">${i}</div><div style="font-size:34px;font-weight:700;margin-top:20px">${t}</div><div style="font-size:24px;color:#5E6470;margin-top:6px">${s}</div></div>`).join('')}
    </div></body>`],

  'post-3-start-1080x1350': [1080, 1350, `<body style="background:#0E7C86;color:#fff;padding:96px 80px;display:flex;flex-direction:column">
    <div class="brand" style="font-size:38px"><img src="${MARK}" style="border:3px solid #6FBBC3;border-radius:22%">YourKhata</div>
    <div style="font-size:88px;font-weight:800;letter-spacing:-.03em;line-height:1.02;margin-top:72px">Start free<br>in one minute.</div>
    <div style="display:flex;flex-direction:column;gap:22px;margin-top:56px;font-size:36px;font-weight:600">
    <div>✓ Your mobile number and a WhatsApp code</div><div>✓ Nothing to install</div><div>✓ No card needed</div><div>✓ Guides for every kind of shop</div></div>
    <div style="flex:1"></div><div class="btn amber" style="font-size:44px;align-self:flex-start">yourkhata.com</div></body>`],
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
for (const [name, [width, height, body]] of Object.entries(ASSETS)) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><meta charset="utf-8">${BASE}${body}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.close();
  console.log(name);
}
await browser.close();
