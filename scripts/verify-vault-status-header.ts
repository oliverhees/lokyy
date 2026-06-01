#!/usr/bin/env bun
/**
 * scripts/verify-vault-status-header.ts — F4 Done-Gate.
 *
 * Drives /vault UI to confirm the status-header shows the right thing
 * for both modes + that Sync now actually triggers /api/lokyy/vault/setup/sync.
 *
 * Steps:
 *   1. Reset baseline.
 *   2. Setup mode='local' via API.
 *   3. UI: /vault → VaultStatusHeader visible, mode badge = 'Local-only',
 *      no Sync-now button, Re-setup button present.
 *   4. Reset.
 *   5. Bare repo init inside be-container.
 *   6. Setup mode='remote' init=true pointing at file://.
 *   7. UI: /vault → mode badge = 'Remote', Sync-now button visible.
 *   8. Click Sync-now → toast appears, /status lastSyncAt freshens.
 *   9. Cleanup.
 *
 * Run: bun scripts/verify-vault-status-header.ts
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

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function dexec(args: string[]): { exitCode: number | null; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["docker", "exec", "lokyy-os-be", ...args]);
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

mkdirSync(SHOT_DIR, { recursive: true });
const cookie = await loginCookie();
await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
console.log("✓ baseline reset");

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

  // ─── Phase 1: Local mode ──────────────────────────────────────────────────
  const setupLocal = await api(cookie, "POST", "/api/lokyy/vault/setup/setup", { mode: "local" });
  if (!setupLocal.ok) throw new Error("local setup failed");

  await page.goto(`${BASE}/vault`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='vault-status-header']").waitFor({ timeout: 5_000 });
  console.log("✓ /vault renders VaultStatusHeader (local mode)");

  const badgeLocal = await page.locator("[data-testid='vault-mode-badge']").innerText();
  if (!/Local-only/.test(badgeLocal)) throw new Error(`expected badge "Local-only", got "${badgeLocal}"`);
  console.log(`✓ mode badge shows: "${badgeLocal.trim()}"`);

  // Sync-now button MUST NOT exist in local mode.
  if (await page.locator("[data-testid='vault-sync-now']").count() !== 0) {
    throw new Error("Sync-now button should not appear in local mode");
  }
  console.log("✓ Sync-now button hidden in local mode");

  // Re-setup button always present.
  if (!(await page.locator("[data-testid='vault-resetup']").isVisible())) {
    throw new Error("Re-setup button missing");
  }
  console.log("✓ Re-setup button visible");

  await page.screenshot({ path: `${SHOT_DIR}/status-header-local-${ISO_DATE}.png`, fullPage: false });

  // ─── Phase 2: Remote mode ─────────────────────────────────────────────────
  await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
  const bare = "/tmp/test-status.git";
  dexec(["rm", "-rf", bare]);
  if (dexec(["git", "init", "--bare", bare]).exitCode !== 0) throw new Error("bare repo init failed");
  dexec(["git", "-C", bare, "symbolic-ref", "HEAD", "refs/heads/main"]);

  const setupRemote = await api(cookie, "POST", "/api/lokyy/vault/setup/setup", {
    mode: "remote",
    remoteUrl: `file://${bare}`,
    init: true,
  });
  if (!setupRemote.ok) throw new Error(`remote setup failed: ${JSON.stringify(setupRemote)}`);

  await page.goto(`${BASE}/vault`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='vault-status-header']").waitFor({ timeout: 5_000 });
  const badgeRemote = await page.locator("[data-testid='vault-mode-badge']").innerText();
  if (!/Remote/.test(badgeRemote)) throw new Error(`expected badge "Remote", got "${badgeRemote}"`);
  console.log(`✓ mode badge after remote setup: "${badgeRemote.trim()}"`);

  if (!(await page.locator("[data-testid='vault-sync-now']").isVisible())) {
    throw new Error("Sync-now button should be visible in remote mode");
  }
  console.log("✓ Sync-now button visible in remote mode");

  // Click Sync-now and wait for toast.
  const status1 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
  const initialSyncAt = status1.lastSyncAt;
  await new Promise((r) => setTimeout(r, 1100)); // ensure ms differs
  await page.locator("[data-testid='vault-sync-now']").click();

  // Toast contains either "Synced" or "Übersprungen" or "Sync fehlgeschlagen".
  const toast = page.locator("[data-sonner-toast]").first();
  await toast.waitFor({ state: "visible", timeout: 8_000 });
  const toastText = await toast.innerText();
  if (!/Synced|Übersprungen/.test(toastText)) {
    throw new Error(`unexpected toast: ${toastText}`);
  }
  console.log(`✓ Sync-now click → toast: "${toastText.trim().split("\n")[0]}"`);

  // Verify backend recorded the sync.
  await new Promise((r) => setTimeout(r, 500));
  const status2 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
  if (!status2.lastSyncAt || status2.lastSyncAt <= initialSyncAt) {
    throw new Error(`lastSyncAt did not advance (was ${initialSyncAt}, is ${status2.lastSyncAt})`);
  }
  console.log(`✓ /status.lastSyncAt advanced (+${status2.lastSyncAt - initialSyncAt}ms)`);

  await page.screenshot({ path: `${SHOT_DIR}/status-header-remote-${ISO_DATE}.png`, fullPage: false });

  dexec(["rm", "-rf", bare]);
} finally {
  await browser.close();
  await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
}

console.log("\n✅ F4 VaultStatusHeader verified — local/remote badges + Sync-now click flow");
