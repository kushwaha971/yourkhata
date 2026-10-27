// Seeded monkey testing for one screen: random taps, typing, keys and
// scrolls, as an impatient or confused user would — and a failure the moment
// the page crashes, logs a console error or React warning, answers 5xx, grows
// wider than the viewport, or loses the data it was given.
//
//   node e2e/monkey.mjs --path=/sales/invoices/new --seed=7 --steps=300 --width=390
//     [--setup=party]   start with a saved customer chosen (A3's box)
//
// Besides taps, typing, keys and scrolls it RELOADS, goes Back and Forward,
// and wanders to another Shop page (pokes it, then returns by the sidebar or
// Back), as a distracted user does. After each it checks the bill kept its
// lines. It also watches the API (any 5xx, a refused save the screen should
// have blocked, the same call repeated in a burst) and speed (page loads,
// long main-thread tasks, JS heap growth), and prints a summary of both.
//
// The seed makes a failing run repeatable: rerun with the printed seed.
// Writes only drafts to the LOCAL seeded QA tenant; never presses Issue,
// Delete, Void or Record (those buttons are skipped by name).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const base = (process.env.E2E_BASE ?? "http://localhost:3000");
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

// In BOTH languages: a tap can switch the app to Hindi, and the English-only
// list then let the monkey tap "साइन आउट करें" (sign out) and spend the rest of
// the run on the sign-in page tapping "कोड भेजें" (send code), asking for real
// OTPs — which read as a /auth/me + /auth/refresh "request loop" (A6, seed 92).
const SKIP =
  /issue|delete|void|record|remove|sign out|log out|archive|cancel bill|discard|send code|साइन आउट|लॉग आउट|कोड भेजें|जारी करें|हटाएँ|मिटाएँ/i;
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
// What the page is still waiting for, dumped by the watchdog: a hang is a
// finding, and "stuck on a skeleton" says nothing without the open requests.
const inflight = new Map();
const lastErrors = [];
const WANDER = ["/dashboard", "/sales/invoices", "/parties?type=customer", "/items", "/payments", "/sales/estimates", "/reports"];
// API: every finished request, for counts, bursts and the slowest replies.
const calls = [];
// Speed: one entry per full page load (reload, wander, return).
const loads = [];
let keptChecks = 0;
let keptOnServer = 0;
const onDeviceOnly = [];
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
    console.log("open requests:", JSON.stringify([...inflight.values()].slice(0, 12)));
    console.log("last console errors:", JSON.stringify(lastErrors.slice(-6)));
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
page.on("request", (r) => inflight.set(r, `${r.method()} ${r.url().replace(base, "")}`));
page.on("requestfinished", (r) => inflight.delete(r));
page.on("requestfailed", (r) => inflight.delete(r));
page.on("console", (m) => m.type() === "error" && lastErrors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) =>
  failures.push(`page error: ${e.message.slice(0, 200)}`),
);
page.on("response", async (r) => {
  if (!armed || !r.url().includes("/api/") || r.status() < 400) return;
  const reply = (await r.text().catch(() => "")).slice(0, 300);
  const detail = `HTTP ${r.status()} ${r.request().method()} ${r.url().replace(base, "")} body=${(r.request().postData() ?? "").slice(0, 400)} reply=${reply}`;
  console.log(detail);
  if (r.status() >= 500) failures.push(detail);
  // A draft save the server refuses for a field is one the screen should have
  // held back (FB-020, R-DEC-56): the merchant sees "Couldn't save".
  if (
    r.status() === 400 &&
    /\/sales\/invoices/.test(r.url()) &&
    ["POST", "PATCH"].includes(r.request().method()) &&
    /validation_error/.test(reply)
  )
    failures.push(`refused save the screen let through: ${detail}`);
});
// MONKEY_TRACE=1: every bill write, with its body and the step, to replay a
// data finding exactly (the seed makes the run repeatable).
if (process.env.MONKEY_TRACE)
  page.on("request", (r) => {
    if (/\/sales\/invoices/.test(r.url()) && ["POST", "PATCH", "DELETE"].includes(r.method())) {
      const body = r.postData() ?? "";
      const lines = (body.match(/"description":"[^"]*"/g) ?? []).map((x) => x.slice(15, -1));
      console.log(`TRACE step ${log.length} ${r.method()} ${new URL(r.url()).pathname.replace("/api/v1", "")} lines=${JSON.stringify(lines)} at ${page.url().replace(base, "")} | last: ${log.slice(-2).join(" / ")}`);
    }
  });
page.on("requestfinished", (r) => {
  if (!armed || !r.url().includes("/api/")) return;
  const t = r.timing();
  calls.push({
    at: Date.now(),
    key: `${r.method()} ${new URL(r.url()).pathname.replace("/api/v1", "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")}`,
    ms: t.responseEnd > 0 ? Math.round(t.responseEnd) : null,
  });
});
/** Time until the screen shows its content: no busy region and no skeleton left. */
const readyAfter = async (t0) => {
  await page
    .waitForFunction(
      () =>
        document.querySelector("main") &&
        !document.querySelector("main [aria-busy=true], main [data-skeleton], main .animate-pulse"),
      null,
      { timeout: 10000 },
    )
    .catch(() => {});
  const ms = Date.now() - t0;
  // A slow page says WHAT kept it busy, so the failure can be traced, not guessed.
  if (ms > 5000) {
    lastBusy = await page
      .evaluate(() => {
        const e = document.querySelector("main [aria-busy=true], main [data-skeleton], main .animate-pulse");
        if (!e) return "nothing busy at the end (main missing until late?)";
        const at = (x) => `${x.tagName.toLowerCase()}${x.id ? `#${x.id}` : ""}${x.getAttribute("data-testid") ? `[data-testid=${x.getAttribute("data-testid")}]` : ""}`;
        const path = [];
        for (let x = e; x && x.tagName !== "MAIN" && path.length < 5; x = x.parentElement) path.unshift(at(x));
        return `${path.join(" > ")} ${e.outerHTML.slice(0, 160)}`;
      })
      .catch(() => "unreadable");
    lastBusy += ` · still open: ${[...inflight.values()].slice(0, 6).join(", ") || "none"}`;
  }
  return ms;
};
let lastBusy = null;
let lastT0 = Date.now();
const pageSpeed = async (why) => {
  const ready = await readyAfter(lastT0);
  const m = await page
    .evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null;
    })
    .catch(() => null);
  loads.push({ why, url: page.url().replace(base, ""), ready, busy: ready > 5000 ? lastBusy : undefined, ...(m ?? {}) });
};
const linesNow = async () =>
  (
    await page
      .locator("[data-testid=invoice-line] [data-part=name], [data-testid=invoice-line-card] [data-part=name]")
      .allInnerTexts()
      .catch(() => [])
  ).sort();
