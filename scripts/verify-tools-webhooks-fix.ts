#!/usr/bin/env bun
/**
 * scripts/verify-tools-webhooks-fix.ts
 *
 * Playwright verification for GitHub Issues #115 (/tools) and #117
 * (/webhooks). Both now back onto `hermes <subcommand> list` exec'd via
 * docker-socket-proxy.
 *
 * Acceptance:
 *   - login succeeds
 *   - /tools shows ≥10 tool cards, no "not deployed" stub text
 *   - /webhooks shows the real "platform not enabled" setup hint
 *     (not the Phase-1d "Hermes Agent is not deployed yet" lie)
 *   - both pages screenshot-captured under docs/evidence/audit-2026-05-19/
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT_TOOLS = "docs/evidence/audit-2026-05-19/tools-fix.png";
const SHOT_WEBHOOKS = "docs/evidence/audit-2026-05-19/webhooks-fix.png";

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

// ── /tools ─────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const toolsBody = await page.evaluate(() => document.body.innerText ?? "");
if (/not deployed|nicht deployed|phase-2 of the lokyy roadmap/i.test(toolsBody)) {
  console.error("✗ /tools still shows the not-deployed stub text");
  await page.screenshot({ path: SHOT_TOOLS });
  await browser.close();
  process.exit(1);
}
// Count tool cards — `data-testid="tools-grid"` wraps them
const toolCount = await page
  .locator("[data-testid='tools-grid'] > *")
  .count()
  .catch(() => 0);
if (toolCount < 10) {
  console.error(`✗ /tools rendered only ${toolCount} cards (expected ≥10)`);
  await page.screenshot({ path: SHOT_TOOLS });
  await browser.close();
  process.exit(1);
}
console.log(`✓ /tools: ${toolCount} tool cards rendered`);
await page.screenshot({ path: SHOT_TOOLS, fullPage: false });

// ── /webhooks ──────────────────────────────────────────────────────────────
await page.goto(`${BASE}/webhooks`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const webBody = await page.evaluate(() => document.body.innerText ?? "");
if (/hermes agent is not deployed yet/i.test(webBody)) {
  console.error("✗ /webhooks still shows the not-deployed stub text");
  await page.screenshot({ path: SHOT_WEBHOOKS });
  await browser.close();
  process.exit(1);
}
// The new raw text should mention the actual reason (platform not enabled +
// setup instructions). One of these markers must be present:
const hasRealText =
  /webhook platform is not enabled|hermes gateway setup/i.test(webBody);
if (!hasRealText) {
  console.error("✗ /webhooks missing real setup-instructions text");
  console.error("  body excerpt:", webBody.slice(0, 400).replace(/\s+/g, " "));
  await page.screenshot({ path: SHOT_WEBHOOKS });
  await browser.close();
  process.exit(1);
}
console.log("✓ /webhooks shows real 'platform not enabled' setup hint");
await page.screenshot({ path: SHOT_WEBHOOKS, fullPage: false });

await browser.close();
console.log(`✓ tools-fix screenshot: ${SHOT_TOOLS}`);
console.log(`✓ webhooks-fix screenshot: ${SHOT_WEBHOOKS}`);
console.log("✓ /tools (Issue #115) + /webhooks (Issue #117) verified");
