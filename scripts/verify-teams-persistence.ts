#!/usr/bin/env bun
/**
 * scripts/verify-teams-persistence.ts — Playwright check for #139.
 *
 * Final P2 persistence slice. Mirrors verify-jobs and verify-prompts:
 * empty → create → reload-persists → delete → empty.
 *
 * The team form has a multi-select for memberAgentIds — we don't
 * exercise that in the E2E (it depends on the agents list at run
 * time and would make the test brittle). The CREATE-with-zero-members
 * path is enough to prove persistence.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/teams-persistence.png";

async function cleanLeftovers() {
  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  const cookie = login.headers.getSetCookie().join("; ");
  const list = await fetch(`${BASE}/api/lokyy/teams`, { headers: { cookie } });
  const data = (await list.json()) as { teams: Array<{ id: string }> };
  for (const t of data.teams) {
    await fetch(`${BASE}/api/lokyy/teams/${t.id}`, { method: "DELETE", headers: { cookie } });
  }
  console.log(`  cleanup: removed ${data.teams.length} leftover teams`);
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

await page.goto(`${BASE}/teams`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

if ((await page.locator("[data-testid='teams-empty']").count()) === 0) {
  console.error("✗ /teams not showing empty-state at start");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ /teams starts in empty-state");

await page.locator("[data-testid='teams-add']").click();
await page.waitForSelector("[data-testid='team-form-name']", { timeout: 5_000 });
await page.locator("[data-testid='team-form-name']").fill("Research-Squad");
await page.locator("#team-desc").fill("Schreibt Reports und sammelt Quellen.");
await page.locator("[data-testid='team-form-save']").click();

await page.waitForSelector("[data-testid='teams-grid']", { timeout: 5_000 });
const gridText = await page.locator("[data-testid='teams-grid']").innerText();
if (!gridText.includes("Research-Squad")) {
  console.error("✗ created team missing from grid");
  console.error("  excerpt:", gridText.slice(0, 400));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ card appears with name");

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const reloadedText = await page
  .locator("[data-testid='teams-grid']")
  .innerText()
  .catch(() => "");
if (!reloadedText.includes("Research-Squad")) {
  console.error("✗ team lost after reload — persistence broken");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ card persists after page reload");

await page.screenshot({ path: SHOT, fullPage: false });

page.on("dialog", (d) => void d.accept());
await page.locator("[data-testid^='team-delete-']").first().click();
await page.waitForTimeout(800);
if ((await page.locator("[data-testid='teams-empty']").count()) === 0) {
  console.error("✗ /teams not back to empty-state after delete");
  await browser.close();
  process.exit(1);
}
console.log("✓ row deleted, /teams back to empty-state");

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /teams persistence verified (Issue #139)");
