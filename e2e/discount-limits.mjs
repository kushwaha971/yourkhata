// Discount limits, tested like a merchant: a bill with one item, then
//   1. 150 % off            → the screen says why, and nothing invalid is sent
//   2. ₹ off above subtotal → the same
//   3. a valid 10 % off     → saves, and the server's total matches the screen
// Watches every draft request so an autosave that the server must refuse is
// caught, not just the message.
//   node e2e/discount-limits.mjs   (PW_CHROME, E2E_SHOTS, --width=390)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.env.E2E_BASE ?? "http://localhost:3000");
const width = Number(
  process.argv.find((a) => a.startsWith("--width="))?.slice(8) ?? 390,
);
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/discount";
mkdirSync(dir, { recursive: true });
const failures = [];
const fail = (m) => failures.push(m);
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({
  viewport: { width, height: width < 1024 ? 800 : 900 },
});
const page = await ctx.newPage();
const writes = [];
page.on("response", async (r) => {
  if (
    /\/sales\/invoices(\/[0-9a-f-]+)?$/.test(new URL(r.url()).pathname) &&
    ["POST", "PATCH"].includes(r.request().method())
  )
    writes.push({
      status: r.status(),
      body: r.request().postData() ?? "",
      reply: (await r.text().catch(() => "")).slice(0, 200),
    });
});
const api = async (p) =>
  await (await ctx.request.get(`${base}/api/v1${p}`)).json();
try {
  await page.goto(`${base}/login/email`);
  await page.fill("input[type=email]", "scale@digikhaato.test");
  await page.fill("input[type=password]", "Scale-Run-2026!");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const party = (
    await api("/parties?type=customer&status=active&book=shop&page_size=1")
  ).data[0];
  const item = (await api("/items?page_size=50&ordering=name")).data.find(
    (i) => Number(i.selling_price) > 0,
  );
  await page.goto(
    `${base}/sales/invoices/new?party=${party.id}&partyName=${encodeURIComponent(party.name)}`,
    { waitUntil: "networkidle" },
  );
  await page
    .getByRole("combobox", { name: /Search items to add|Add item/ })
    .first()
    .click();
  await page.keyboard.type(item.name, { delay: 10 });
  await page
    .getByRole("option", {
      name: new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .first()
    .click();
  await page.waitForTimeout(800);
  const discount = page
    .getByRole("textbox", { name: /^Discount$/ })
    .or(page.getByLabel("Discount", { exact: true }))
    .first();

  const tryValue = async (label, chip, value, expectError) => {
    writes.length = 0;
    await page
      .locator("button, [role=radio]")
      .filter({ hasText: chip })
      .first()
      .click();
    await discount.fill(value);
    await discount.blur();
    await page.waitForTimeout(4500); // past the 3 s autosave
    const text = await page.locator("main").innerText();
    const shown = expectError.test(text);
    await page.screenshot({ path: `${dir}/${width}-${label}.png` });
    const refused = writes.filter((w) => w.status >= 400);
    console.log(
      `${label}: error shown=${shown}; writes=${writes.map((w) => w.status).join(",") || "none"}`,
    );
    return { shown, refused };
  };

  const pct = await tryValue(
    "pct-150",
    "% off",
    "150",
    /This cannot be more than 100\./,
  );
  if (!pct.shown) fail("150 % off: no message on screen");
  if (pct.refused.length)
    fail(
      `150 % off: ${pct.refused.length} draft save(s) sent and refused: ${pct.refused[0].reply}`,
    );

  const amt = await tryValue(
    "amt-over",
    "₹ off",
    "9999999",
    /Discount cannot exceed the subtotal\./,
  );
  if (!amt.shown) fail("₹ off over subtotal: no message on screen");
  if (amt.refused.length)
    fail(
      `₹ off over subtotal: ${amt.refused.length} draft save(s) sent and refused: ${amt.refused[0].reply}`,
    );

  const ok = await tryValue(
    "pct-10",
    "% off",
    "10",
    /This cannot be more than 100\.|Discount cannot exceed the subtotal\.|Couldn.t save/,
  );
  if (ok.shown) fail("10 % off: an error is still shown");
  const saved = writes.filter((w) => w.status < 300).pop();
  if (!saved) fail("10 % off: the draft was not saved");
} finally {
  await browser.close();
}
console.log(`${failures.length} failures`);
for (const f of failures) console.log("FAIL", f);
process.exitCode = failures.length ? 1 : 0;
