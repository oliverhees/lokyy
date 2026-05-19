#!/usr/bin/env bun
/**
 * scripts/verify-settings-fix.ts
 *
 * Issue #114 — /settings stuck on "lade…".
 *
 * Verifies via real Chromium against https://lokyy.local:
 *   1) login flow works
 *   2) /settings renders Sections (General, Notifications, Hermes-Config)
 *   3) the "lade…" loader text is gone after the first response
 *   4) hermesLive=true shows a green indicator + model/profiles values
 *   5) screenshot evidence under docs/evidence/audit-2026-05-19/settings-fix.png
 *
 * Run: bun run scripts/verify-settings-fix.ts
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const OUTPUT = resolve("docs/evidence/audit-2026-05-19/settings-fix.png");

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
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  // ───── Login ────────────────────────────────────────────────────────────────
  console.log("→ Login");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("  ✓ logged in");

  // ───── /settings ────────────────────────────────────────────────────────────
  console.log("→ Navigating /settings");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });

  // Spec demands: wartet 3s
  await page.waitForTimeout(3000);

  // 1) Heading
  await page.locator("h1", { hasText: "Settings" }).waitFor({ state: "visible", timeout: 5000 });

  // 2) Loader must be gone
  const loaderCount = await page.getByText("lade…", { exact: true }).count();
  if (loaderCount > 0) {
    console.error(`✗ /settings still shows 'lade…' (${loaderCount}× in DOM)`);
    await page.screenshot({ path: OUTPUT, fullPage: true });
    await browser.close();
    process.exit(1);
  }
  console.log("  ✓ no 'lade…' text");

  // 3) Mandatory sections from the acceptance list
  const general = await page.getByTestId("settings-general").isVisible();
  const notifications = await page.getByTestId("settings-notifications").isVisible();
  const hermes = await page.getByTestId("settings-hermes").isVisible();
  console.log(`  general:        ${general ? "✓" : "✗"}`);
  console.log(`  notifications:  ${notifications ? "✓" : "✗"}`);
  console.log(`  hermes:         ${hermes ? "✓" : "✗"}`);
  if (!general || !notifications || !hermes) {
    await page.screenshot({ path: OUTPUT, fullPage: true });
    await browser.close();
    console.error("✗ at least one required section is missing");
    process.exit(1);
  }

  // 4) hermesLive indicator
  const indicator = page.getByTestId("settings-hermes-indicator");
  const isLive = await indicator.getAttribute("data-live");
  const indicatorText = (await indicator.textContent())?.trim() ?? "";
  console.log(`  hermes indicator: data-live="${isLive}" text="${indicatorText}"`);

  if (isLive === "true") {
    // Hermes is live — assert the value cells rendered (not just the labels).
    const model = (await page.getByTestId("settings-hermes-model").textContent())?.trim() ?? "";
    const providers = (await page.getByTestId("settings-hermes-providers").textContent())?.trim() ?? "";
    const profiles = (await page.getByTestId("settings-hermes-profiles").textContent())?.trim() ?? "";
    console.log(`  hermes model:     ${model}`);
    console.log(`  hermes providers: ${providers}`);
    console.log(`  hermes profiles:  ${profiles}`);
    if (!model || !providers || !profiles) {
      console.error("✗ hermesLive=true but value cells missing");
      await page.screenshot({ path: OUTPUT, fullPage: true });
      await browser.close();
      process.exit(1);
    }
  } else {
    // Hermes offline is *also* a valid state — the page is no longer stuck.
    // We still expect the offline label to render rather than the loader.
    const offlineEl = page.getByTestId("settings-hermes-offline");
    await offlineEl.waitFor({ state: "visible", timeout: 3000 });
    console.log("  ✓ hermes offline state rendered (not stuck)");
  }

  // 5) Screenshot
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`  ✓ screenshot ${OUTPUT}`);

  if (consoleErrors.length > 0) {
    console.log("");
    console.log(`⚠ console errors (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 5)) console.log(`  - ${e.slice(0, 200)}`);
  }

  await browser.close();
  console.log("");
  console.log("✓ /settings fix verified (Issue #114)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
