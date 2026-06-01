#!/usr/bin/env bun
/**
 * scripts/verify-vault-setup-wizard.ts — F3 Done-Gate.
 *
 * Drives the Setup-Wizard end-to-end via Playwright:
 *   1. Reset vault state via API so we start unconfigured.
 *   2. Login UI → /vault → see "Vault einrichten" CTA (because configured=false).
 *   3. Click CTA → land on /vault/setup with mode cards visible.
 *   4. Click local-only card → selected attribute flips.
 *   5. Click "Initialisieren" → wait for redirect to /vault.
 *   6. /vault now lists managed entries (README.md, Inbox, …) — proves the wizard
 *      successfully POSTed and the existing reader picks up the new mount.
 *   7. Reset via API (cleanup).
 *
 * Run: bun scripts/verify-vault-setup-wizard.ts
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const SHOT_DIR = "docs/evidence/vault";
const ISO_DATE = new Date().toISOString().slice(0, 10);

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: HTTP ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function resetVault(cookie: string): Promise<void> {
  await fetch(`${BASE}/api/lokyy/vault/setup/reset`, {
    method: "POST",
    headers: { cookie },
  });
}

mkdirSync(SHOT_DIR, { recursive: true });
const cookie = await loginCookie();
await resetVault(cookie);
console.log("✓ logged in, vault reset to unconfigured");

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log(`  [browser:pageerror] ${err.message}`));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("✓ UI login");

  await page.goto(`${BASE}/vault`, { waitUntil: "networkidle" });
  const cta = page.locator("[data-testid='vault-setup-cta']");
  await cta.waitFor({ state: "visible", timeout: 5_000 });
  console.log("✓ /vault shows 'Vault einrichten' CTA (unconfigured branch)");
  await cta.click();

  await page.waitForURL("**/vault/setup", { timeout: 5_000 });
  await page.locator("[data-testid='vault-setup-page']").waitFor({ timeout: 5_000 });
  console.log("✓ landed on /vault/setup");

  // Confirm all four mode cards exist.
  for (const tid of ["vault-mode-local", "vault-mode-localPath", "vault-mode-remote-init", "vault-mode-remote-clone"]) {
    if (!(await page.locator(`[data-testid='${tid}']`).isVisible())) {
      throw new Error(`mode card missing: ${tid}`);
    }
  }
  console.log("✓ all 4 mode cards visible");

  // Pick local-only.
  await page.locator("[data-testid='vault-mode-local']").click();
  const selected = await page
    .locator("[data-testid='vault-mode-local']")
    .getAttribute("data-selected");
  if (selected !== "true") throw new Error(`expected local card selected, got data-selected=${selected}`);
  console.log("✓ local-only mode selected");

  await page.screenshot({ path: `${SHOT_DIR}/setup-wizard-${ISO_DATE}.png`, fullPage: true });

  await page.locator("[data-testid='vault-setup-submit']").click();
  await page.waitForURL("**/vault", { timeout: 10_000 });
  console.log("✓ redirected to /vault after init");

  // Page should now list the start-vault entries.
  await page.waitForTimeout(800);
  const bodyText = await page.locator("body").innerText();
  for (const expected of ["README.md", "Inbox", "Daily", "Projects"]) {
    if (!bodyText.includes(expected)) throw new Error(`/vault listing missing "${expected}" after init`);
  }
  console.log("✓ /vault now lists managed entries (README.md, Inbox, Daily, Projects)");

  await page.screenshot({ path: `${SHOT_DIR}/vault-after-init-${ISO_DATE}.png`, fullPage: false });
} finally {
  await browser.close();
  await resetVault(cookie);
}

console.log("\n✅ F3 Setup-Wizard verified — empty-state CTA → wizard → local-mode init → /vault populated");
