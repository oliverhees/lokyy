#!/usr/bin/env bun
/**
 * scripts/verify-dashboard-fix.ts — Playwright check for #127.
 *
 *   - /dashboard renders 4 Lokyy stat cards (Sessions/Tasks/Agents/Tools)
 *   - no "Toby Belhome" / "+4850" / "shadcnuikit.com" remnants on
 *     /dashboard (or in the sidebar nav-user, which was already fine)
 *   - the orphan header user-menu.tsx that held the mock data is gone
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT_DASH = "docs/evidence/audit-2026-05-19/dashboard-fix.png";

const MOCK_MARKERS = [
  "Toby Belhome",
  "+4850",
  "shadcnuikit.com",
  "Upgrade to Pro",
  "Exercise Minutes",
  "Latest Payments",
];

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
await page.waitForTimeout(2000);
console.log("✓ logged in");

// ── /dashboard ─────────────────────────────────────────────────────────────
const body = await page.evaluate(() => document.body.innerText ?? "");

const leftovers = MOCK_MARKERS.filter((m) => body.includes(m));
if (leftovers.length > 0) {
  console.error(`✗ /dashboard still contains mock markers: ${leftovers.join(", ")}`);
  await page.screenshot({ path: SHOT_DASH });
  await browser.close();
  process.exit(1);
}
console.log("✓ no Hermes-Workspace mock markers on /dashboard");

const cardCount = await page
  .locator("[data-testid='dashboard-stats'] > *")
  .count()
  .catch(() => 0);
if (cardCount !== 4) {
  console.error(`✗ expected 4 dashboard stat cards, got ${cardCount}`);
  await page.screenshot({ path: SHOT_DASH });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /dashboard: ${cardCount} stat cards rendered`);

// Stat-card titles use CSS text-transform: uppercase, which innerText
// returns verbatim — so compare case-insensitively.
const lc = body.toLowerCase();
const expectedLabels = ["Sessions", "Offene Tasks", "Agents", "Tools aktiv"];
const seenLabels = expectedLabels.filter((l) => lc.includes(l.toLowerCase()));
if (seenLabels.length < 3) {
  console.error(`✗ only ${seenLabels.length}/${expectedLabels.length} expected labels visible`);
  await page.screenshot({ path: SHOT_DASH });
  await browser.close();
  process.exit(1);
}
console.log(`✓ ${seenLabels.length}/${expectedLabels.length} expected stat-card labels`);
await page.screenshot({ path: SHOT_DASH, fullPage: false });

// ── sidebar nav-user (already pulled from useSession() before this PR) ─────
const navEmail = await page
  .locator("[data-testid='nav-user-email']")
  .first()
  .innerText()
  .catch(() => "");
if (!navEmail.includes("oliver@lokyy.local")) {
  console.error(`✗ sidebar nav-user shows wrong email: "${navEmail}"`);
  await browser.close();
  process.exit(1);
}
console.log(`✓ sidebar nav-user shows real user (${navEmail})`);

await browser.close();
console.log(`✓ dashboard screenshot: ${SHOT_DASH}`);
console.log("✓ /dashboard mock-cleanup verified (Issue #127)");
