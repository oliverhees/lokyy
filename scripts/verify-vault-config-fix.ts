#!/usr/bin/env bun
/**
 * scripts/verify-vault-config-fix.ts — Playwright check for #133.
 *
 * LOKYY_VAULT_PATH isn't set on this dev box, so /vault should render
 * the empty-state. The new empty-state must include actionable setup
 * instructions (docker-compose mount + .env.local), not just a one-
 * line hint.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/vault-config-fix.png";

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

await page.goto(`${BASE}/vault`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const emptyCard = page.locator("[data-testid='vault-empty']");
if ((await emptyCard.count()) === 0) {
  console.error("✗ vault-empty card missing — LOKYY_VAULT_PATH might be set unexpectedly");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ vault-empty card rendered (LOKYY_VAULT_PATH unset, as expected)");

const cardText = await emptyCard.innerText();
const requiredMarkers = [
  "Kein Obsidian-Vault konfiguriert",
  "docker-compose.yml",
  "LOKYY_VAULT_PATH",
  ".env.local",
  "lokyy-os-be",
];
const missing = requiredMarkers.filter((m) => !cardText.includes(m));
if (missing.length > 0) {
  console.error(`✗ empty-state missing setup markers: ${missing.join(", ")}`);
  console.error("  card text:", cardText.slice(0, 500).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ empty-state includes all ${requiredMarkers.length} setup markers`);

await page.screenshot({ path: SHOT, fullPage: false });
await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /vault config-help verified (Issue #133)");
