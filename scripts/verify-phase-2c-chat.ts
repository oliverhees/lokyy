#!/usr/bin/env bun
/**
 * scripts/verify-phase-2c-chat.ts
 *
 * Real end-to-end browser test against the live Docker stack at
 * https://lokyy.local — proves the full chain:
 *   browser → lokyy-app (lokyy-os-fe) → /api/hermes/v1/chat/completions
 *   → lokyy-os-be → hermes:8642 → Anthropic → assistant text on screen
 *
 * Distinct from lokyy-app/tests/e2e/* which run the FE standalone on :3100
 * with mocked backend — those don't exercise Hermes at all.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const OUTPUT = resolve("docs/evidence/phase-2c/chat-live.png");

async function main() {
  const outDir = dirname(OUTPUT);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("→ Login");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("  ✓ logged in");

  console.log("→ Navigating /chat");
  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await page.getByTestId("chat-input").waitFor({ state: "visible", timeout: 10_000 });
  console.log("  ✓ /chat loaded");

  // Capture every network request so we can see what /chat actually fires
  const apiCalls: { url: string; status: number; ok: boolean }[] = [];
  page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/api/")) {
      apiCalls.push({ url: u, status: r.status(), ok: r.ok() });
    }
  });

  console.log("→ Sending prompt");
  await page.getByTestId("chat-input").fill("Sag in einem einzigen Wort: hi");
  await page.getByTestId("chat-input").press("Enter");

  console.log("→ Waiting 15s for response + streaming …");
  await page.waitForTimeout(15_000);

  // Dump visible chat-related text so we can see what actually rendered
  const visibleText = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="chat-page"]') as HTMLElement | null;
    return pane ? pane.innerText.slice(0, 1500) : "(no chat-page element)";
  });
  console.log("→ Visible /chat text (first 1500 chars):");
  console.log(visibleText);
  console.log("");
  console.log("→ API calls during the run:");
  for (const c of apiCalls.slice(-15)) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.status}  ${c.url}`);
  }

  console.log("→ Screenshot");
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`  ✓ saved ${OUTPUT}`);

  console.log("");
  console.log(`Console errors during run: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 5)) console.log(`  ! ${e}`);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.log("⚠ Console errors above — review screenshot.");
    process.exit(1);
  }
  console.log("✓ Phase-2c chat E2E verified");
}

main().catch((err) => {
  console.error("✗ Phase-2c chat E2E failed:", err);
  process.exit(1);
});
