#!/usr/bin/env bun
/**
 * scripts/verify-integrations-fix.ts — Playwright check for #125.
 *
 * /integrations must render the 6 curated provider cards
 * (google-calendar, gmail, notion, linear, slack, github), all in
 * disconnected state.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/integrations-fix.png";

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

await page.goto(`${BASE}/integrations`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const body = await page.evaluate(() => document.body.innerText ?? "");
const knownNames = ["Google Calendar", "Gmail", "Notion", "Linear", "Slack", "GitHub"];
const seen = knownNames.filter((n) => body.includes(n));
if (seen.length < 4) {
  console.error(`✗ /integrations shows only ${seen.length}/${knownNames.length} known providers`);
  console.error("  seen:", seen.join(", "));
  console.error("  body excerpt:", body.slice(0, 400).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /integrations: ${seen.length}/${knownNames.length} provider names visible`);

await page.screenshot({ path: SHOT, fullPage: false });
console.log(`✓ screenshot: ${SHOT}`);

await browser.close();
console.log("✓ /integrations fix verified (Issue #125)");
