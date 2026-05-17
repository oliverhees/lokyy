#!/usr/bin/env bun
/**
 * scripts/verify-phase-4.2-real-producer.ts
 *
 * End-to-end: create a KI-News dashboard via the UI, click "Jetzt laufen",
 * verify real HackerNews-filtered AI/ML stories appear in the iframe.
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const SCREENSHOT_DIR = resolve("docs/evidence/phase-4");
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

const consoleErrors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

console.log("─── Login ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Passwort").fill(PASSWORD);
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

console.log("");
console.log("─── Create fresh KI-News dashboard ───");
await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle" });
await page.getByTestId("dashboards-create").click();
const intent = `KI-News real-world ${Date.now()}`;
await page.getByTestId("dashboards-intent-input").fill(intent);
await page.getByTestId("dashboards-create-submit").click();
await page.waitForURL(/\/dashboards\/[a-z0-9-]+$/, { timeout: 10_000 });
const dashboardUrl = page.url();
ok(`dashboard created → ${dashboardUrl.replace(BASE, "")}`);

console.log("");
console.log("─── Click 'Jetzt laufen' (real HN fetch) ───");
const runBtn = page.getByTestId("dashboard-run-now");
await runBtn.waitFor({ state: "visible", timeout: 5_000 });
await runBtn.click();

// Wait for the button to leave "Läuft…" state (running -> finished)
try {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="dashboard-run-now"]') as HTMLButtonElement | null;
      return btn !== null && !btn.disabled && (btn.textContent ?? "").includes("Jetzt laufen");
    },
    { timeout: 45_000 }
  );
  ok("run completed (button back to idle)");
} catch (err) {
  fail("run timeout", String(err).slice(0, 120));
}

console.log("");
console.log("─── Verify iframe shows real HN stories ───");
// Wait a moment for the iframe postMessage data push
await page.waitForTimeout(2000);
const frame = page.frame({ url: /dashboards\/.*\/view$/ });
if (!frame) {
  fail("iframe", "no iframe frame found");
} else {
  // Wait for the "Wird geladen" placeholder to be replaced
  try {
    await frame.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".card");
        return cards.length >= 3;
      },
      { timeout: 15_000 }
    );
    const cardCount = await frame.locator(".card").count();
    ok(`iframe rendered ${cardCount} story cards`);

    // Sample first card to make sure it has real content
    const firstTitle = await frame.locator(".card .card-title").first().innerText();
    const firstSource = await frame.locator(".card .card-source").first().innerText();
    if (firstTitle.length > 5) ok(`first story: "${firstTitle.slice(0, 60)}…"`);
    else fail("story content", "title too short");
    if (firstSource.includes("Hacker News")) ok("source is Hacker News");
    else fail("source", `unexpected: ${firstSource}`);
  } catch {
    const bodyText = (await frame.evaluate(() => document.body.innerText)).slice(0, 200);
    fail("iframe content", `cards never appeared; visible: "${bodyText}"`);
  }
}

console.log("");
console.log("─── Screenshot ───");
await page.screenshot({
  path: `${SCREENSHOT_DIR}/dashboard-real-data.png`,
  fullPage: false,
});
ok("screenshot saved → docs/evidence/phase-4/dashboard-real-data.png");

console.log("");
console.log("─── Console health ───");
if (consoleErrors.length === 0) {
  ok("0 console errors");
} else {
  fail("console", `${consoleErrors.length}: ${consoleErrors.slice(0, 2).join(" | ")}`);
}

await browser.close();

console.log("");
console.log(`Phase-4.2 real-world verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
