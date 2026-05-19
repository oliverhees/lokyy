#!/usr/bin/env bun
/**
 * scripts/verify-jobs-persistence.ts — Playwright check for #135.
 *
 * E2E flow:
 *   1. login
 *   2. /jobs renders empty-state at start (cleanup any leftover rows
 *      first via DELETE-all curl)
 *   3. open "Neuer Job" dialog, fill schedule + prompt + name, submit
 *   4. row appears in the list with the chosen schedule
 *   5. delete the row → list returns to empty-state
 *
 * Verifies that the new sqlite-backed router actually persists and
 * deletes; the Phase-1d echo-stub never wrote anything.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/jobs-persistence.png";

// ── Cleanup leftover rows via the API so the test starts deterministic ────
async function cleanLeftovers() {
  const cookieJar = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "oliver@lokyy.local",
      password: "supersecure123",
    }),
  });
  const cookie = cookieJar.headers.getSetCookie().join("; ");
  if (!cookie) {
    console.error("✗ failed to log in for cleanup");
    process.exit(1);
  }
  const list = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
  const { jobs } = (await list.json()) as { jobs: Array<{ id: string }> };
  for (const j of jobs) {
    await fetch(`${BASE}/api/lokyy/jobs/${j.id}`, { method: "DELETE", headers: { cookie } });
  }
  console.log(`  cleanup: removed ${jobs.length} leftover jobs`);
}

await cleanLeftovers();

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
console.log("✓ logged in");

await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// ── empty state ─────────────────────────────────────────────────────────
if ((await page.locator("[data-testid='jobs-empty']").count()) === 0) {
  console.error("✗ /jobs not showing empty-state at start");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ /jobs starts in empty-state");

// ── open dialog + fill form ─────────────────────────────────────────────
await page.locator("[data-testid='jobs-add']").click();
await page.waitForSelector("[data-testid='job-form-schedule']", { timeout: 5_000 });
await page.locator("[data-testid='job-form-name']").fill("Audit-Test Job");
await page.locator("[data-testid='job-form-schedule']").fill("0 9 * * *");
await page.locator("[data-testid='job-form-prompt']").fill("Audit-Test prompt — Hermes wird hier später angerufen.");
await page.locator("[data-testid='job-form-save']").click();

// ── list shows the new row ──────────────────────────────────────────────
await page.waitForSelector("[data-testid='jobs-list']", { timeout: 5_000 });
const listText = await page.locator("[data-testid='jobs-list']").innerText();
if (!listText.includes("Audit-Test Job")) {
  console.error("✗ created job name missing from list");
  console.error("  list text:", listText.slice(0, 400));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
if (!listText.includes("0 9 * * *")) {
  console.error("✗ created job schedule missing from list");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ row appears with name + schedule");

// ── reload page and confirm persistence survives ────────────────────────
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const reloadedListText = await page
  .locator("[data-testid='jobs-list']")
  .innerText()
  .catch(() => "");
if (!reloadedListText.includes("Audit-Test Job")) {
  console.error("✗ created job lost after page reload — persistence broken");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ row persists after page reload");

await page.screenshot({ path: SHOT, fullPage: false });

// ── delete via the row's trash button ───────────────────────────────────
const deleteButton = page.locator("[data-testid^='job-delete-']").first();
// dialog confirm comes from window.confirm — auto-accept it
page.on("dialog", (d) => void d.accept());
await deleteButton.click();
await page.waitForTimeout(800);
if ((await page.locator("[data-testid='jobs-empty']").count()) === 0) {
  console.error("✗ /jobs not back to empty-state after delete");
  await browser.close();
  process.exit(1);
}
console.log("✓ row deleted, /jobs back to empty-state");

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /jobs persistence verified (Issue #135)");
