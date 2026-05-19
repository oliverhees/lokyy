#!/usr/bin/env bun
/**
 * scripts/verify-n8n-removed.ts — Playwright check for #131.
 *
 *   - sidebar no longer contains an n8n entry
 *   - /n8n returns 404 (or whatever the router catch-all renders)
 *   - /settings has no "n8n — Embed-URL" card
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/n8n-removed.png";

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
await page.waitForTimeout(1000);
console.log("✓ logged in");

// ── sidebar ────────────────────────────────────────────────────────────────
const sidebarText = await page
  .locator("[data-slot='sidebar'], aside, nav")
  .first()
  .innerText()
  .catch(() => "");
if (/\bn8n\b/i.test(sidebarText)) {
  console.error("✗ sidebar still contains an n8n entry");
  console.error("  excerpt:", sidebarText.slice(0, 400).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ sidebar contains no n8n entry");

// ── /n8n must NOT render a working page ────────────────────────────────────
const resp = await page.goto(`${BASE}/n8n`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const n8nBody = await page.evaluate(() => document.body.innerText ?? "");
// Either the router renders a 404 / not-found, or it redirects somewhere
// safe. Either way the page must NOT show n8n-iframe content or the old
// route's title.
const stillHasN8nUI = /iframe deiner n8n|n8n.*embed|n8n.*iframe/i.test(n8nBody);
if (stillHasN8nUI) {
  console.error("✗ /n8n still renders n8n-iframe content");
  console.error("  body excerpt:", n8nBody.slice(0, 300).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /n8n no longer renders (HTTP ${resp?.status() ?? "?"}, no embed)`);

// ── /settings n8n card must be gone ────────────────────────────────────────
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const settingsBody = await page.evaluate(() => document.body.innerText ?? "");
if (/n8n.*embed-url|n8n.*iframe|n8n-Instanz/i.test(settingsBody)) {
  console.error("✗ /settings still contains an n8n card");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ /settings no longer contains an n8n card");

await page.screenshot({ path: SHOT, fullPage: false });
await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ n8n removal verified (Issue #131)");
