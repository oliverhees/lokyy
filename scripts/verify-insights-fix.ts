#!/usr/bin/env bun
/**
 * scripts/verify-insights-fix.ts
 *
 * Playwright verification for GitHub Issue #116 — confirms /insights
 * renders real aggregated numbers (sessions/messages/tool calls/tokens/
 * active time) instead of the Phase-1d "not deployed" stub with all zeros.
 *
 * Acceptance:
 *   - login succeeds
 *   - /insights does NOT contain "not deployed" / "nicht deployed" / "Phase-2"
 *   - the 4 stat cards (Sessions, Messages, Tool Calls, Total Tokens) render
 *   - sessions value is > 0 (we know there are 20 real sessions on this dev box)
 *   - totalTokens value is > 0 (we know it's ~499K)
 *   - screenshot saved to docs/evidence/audit-2026-05-19/insights-fix.png
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/insights-fix.png";

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

await page.goto(`${BASE}/insights`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const body = await page.evaluate(() => document.body.innerText ?? "");

const stubMarkers = [
  "not deployed",
  "nicht deployed",
  "Phase-2",
  "phase-2 of the lokyy roadmap",
];
const hitStub = stubMarkers.find((m) => body.toLowerCase().includes(m.toLowerCase()));
if (hitStub) {
  console.error(`✗ /insights still shows stub marker: "${hitStub}"`);
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}

const labels = ["Sessions", "Messages", "Tool Calls", "Total Tokens"];
const missing = labels.filter((l) => !body.includes(l));
if (missing.length > 0) {
  console.error(`✗ missing stat-card labels: ${missing.join(", ")}`);
  console.error("  body excerpt:", body.slice(0, 400).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ all 4 stat-card labels rendered`);

// Read the actual rendered numbers from the StatCards
const stats = await page.evaluate(() => {
  const out: Record<string, string> = {};
  const cards = document.querySelectorAll("[data-testid='insights-stats'] > *");
  cards.forEach((card) => {
    const t = (card as HTMLElement).innerText ?? "";
    const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      out[lines[0]!] = lines[1]!;
    }
  });
  return out;
});
console.log(`  values: ${JSON.stringify(stats)}`);

// Sessions value should be > 0 on this dev box
const sessionsRaw = stats["Sessions"] ?? "0";
const sessionsNum = Number.parseInt(sessionsRaw.replace(/[^0-9]/g, ""), 10);
if (!Number.isFinite(sessionsNum) || sessionsNum <= 0) {
  console.error(`✗ Sessions value not > 0: "${sessionsRaw}"`);
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ Sessions = ${sessionsNum} (> 0)`);

const tokensRaw = stats["Total Tokens"] ?? "0";
const tokensNum = Number.parseInt(tokensRaw.replace(/[^0-9]/g, ""), 10);
if (!Number.isFinite(tokensNum) || tokensNum <= 0) {
  console.error(`✗ Total Tokens not > 0: "${tokensRaw}"`);
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ Total Tokens = ${tokensNum.toLocaleString()} (> 0)`);

await page.screenshot({ path: SHOT, fullPage: false });
console.log(`✓ screenshot: ${SHOT}`);

await browser.close();
console.log("✓ /insights fix verified (Issue #116)");
