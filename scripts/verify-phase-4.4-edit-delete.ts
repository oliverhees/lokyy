#!/usr/bin/env bun
/**
 * scripts/verify-phase-4.4-edit-delete.ts
 *
 * UI verification for Dashboard edit + delete flows.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";

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

console.log("─── Login + create test dashboard ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Passwort").fill(PASSWORD);
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle" });
await page.getByTestId("dashboards-create").click();
const seed = `Edit-Delete-Test ${Date.now()}`;
await page.getByTestId("dashboards-intent-input").fill(seed);
await page.getByTestId("dashboards-create-submit").click();
await page.waitForURL(/\/dashboards\/[a-z0-9-]+$/, { timeout: 10_000 });
const dashboardUrl = page.url();
ok(`dashboard created → ${dashboardUrl.replace(BASE, "")}`);

// ─── A. Edit ───────────────────────────────────────────────────────────────
console.log("");
console.log("─── A. Edit (rename + reschedule) ───");
await page.getByTestId("dashboard-edit").click();
const titleInput = page.getByTestId("dashboard-edit-title");
await titleInput.waitFor({ state: "visible", timeout: 3_000 });
ok("edit-dialog opens");

const newTitle = `Renamed ${Date.now() % 10000}`;
await titleInput.fill(newTitle);
await page.getByTestId("dashboard-edit-schedule").fill("30 9 * * *");
await page.getByTestId("dashboard-edit-save").click();

// Wait for the dialog to close + title to update on the page
try {
  await page.waitForFunction(
    (expectedTitle) => {
      const h1 = document.querySelector("h1");
      return h1?.textContent?.trim() === expectedTitle;
    },
    newTitle,
    { timeout: 5_000 }
  );
  ok(`title updated to '${newTitle}' on the page`);
} catch {
  fail("title update", "h1 didn't change");
}

// Schedule shown in meta-panel
const metaText = await page.getByTestId("dashboard-meta-panel").innerText();
if (metaText.includes("30 9 * * *")) {
  ok("schedule updated to '30 9 * * *' in meta-panel");
} else {
  fail("schedule update", `not visible in meta-panel: ${metaText.slice(0, 200)}`);
}

// ─── B. Bad schedule rejected ──────────────────────────────────────────────
console.log("");
console.log("─── B. Bad-cron rejected ───");
await page.getByTestId("dashboard-edit").click();
await page.getByTestId("dashboard-edit-schedule").fill("not a cron");
await page.getByTestId("dashboard-edit-save").click();
try {
  await page.waitForFunction(
    () => document.body.innerText.includes("invalid_schedule"),
    { timeout: 3_000 }
  );
  ok("invalid cron rejected (error shown in dialog)");
} catch {
  fail("bad-cron", "no error shown");
}
// Close dialog
await page.keyboard.press("Escape");

// ─── C. Delete ─────────────────────────────────────────────────────────────
console.log("");
console.log("─── C. Delete ───");
await page.getByTestId("dashboard-delete").click();
const confirmBtn = page.getByTestId("dashboard-delete-confirm");
await confirmBtn.waitFor({ state: "visible", timeout: 3_000 });
ok("delete-confirm dialog opens");
await confirmBtn.click();
try {
  await page.waitForURL(`${BASE}/dashboards`, { timeout: 5_000 });
  ok("navigated back to /dashboards after delete");
} catch {
  fail("navigation", `still on ${page.url()}`);
}

// Confirm the deleted dashboard is gone from the list
await page.waitForTimeout(1500);
const stillThere = await page.locator(`text=${newTitle}`).count();
if (stillThere === 0) ok("deleted dashboard is no longer in the list");
else fail("delete from list", `still ${stillThere} match(es)`);

console.log("");
// The bad-cron test deliberately triggers a 400 — that logs as a
// "Failed to load resource" console error in Chrome but is the
// expected API contract. Filter those out before the assertion.
const unexpected = consoleErrors.filter(
  (e) => !/Failed to load resource.*status of 400/.test(e)
);
if (unexpected.length === 0) ok(`0 unexpected console errors (${consoleErrors.length - unexpected.length} expected 400s filtered)`);
else fail("console", `${unexpected.length}: ${unexpected.slice(0, 2).join(" | ")}`);

await browser.close();
console.log("");
console.log(`Phase-4.4 edit/delete verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
