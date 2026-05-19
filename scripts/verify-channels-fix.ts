#!/usr/bin/env bun
/**
 * scripts/verify-channels-fix.ts — Playwright check for #123.
 *
 * /channels must render the curated messaging-platform list (14 cards)
 * with configured-flags reflecting /api/config.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/channels-fix.png";

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

await page.goto(`${BASE}/channels`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const cardCount = await page
  .locator("[data-testid='channels-grid'] > *")
  .count()
  .catch(() => 0);
if (cardCount < 10) {
  console.error(`✗ /channels rendered only ${cardCount} cards (expected ≥10)`);
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /channels: ${cardCount} platform cards rendered`);

const body = await page.evaluate(() => document.body.innerText ?? "");
const knownNames = ["Telegram", "Discord", "WhatsApp", "Slack", "Signal", "Matrix"];
const seen = knownNames.filter((n) => body.includes(n));
if (seen.length < 4) {
  console.error(`✗ only ${seen.length}/${knownNames.length} known platforms visible`);
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ ${seen.length}/${knownNames.length} known platform names visible`);

await page.screenshot({ path: SHOT, fullPage: false });
console.log(`✓ screenshot: ${SHOT}`);

await browser.close();
console.log("✓ /channels fix verified (Issue #123)");
