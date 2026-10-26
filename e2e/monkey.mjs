// Seeded monkey testing for one screen: random taps, typing, keys and
// scrolls, as an impatient or confused user would — and a failure the moment
// the page crashes, logs a console error or React warning, answers 5xx, grows
// wider than the viewport, or loses the data it was given.
//
//   node e2e/monkey.mjs --path=/sales/invoices/new --seed=7 --steps=300 --width=390
//     [--setup=party]   start with a saved customer chosen (A3's box)
//
// The seed makes a failing run repeatable: rerun with the printed seed.
// Writes only drafts to the LOCAL seeded QA tenant; never presses Issue,
// Delete, Void or Record (those buttons are skipped by name).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const base = "http://localhost:3000";
const path = arg("path", "/sales/invoices/new");
const seed = Number(arg("seed", String(Date.now() % 100000)));
const steps = Number(arg("steps", "300"));
const width = Number(arg("width", "390"));
const setup = arg("setup", "");
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/monkey";
mkdirSync(dir, { recursive: true });

// mulberry32: a small seeded generator, so a run can be replayed exactly.
let state = seed >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const SKIP =
  /issue|delete|void|record|remove|sign out|log out|archive|cancel bill|discard/i;
const TEXT = [
  "",
  "a",
  "12",
  "0",
  "-5",
  "99999999",
  "3.141",
  "राधे",
  "O'Brien & Sons",
  "   ",
  "😀",
  "x".repeat(200),
];
const KEYS = [
  "Enter",
  "Escape",
  "Tab",
  "Shift+Tab",
  "Backspace",
  "ArrowDown",
  "ArrowUp",
  "Control+k",
  "Control+s",
];

