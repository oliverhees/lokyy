#!/usr/bin/env bun
/**
 * scripts/verify-admin-buttons-fix.ts — Playwright check for #129.
 *
 * /settings → Hermes Admin card has 3 buttons (System-Check / Backup /
 * Curator-Status). Each used to print the "Hermes Agent is not deployed
 * yet" lie. After PR #129 they return real CLI output (doctor + curator)
 * or an honest "not yet wired" message (backup).
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/admin-buttons-fix.png";

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

await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Doctor click — wait until the Doctor <pre> output appears (or a timeout)
await page.locator("[data-testid='admin-doctor']").click();
await page
  .getByText(/Hermes Doctor|Python Environment|Security Advisories/i)
  .first()
  .waitFor({ state: "visible", timeout: 10_000 })
  .catch(() => {});
const afterDoctor = await page.evaluate(() => document.body.innerText ?? "");
if (/is not deployed yet|phase-2 of the lokyy roadmap/i.test(afterDoctor)) {
  console.error("✗ Doctor output still contains the not-deployed stub text");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
if (!/Hermes Doctor|Python|Security Advisories/i.test(afterDoctor)) {
  console.error("✗ Doctor output missing real diagnostic markers");
  console.error("  excerpt:", afterDoctor.slice(-500).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ Doctor returns real diagnostic output");

// Curator click
await page.locator("[data-testid='admin-curator']").click();
await page
  .getByText(/curator: ENABLED|curator: DISABLED|interval/i)
  .first()
  .waitFor({ state: "visible", timeout: 10_000 })
  .catch(() => {});
const afterCurator = await page.evaluate(() => document.body.innerText ?? "");
if (!/curator: ENABLED|curator: DISABLED|interval|last run|last summary/i.test(afterCurator)) {
  console.error("✗ Curator output missing real status markers");
  console.error("  excerpt:", afterCurator.slice(-500).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ Curator returns real status output");

// Backup click
await page.locator("[data-testid='admin-backup']").click();
await page
  .getByText(/noch nicht verdrahtet|hermes backup/i)
  .first()
  .waitFor({ state: "visible", timeout: 10_000 })
  .catch(() => {});
const afterBackup = await page.evaluate(() => document.body.innerText ?? "");
if (/is not deployed yet|phase-2 of the lokyy roadmap/i.test(afterBackup)) {
  console.error("✗ Backup output still contains the not-deployed stub text");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
if (!/noch nicht verdrahtet|hermes backup/i.test(afterBackup)) {
  console.error("✗ Backup output missing honest 'not wired' message");
  console.error("  excerpt:", afterBackup.slice(-500).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ Backup returns honest 'not yet wired' message (state-changing, deferred)");

await page.screenshot({ path: SHOT, fullPage: false });
await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ admin buttons cleanup verified (Issue #129)");