/**
 * After a reload or a return the bill must not be lost. Either the screen
 * still shows its lines, or — when the user came back to a fresh New bill —
 * the draft they left is on the server with those lines (it went on hold).
 * And the address must never name a draft the screen is not showing.
 */
const draftId = (u) => /\/sales\/invoices\/([0-9a-f-]{36})\/edit/.exec(u)?.[1] ?? null;
const serverLines = async (id) =>
  ((await (await ctx.request.get(`${base}/api/v1/sales/invoices/${id}`)).json().catch(() => ({}))).data?.lines ?? []).map(
    (l) => l.description,
  );
const checkKept = async (i, before, how, leftFrom) => {
  if (!before.length || !page.url().startsWith(`${base}/sales/invoices`)) return;
  await page.waitForTimeout(2500);
  const restore = page.getByRole("button", { name: /^(Restore|Keep|Continue|Use this)/i });
  if (await restore.count().catch(() => 0)) await restore.first().click().catch(() => {});
  await page.waitForTimeout(600);
  keptChecks += 1;
  const after = await linesNow();
  const shownId = draftId(page.url());
  if (shownId && !after.length && (await serverLines(shownId)).length)
    failures.push(`step ${i}: after ${how} the address names draft ${shownId} but the screen shows a blank bill`);
  let lost = before.filter((n) => !after.includes(n));
  if (lost.length && !after.length) {
    // A fresh New bill: the one left behind must be safe on the server.
    const leftId = draftId(leftFrom);
    if (leftId) {
      const saved = await serverLines(leftId);
      lost = lost.filter((n) => !saved.includes(n));
      if (!lost.length) keptOnServer += 1;
    }
  }
  if (lost.length && !after.length) {
    // Held (Hold saves it and opens a blank bill), or saved under an id the
    // address no longer names: look through the newest drafts, as a merchant
    // looks along the held strip.
    const recent = ((await (await ctx.request.get(`${base}/api/v1/sales/invoices?tab=draft&page_size=50`)).json().catch(() => ({}))).data ?? []);
    for (const d of recent) {
      const saved = await serverLines(d.id);
      if (lost.every((n) => saved.includes(n))) {
        lost = [];
        keptOnServer += 1;
        break;
      }
    }
  }
  if (lost.length) {
    // Not on the server yet, but kept on this device for the Restore offer:
    // a warning (the server is behind), not lost work.
    const device = await page.evaluate(() => Object.values(localStorage).join("\n")).catch(() => "");
    if (lost.every((n) => device.includes(n))) {
      onDeviceOnly.push(`step ${i}: ${lost.join(", ")} kept on this device only after ${how}`);
      lost = [];
    }
  }
  if (lost.length) failures.push(`step ${i}: after ${how} the bill lost ${lost.join(", ")} (had ${before.length}, now ${after.length}; left from ${leftFrom.replace(base, "")})`);
};
try {
  await page.goto(`${base}/login/email`);
  await page.fill("input[type=email]", "scale@digikhaato.test");
  await page.fill("input[type=password]", "Scale-Run-2026!");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  // Real item names, so "add item" types what a merchant would.
  const itemNames = (
    (await (await ctx.request.get(`${base}/api/v1/items?page_size=60&ordering=name`)).json().catch(() => ({}))).data ?? []
  ).map((x) => x.name);
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
  lastT0 = Date.now();
  await page.goto(url, { waitUntil: "networkidle" });
  await pageSpeed("start");
  await page.evaluate(() => {
    window.__long = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__long += e.duration;
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
  var heapStart = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0).catch(() => 0);
  armed = true;

  for (let i = 0; i < steps; i += 1) {
    // A run that has signed itself out tests nothing but the sign-in page, so
    // stop and say so plainly, with the last steps (see SKIP).
    if (new URL(page.url()).pathname.startsWith("/login")) {
      failures.push(`harness signed out before step ${i}; last: ${log.slice(-3).join(" | ")}`);
      break;
    }
    const kind = pick(["tap", "tap", "tap", "tap", "type", "type", "key", "scroll", "additem", "additem", "reload", "back", "wander"]);
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
        } else if (kind === "additem") {
          // As a merchant: part of a real name in the search, then a result.
          const box = page.getByRole("combobox").first();
          if (itemNames.length && (await box.count())) {
            const name = pick(itemNames);
            const part = name.slice(0, 3 + Math.floor(rand() * (name.length - 2)));
            log.push(`${i} add item "${part}"`);
            // Covered by a sheet or a dialog: a merchant would not reach it either.
            if (!(await box.click({ timeout: 1500 }).then(() => true).catch(() => false))) return;
            await page.keyboard.type(part, { delay: 15 });
            const opt = page.getByRole("option").first();
            await opt.waitFor({ timeout: 3000 }).catch(() => {});
            if (await opt.count()) await opt.click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(300);
            if (rand() < 0.7) await page.keyboard.press("Escape").catch(() => {});
          }
        } else if (kind === "reload") {
          const before = await linesNow();
          const leftFrom = page.url();
          log.push(`${i} reload (${before.length} lines)`);
          lastT0 = Date.now();
          await page.reload({ waitUntil: "load", timeout: 20000 });
          await pageSpeed("reload");
          await checkKept(i, before, "a reload", leftFrom);
        } else if (kind === "back") {
          const before = await linesNow();
          const leftFrom = page.url();
          const dir = pick(["back", "forward"]);
          log.push(`${i} ${dir}`);
          await (dir === "back" ? page.goBack({ timeout: 8000 }) : page.goForward({ timeout: 8000 })).catch(() => {});
          await page.waitForTimeout(300);
          if (!page.url().startsWith(`${base}/sales/invoices`)) {
            lastT0 = Date.now();
            await page.goto(url, { waitUntil: "load", timeout: 20000 });
            await pageSpeed("return");
          }
          await checkKept(i, before, `${dir} and return`, leftFrom);
        } else if (kind === "wander") {
          const before = await linesNow();
          const leftFrom = page.url();
          const to = pick(WANDER);
          log.push(`${i} wander to ${to} (${before.length} lines)`);
          lastT0 = Date.now();
          await page.goto(`${base}${to}`, { waitUntil: "load", timeout: 20000 });
          await pageSpeed(`wander ${to}`);
          for (let k = 0; k < 1 + Math.floor(rand() * 3); k += 1) {
            const there = await page.locator("button:visible, [role=tab]:visible").all();
            const safe = [];
            for (const t of there) {
              const n = ((await t.innerText({ timeout: 300 }).catch(() => "")) || "").trim();
              if (n && !SKIP.test(n)) safe.push(t);
            }
            if (safe.length) await pick(safe).click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(150);
            await page.keyboard.press("Escape").catch(() => {});
          }
          // Back the way a user comes back: Back, or the sidebar's Bills then New bill.
          if (rand() < 0.5) await page.goBack({ timeout: 8000 }).catch(() => {});
          else {
            lastT0 = Date.now();
            await page.goto(`${base}/sales/invoices`, { waitUntil: "load", timeout: 20000 });
            await pageSpeed("Bills list");
            // The clock for New bill starts at the tap, not at the list.
            lastT0 = Date.now();
            const tapped = await page.getByRole("link", { name: /New bill/ }).first().click({ timeout: 3000 }).then(() => true).catch(() => false);
            const moved = tapped && (await page.waitForURL(/\/sales\/invoices\/(new|[0-9a-f-]{36}\/edit)/, { timeout: 8000 }).then(() => true).catch(() => false));
            if (moved) await pageSpeed("New bill from the list");
            else log.push(`${i} (New bill could not be tapped on the list; came back by address)`);
          }
          if (!page.url().startsWith(`${base}/sales/invoices/`)) {
            lastT0 = Date.now();
            await page.goto(url, { waitUntil: "load", timeout: 20000 });
            await pageSpeed("return");
          }
          await checkKept(i, before, `leaving for ${to} and coming back`, leftFrom);
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
          // A burst: the same call more than 15 times in 5 s is a loop, not a user.
          const now = Date.now();
          const recent = calls.filter((c) => now - c.at < 5000);
          const per = {};
          for (const c of recent) per[c.key] = (per[c.key] ?? 0) + 1;
          for (const [k, n] of Object.entries(per))
            if (n > 15) failures.push(`step ${i}: ${k} sent ${n} times in 5 s (request loop)`);
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
  var heapEnd = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0).catch(() => 0);
  var longMs = await page.evaluate(() => window.__long ?? 0).catch(() => 0);
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
// API and speed summary.
for (const w of onDeviceOnly) console.log(`WARN ${w}`);
console.log(`data: ${keptChecks} reload/return checks ran on a bill with lines (${keptOnServer} came back to a fresh bill; the one left was found on the server)`);
if (steps >= 100 && path.startsWith('/sales/invoices') && keptChecks === 0) failures.push('no reload/return ever happened with lines on the bill: the data check proved nothing');
const byKey = {};
for (const c of calls) (byKey[c.key] ??= []).push(c.ms ?? 0);
const top = Object.entries(byKey).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
const allMs = calls.map((c) => c.ms ?? 0);
console.log(`api: ${calls.length} calls · p50 ${q(allMs, 0.5)} ms · p95 ${q(allMs, 0.95)} ms · slowest ${Math.max(0, ...allMs)} ms`);
for (const [k, ms] of top) console.log(`  ${String(ms.length).padStart(4)} × ${k} (p95 ${q(ms, 0.95)} ms)`);
const readyMs = loads.map((l) => l.ready);
const worst = loads.reduce((a, l) => (l.ready > (a?.ready ?? -1) ? l : a), null);
console.log(`pages: ${loads.length} loads · content shown p50 ${q(readyMs, 0.5)} ms · p95 ${q(readyMs, 0.95)} ms · worst ${worst?.ready ?? 0} ms (${worst?.url ?? "-"}, ${worst?.why ?? ""})`);
if (typeof heapStart !== "undefined" && heapStart)
  console.log(`heap: ${(heapStart / 1e6).toFixed(1)} → ${(heapEnd / 1e6).toFixed(1)} MB (last page) · long tasks since start ${Math.round(longMs)} ms`);
for (const l of loads) if (l.ready > 5000) failures.push(`slow page: ${l.url} took ${l.ready} ms to show its content (${l.why}); busy: ${l.busy ?? "-"}`);
const slowApi = calls.filter((c) => (c.ms ?? 0) > 3000);
for (const c of slowApi.slice(0, 5)) failures.push(`slow API: ${c.key} took ${c.ms} ms`);
writeFileSync(`${dir}/monkey-${seed}-${width}.api.json`, JSON.stringify({ calls, loads }, null, 1));
for (const f of failures) console.log("FAIL", f);
if (failures.length)
  console.log(
    `replay: node e2e/monkey.mjs --path=${path} --seed=${seed} --steps=${steps} --width=${width}${setup ? ` --setup=${setup}` : ""}`,
  );
console.log(`verdict: ${failures.length ? `FAIL (${failures.length})` : 'PASS'}`);
process.exitCode = failures.length ? 1 : 0;