const failures = [];
const log = [];
const stuck = [];
// Watchdog: a run that stops moving is a finding (a dialog, a print sheet, a
// navigation that never settles), not a silent hang. Record what it was doing.
const WATCHDOG_MS = Number(process.env.MONKEY_WATCHDOG_MS ?? 360000);
setTimeout(async () => {
  failures.push(
    `watchdog: no finish after ${WATCHDOG_MS / 1000}s; last actions: ${log.slice(-5).join(" | ")}`,
  );
  try {
    await page.screenshot({
      path: `${dir}/monkey-${seed}-${width}-hung.png`,
      timeout: 5000,
    });
    console.log("hung at", page.url());
  } catch {}
  writeFileSync(`${dir}/monkey-${seed}-${width}.log`, log.join("\n"));
  console.log(`seed ${seed} · ${width}px · ${log.length} actions · HUNG`);
  for (const f of failures) console.log("FAIL", f);
  process.exit(1);
}, WATCHDOG_MS).unref();
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({
  viewport: { width, height: width < 1024 ? 800 : 900 },
});
await ctx.addInitScript(() => {
  const original = console.error;
  window.__errors = [];
  console.error = (...args) => {
    window.__errors.push(
      String(args[0]).slice(0, 200) +
        "\n" +
        (new Error().stack ?? "").split("\n").slice(2, 14).join("\n"),
    );
    original.apply(console, args);
  };
});
const page = await ctx.newPage();
let armed = false;
let pageRef = null;
page.on("console", (m) => {
  // The browser's own note on a 4xx is not an app error; the response handler
  // below logs every 4xx with its request and reply, and fails on any 5xx.
  if (
    /Failed to load resource: the server responded with a status of 4\d\d/.test(
      m.text(),
    )
  )
    return;
  if (armed && (m.type() === "error" || /Warning:/.test(m.text())))
    failures.push(`console: ${m.text().slice(0, 200)}`);
});
page.on("pageerror", (e) =>
  failures.push(`page error: ${e.message.slice(0, 200)}`),
);
page.on("response", async (r) => {
  if (!armed || !r.url().includes("/api/") || r.status() < 400) return;
  const detail = `HTTP ${r.status()} ${r.request().method()} ${r.url().replace(base, "")} body=${(r.request().postData() ?? "").slice(0, 400)} reply=${(await r.text().catch(() => "")).slice(0, 300)}`;
  console.log(detail);
  if (r.status() >= 500) failures.push(detail);
});
try {
  await page.goto(`${base}/login/email`);
  await page.fill("input[type=email]", "scale@digikhaato.test");
  await page.fill("input[type=password]", "Scale-Run-2026!");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  let url = `${base}${path}`;
  let expectName = null;
  if (setup === "party") {
    const p = (
      await (
        await ctx.request.get(
          `${base}/api/v1/parties?type=customer&status=active&book=shop&page_size=5`,
        )
      ).json()
    ).data[0];
    url += `${url.includes("?") ? "&" : "?"}party=${p.id}&partyName=${encodeURIComponent(p.name)}`;
    expectName = p.name;
  }
  await page.goto(url, { waitUntil: "networkidle" });
  armed = true;

  for (let i = 0; i < steps; i += 1) {
    const kind = pick(["tap", "tap", "tap", "type", "key", "scroll"]);
    page.setDefaultTimeout(4000);
    const step = async () => {
      try {
        if (kind === "tap") {
          const targets = await page
            .locator(
              "button:visible, [role=option]:visible, a:visible, input:visible, [role=button]:visible",
            )
            .all();
          const usable = [];
          for (const t of targets) {
            // Short and tolerant: the element may be gone by the time it is read.
            const name = (
              (await t
                .getAttribute("aria-label", { timeout: 300 })
                .catch(() => null)) ??
              (await t.innerText({ timeout: 300 }).catch(() => ""))
            ).trim();
            const href = await t
              .getAttribute("href", { timeout: 300 })
              .catch(() => null);
            if (SKIP.test(name) || (href && !href.startsWith("#"))) continue;
            usable.push([t, name]);
          }
          if (usable.length) {
            const [t, name] = pick(usable);
            log.push(`${i} tap "${name.slice(0, 40)}"`);
            // The user changed the customer on purpose: the box may now differ.
            if (/^(Change|Quick sale|Saved customer)$|Customer ·/.test(name))
              expectName = null;
            await t.click({ timeout: 1500, trial: false }).catch(() => {});
          }
        } else if (kind === "type") {
          const text = pick(TEXT);
          log.push(`${i} type ${JSON.stringify(text.slice(0, 20))}`);
          await page.keyboard.type(text, { delay: 0 });
        } else if (kind === "key") {
          const key = pick(KEYS);
          log.push(`${i} key ${key}`);
          await page.keyboard.press(key);
        } else {
          log.push(`${i} scroll`);
          await page.mouse.wheel(0, pick([-600, -200, 200, 600]));
        }
        await page.waitForTimeout(40);
        // Left the screen (a link or Back): come back, as a user would.
        if (
          !page.url().startsWith(`${base}/sales/invoices`) &&
          path.startsWith("/sales/invoices")
        ) {
          log.push(`${i} left to ${page.url().replace(base, "")}; back`);
          // 'load', not 'networkidle': a screen with live requests (autosave,
          // held bills) never goes quiet, and the run waited for ever.
          await page.goto(url, { waitUntil: "load", timeout: 20000 });
        }
        if (i % 25 === 0) {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          if (overflow > 0)
            failures.push(
              `step ${i}: page ${overflow}px wider than the viewport`,
            );
          if (expectName) {
            const box = page.getByTestId("invoice-customer-line");
            if (
              (await box.count()) &&
              !(await box.innerText()).includes(expectName)
            )
              failures.push(`step ${i}: the customer box lost "${expectName}"`);
          }
        }
      } catch (e) {
        // A navigation mid-step (a tap opened another page) is not an app fault.
        if (
          !/Execution context was destroyed|Target page, context or browser has been closed|navigat/i.test(
            String(e.message),
          )
        )
          failures.push(
            `step ${i} (${kind}): ${String(e.message).slice(0, 160)}`,
          );
      }
    };
    // A hard cap per step: one Playwright call (a click that waits on a
    // navigation) ignored its own timeout and the run waited for ever. A step
    // that hits the cap is recorded with a screenshot; the page is then
    // checked for a real freeze before going on.
    const STEP_MS = 8000;
    const done = await Promise.race([
      step().then(() => true),
      new Promise((r) => setTimeout(() => r(false), STEP_MS)),
    ]);
    if (!done) {
      stuck.push(`${i} (${kind}) ${log[log.length - 1] ?? ""}`);
      const alive = await Promise.race([
        page
          .evaluate(() => 1)
          .then(() => true)
          .catch(() => false),
        new Promise((r) => setTimeout(() => r(false), 5000)),
      ]);
      if (!alive)
        failures.push(
          `step ${i}: the page stopped responding (main thread frozen)`,
        );
      await page.keyboard.press("Escape").catch(() => {});
    }
    if (failures.length) break;
  }
  await page.screenshot({ path: `${dir}/monkey-${seed}-${width}.png` });
  const stacks = await page
    .evaluate(() => window.__errors ?? [])
    .catch(() => []);
  if (stacks.length)
    writeFileSync(
      `${dir}/monkey-${seed}-${width}.stacks`,
      stacks.join("\n---\n"),
    );
} finally {
  writeFileSync(`${dir}/monkey-${seed}-${width}.log`, log.join("\n"));
  await browser.close();
}
console.log(
  `seed ${seed} · ${width}px · ${log.length} actions · ${failures.length} failures${stuck.length ? ` · ${stuck.length} harness-stuck steps: ${stuck.slice(0, 3).join(" | ")}` : ""}`,
);
for (const f of failures) console.log("FAIL", f);
if (failures.length)
  console.log(
    `replay: node e2e/monkey.mjs --path=${path} --seed=${seed} --steps=${steps} --width=${width}${setup ? ` --setup=${setup}` : ""}`,
  );
process.exitCode = failures.length ? 1 : 0;
