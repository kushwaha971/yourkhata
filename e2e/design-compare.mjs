// Side-by-side against the APPROVED design, per screen and per case.
//
// Photographs the design page's own mocks (docs/revamp/design/
// shop-fixes-and-business-types.html, `[data-mock=<name>]`) and pairs each
// with our screenshot of the same state, into one contact sheet per piece.
// The sheet is for LOOKING: measurements live in each piece's own check.
//
//   node e2e/design-compare.mjs --piece=a1 --shots=<dir with our shots>
//     --pairs='pSearch:390-light-en-open.png,dSearch:1280-light-en-open.png'
//
// Writes <shots>/compare-<piece>.png.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const piece = arg("piece") ?? "piece";
const shots = arg("shots");
const pairs = (arg("pairs") ?? "")
  .split(",")
  .filter(Boolean)
  .map((p) => {
    const [mock, ours, caption] = p.split(":");
    return { mock, ours, caption: caption ?? `${mock} · ${ours}` };
  });
const here = dirname(fileURLToPath(import.meta.url));
const designPath = resolve(
  here,
  "../docs/revamp/design/shop-fixes-and-business-types.html",
);
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(designPath).href, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const designShots = {};
  for (const { mock } of pairs) {
    if (designShots[mock]) continue;
    const el = page.locator(`[data-mock="${mock}"]`).first();
    await el.scrollIntoViewIfNeeded();
    const file = `${shots}/design-${mock}.png`;
    await el.screenshot({ path: file });
    designShots[mock] = file;
  }
  const rows = pairs
    .map(
      ({
        mock,
        ours,
        caption,
      }) => `<section><h2>${caption}</h2><div class="pair">
      <figure><figcaption>Design · ${mock}</figcaption><img src="${pathToFileURL(designShots[mock]).href}"></figure>
      <figure><figcaption>Built · ${ours}</figcaption><img src="${pathToFileURL(`${shots}/${ours}`).href}"></figure>
    </div></section>`,
    )
    .join("");
  const sheet = await browser.newPage({
    viewport: { width: 1700, height: 900 },
  });
  await sheet.setContent(
    `<style>body{font:14px system-ui;margin:16px;background:#f4f4f4}h2{font-size:15px;margin:18px 0 8px}
     .pair{display:flex;gap:16px;align-items:flex-start}figure{margin:0;background:#fff;padding:8px;border:1px solid #ddd}
     figcaption{font-weight:600;margin-bottom:6px}img{display:block;max-width:800px;max-height:900px}</style>
     <h1>${piece.toUpperCase()} · design vs built</h1>${rows}`,
    { waitUntil: "load" },
  );
  await sheet.screenshot({
    path: `${shots}/compare-${piece}.png`,
    fullPage: true,
  });
  console.log(`${shots}/compare-${piece}.png`);
} finally {
  await browser.close();
}
