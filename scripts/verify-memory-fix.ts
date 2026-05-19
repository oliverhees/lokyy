#!/usr/bin/env bun
/**
 * scripts/verify-memory-fix.ts — Playwright check for #121.
 *
 * /memory must show real provider names parsed from `hermes memory status`
 * (8 on this dev box) instead of the Phase-1d empty stub.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/memory-fix.png";

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

await page.goto(`${BASE}/memory`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const body = await page.evaluate(() => document.body.innerText ?? "");
if (/not deployed|nicht deployed|phase-2 of the lokyy roadmap/i.test(body)) {
  console.error("✗ /memory still shows the not-deployed stub text");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}

// At least 5 of the 8 known providers should be visible
const knownProviders = [
  "byterover",
  "hindsight",
  "holographic",
  "honcho",
  "mem0",
  "openviking",
  "retaindb",
  "supermemory",
];
const seen = knownProviders.filter((p) => body.toLowerCase().includes(p));
if (seen.length < 5) {
  console.error(`✗ /memory shows only ${seen.length}/${knownProviders.length} known providers`);
  console.error("  seen:", seen.join(", "));
  console.error("  body excerpt:", body.slice(0, 400).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /memory: ${seen.length}/${knownProviders.length} known providers rendered`);

await page.screenshot({ path: SHOT, fullPage: false });
console.log(`✓ screenshot: ${SHOT}`);

await browser.close();
console.log("✓ /memory fix verified (Issue #121)");
