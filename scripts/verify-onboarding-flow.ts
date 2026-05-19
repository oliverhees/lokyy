#!/usr/bin/env bun
/**
 * scripts/verify-onboarding-flow.ts
 *
 * Tests the user-facing onboarding flow after a successful install:
 *
 *   1. /setup with no session  → 302/redirect to /login (owner-gate works)
 *   2. /login with no session  → renders email + password form
 *   3. Login as the owner       → lands on /dashboard
 *   4. /dashboard               → real Lokyy stat cards render (not the
 *                                 Hermes-Workspace mock that was here pre-PR #128)
 *   5. Logout                   → back to /login, session cleared
 *
 * What this test does NOT cover: the /setup form submit itself. After a
 * successful first install only the owner exists, /setup is locked, and
 * there is no UI path to create a second user (Lokyy Personal = single
 * owner per instance). The /setup component is the same one rendered on
 * a fresh install where owner-gate returns false; the fresh-install
 * dry-run separately proved that path builds and serves correctly.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT_DIR = "docs/evidence/audit-2026-05-19";

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

// ── 1. /setup gate: no session, owner exists → redirect to /login ─────────
// The redirect lives in TanStack Router's beforeLoad — it fires AFTER the
// SPA hydrates and resolves the owner-exists fetch, so networkidle isn't
// enough on its own.
await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
await page
  .waitForURL("**/login", { timeout: 10_000 })
  .catch(() => {});
if (!page.url().endsWith("/login")) {
  console.error(`✗ /setup did not redirect to /login (landed on ${page.url()})`);
  await browser.close();
  process.exit(1);
}
console.log("✓ /setup → /login (owner-gate active)");

// ── 2. /login form renders with email + password fields ───────────────────
const emailInput = page.locator('input#email[type="email"]');
const passwordInput = page.locator('input#password[type="password"]');
if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
  console.error("✗ /login form is missing email or password input");
  await browser.close();
  process.exit(1);
}
console.log("✓ /login form has email + password inputs");

// ── 3. Login as existing owner ────────────────────────────────────────────
await emailInput.fill("oliver@lokyy.local");
await passwordInput.fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
console.log("✓ submitted login → landed on /dashboard");

// ── 4. /dashboard renders the new Lokyy stat cards (post-PR #128) ─────────
await page.waitForTimeout(1500);
const body = await page.evaluate(() => document.body.innerText ?? "");
const mockMarkers = ["Toby Belhome", "+4850", "shadcnuikit.com", "Latest Payments"];
const leaked = mockMarkers.filter((m) => body.includes(m));
if (leaked.length > 0) {
  console.error(`✗ Hermes-Workspace mock content visible: ${leaked.join(", ")}`);
  await page.screenshot({ path: `${SHOT_DIR}/onboarding-flow.png` });
  await browser.close();
  process.exit(1);
}
const statCount = await page
  .locator("[data-testid='dashboard-stats'] > *")
  .count()
  .catch(() => 0);
if (statCount !== 4) {
  console.error(`✗ expected 4 stat cards on /dashboard, got ${statCount}`);
  await browser.close();
  process.exit(1);
}
console.log(`✓ /dashboard renders ${statCount} real Lokyy stat cards`);

// ── 5. Logout → back to /login + session cleared ──────────────────────────
// Open the sidebar nav-user dropdown, click Log out.
await page.locator("[data-testid='nav-user-trigger']").click();
await page.waitForTimeout(400);
// Find the 'Log out' menu item (radix dropdown menu)
const logoutItem = page.getByRole("menuitem", { name: /log out/i });
if ((await logoutItem.count()) === 0) {
  console.error("✗ Log-out menuitem not found in nav-user dropdown");
  await browser.close();
  process.exit(1);
}
await logoutItem.first().click();
await page.waitForURL("**/login", { timeout: 10_000 });
console.log("✓ logout → /login");

// Confirm session is gone: visiting /dashboard now should redirect to /login again
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
if (!page.url().endsWith("/login")) {
  console.error(`✗ /dashboard after logout should redirect to /login (landed on ${page.url()})`);
  await browser.close();
  process.exit(1);
}
console.log("✓ session cleared — /dashboard redirects to /login");

await page.screenshot({ path: `${SHOT_DIR}/onboarding-flow.png`, fullPage: false });
await browser.close();
console.log(`✓ screenshot: ${SHOT_DIR}/onboarding-flow.png`);
console.log("✓ Onboarding flow verified (setup-gate, login, dashboard, logout)");
