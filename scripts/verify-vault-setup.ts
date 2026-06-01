#!/usr/bin/env bun
/**
 * scripts/verify-vault-setup.ts — Second Brain B1 Done-Gate.
 *
 * Covers the local-only setup path end-to-end:
 *   1. Login.
 *   2. /reset (idempotent baseline — wipes any prior B1 verify state).
 *   3. /status → configured:false, gitVersion non-empty (proves git is in image).
 *   4. /ssh-key → returns ed25519 public key (proves ssh-keygen works in image).
 *   5. /setup with mode='local' → creates start-vault content in /app/vault.
 *   6. /status → configured:true, mode='local'.
 *   7. /api/lokyy/vault (legacy reader) → entries include README.md, Inbox/, etc.
 *      Proves the existing /vault reader now sees the managed mount.
 *   8. docker exec lokyy-os-be ls /app/vault → matches.
 *   9. /reset → /status returns to configured:false (cleanup).
 *
 * Remote-mode and import paths are out of scope for B1 verification — those
 * need an external git host. Manual smoke-test only, until I5 (bundled Forgejo).
 *
 * Run:  bun scripts/verify-vault-setup.ts
 */
import { readFileSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: HTTP ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    data = { _nonJson: await r.text() };
  }
  return { status: r.status, data };
}

function fail(msg: string, extra?: unknown): never {
  console.error(`✗ ${msg}`);
  if (extra !== undefined) console.error("  context:", JSON.stringify(extra, null, 2));
  process.exit(1);
}

function dockerLsVault(): string[] {
  const proc = Bun.spawnSync(["docker", "exec", "lokyy-os-be", "ls", "/app/vault"]);
  if (proc.exitCode !== 0) return [];
  return new TextDecoder().decode(proc.stdout).split("\n").map((l) => l.trim()).filter(Boolean);
}

// Smoke: confirm we're hitting the new build.
const banner = readFileSync("lokyy-os-be/Dockerfile", "utf8");
if (!/openssh-client/.test(banner)) fail("Dockerfile missing openssh-client — wrong checkout?");

const cookie = await loginCookie();
console.log("✓ logged in");

// Baseline reset so re-runs are idempotent.
const reset1 = await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
if (reset1.status !== 200) fail("baseline reset failed", reset1);
console.log("✓ baseline reset");

const status1 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
if (status1.status !== 200) fail("/status HTTP non-200", status1);
if (status1.data.configured !== false) fail("expected configured:false after reset", status1);
console.log("✓ status before setup: configured=false");

const gitVer = await api(cookie, "GET", "/api/lokyy/vault/setup/git-version");
if (!/git version/.test(String(gitVer.data?.version))) {
  fail("git binary not present in be-image", gitVer);
}
console.log(`✓ git in image: ${gitVer.data.version.trim()}`);

const sshKey = await api(cookie, "GET", "/api/lokyy/vault/setup/ssh-key");
if (!sshKey.data.publicKey || !sshKey.data.publicKey.startsWith("ssh-ed25519 ")) {
  fail("ssh-key endpoint did not return ed25519 public key", sshKey);
}
console.log(`✓ ssh-keygen works (key id=${sshKey.data.sshKeyId}, pub starts: ${sshKey.data.publicKey.slice(0, 32)}…)`);

const setupRes = await api(cookie, "POST", "/api/lokyy/vault/setup/setup", { mode: "local" });
if (setupRes.status !== 200 || !setupRes.data.ok) fail("local setup failed", setupRes);
if (setupRes.data.mode !== "local" || setupRes.data.path !== "/app/vault") {
  fail("local setup returned unexpected payload", setupRes);
}
console.log("✓ POST /setup mode=local → /app/vault initialized");

const status2 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
if (status2.data.configured !== true || status2.data.mode !== "local") {
  fail("status after setup wrong", status2);
}
console.log("✓ status after setup: configured=true, mode=local");

const legacyList = await api(cookie, "GET", "/api/lokyy/vault");
if (!legacyList.data.configured) fail("/api/lokyy/vault still reports unconfigured after setup", legacyList);
const entryNames = (legacyList.data.entries as { name: string }[]).map((e) => e.name).sort();
const required = ["Daily", "Inbox", "Projects", "README.md", "Templates"];
for (const r of required) {
  if (!entryNames.includes(r)) fail(`/vault listing missing required entry "${r}"`, entryNames);
}
console.log(`✓ /api/lokyy/vault reader sees managed mount, entries=${JSON.stringify(entryNames)}`);

const dockerLs = dockerLsVault().sort();
for (const r of required) {
  if (!dockerLs.includes(r)) fail(`docker exec ls /app/vault missing "${r}"`, dockerLs);
}
console.log(`✓ docker exec ls /app/vault matches: ${JSON.stringify(dockerLs)}`);

const resetFinal = await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
if (resetFinal.status !== 200) fail("final reset failed", resetFinal);
const statusFinal = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
if (statusFinal.data.configured !== false) fail("status not reset after final reset", statusFinal);
console.log("✓ final reset → configured=false");

console.log("\n✅ Second Brain B1 verified — schema + git/ssh in image + local-only setup flow + legacy /vault reader integration");
