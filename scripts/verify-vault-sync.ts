#!/usr/bin/env bun
/**
 * scripts/verify-vault-sync.ts — B2 Done-Gate.
 *
 * Verifies the sync-engine end-to-end without needing a real Forgejo/GitHub:
 *   1. Create a bare git repo inside the be-container at /tmp/test-bare.git.
 *   2. Setup vault with mode='remote' init=true pointing at file:///tmp/test-bare.git.
 *      (We DON'T use the regular /setup endpoint because it always creates an
 *      ssh-key and forces GIT_SSH_COMMAND. We POST directly with manual setup
 *      via API + DB to keep this isolated from the SSH path. Actually simpler:
 *      just inject a row + setup the vault dir manually via docker exec.)
 *   3. Add a file to the working tree.
 *   4. POST /api/lokyy/vault/setup/sync → expect ok, committed:true, push succeeds.
 *   5. Verify the bare repo's HEAD now contains the commit.
 *   6. Check /status returns updated lastSyncAt.
 *   7. Cleanup.
 *
 * Also tests the local-mode no-op path:
 *   - setup mode='local'
 *   - POST /sync → ok skipped reason mentions 'local'
 *
 * Run: bun scripts/verify-vault-sync.ts
 */
import { writeFileSync, unlinkSync } from "node:fs";

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
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    data = { _nonJson: await r.text() };
  }
  return { status: r.status, data };
}

function dexec(args: string[]): { exitCode: number | null; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(["docker", "exec", "lokyy-os-be", ...args]);
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

function fail(msg: string, extra?: unknown): never {
  console.error(`✗ ${msg}`);
  if (extra !== undefined) console.error("  context:", JSON.stringify(extra, null, 2));
  process.exit(1);
}

// ─── Setup ────────────────────────────────────────────────────────────────────
const cookie = await loginCookie();
console.log("✓ logged in");

await api(cookie, "POST", "/api/lokyy/vault/setup/reset");

// ─── Test 1: local-mode sync is a no-op ──────────────────────────────────────
const setupLocal = await api(cookie, "POST", "/api/lokyy/vault/setup/setup", { mode: "local" });
if (!setupLocal.data.ok) fail("local setup failed", setupLocal);

const syncLocal = await api(cookie, "POST", "/api/lokyy/vault/setup/sync");
if (!syncLocal.data.ok) fail("local-mode sync should return ok=true", syncLocal);
if (syncLocal.data.skipped !== true) fail("local-mode sync should be skipped", syncLocal);
if (!/local/.test(String(syncLocal.data.reason))) fail("skipped reason should mention 'local'", syncLocal);
console.log(`✓ local-mode sync is no-op (reason: "${syncLocal.data.reason}")`);

await api(cookie, "POST", "/api/lokyy/vault/setup/reset");

// ─── Test 2: remote-mode sync against an internal bare repo ──────────────────
// Create a bare repo inside the be-container.
const bareRepoPath = "/tmp/test-bare.git";
dexec(["rm", "-rf", bareRepoPath]);
const bareInit = dexec(["git", "init", "--bare", bareRepoPath]);
if (bareInit.exitCode !== 0) fail("could not create bare repo", bareInit);
// Match config for default branch.
dexec(["git", "-C", bareRepoPath, "symbolic-ref", "HEAD", "refs/heads/main"]);
console.log(`✓ bare repo created at ${bareRepoPath} (inside be-container)`);

const setupRemote = await api(cookie, "POST", "/api/lokyy/vault/setup/setup", {
  mode: "remote",
  remoteUrl: `file://${bareRepoPath}`,
  init: true,
});
if (!setupRemote.data.ok) fail("remote setup failed", setupRemote);
console.log("✓ remote setup completed (start-vault initialized + initial push)");

// Verify bare repo now has commits.
const log1 = dexec(["git", "-C", bareRepoPath, "log", "--oneline", "-1"]);
if (log1.exitCode !== 0 || !log1.stdout.trim()) fail("bare repo has no commits after initial push", log1);
const firstCommit = log1.stdout.trim();
console.log(`✓ bare repo HEAD after init+push: ${firstCommit}`);

// Status sanity.
const status1 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
if (!status1.data.configured || status1.data.mode !== "remote") fail("status not remote", status1);

// Mutate the working tree, then trigger /sync.
const dexAdd = dexec(["sh", "-c", `echo "B2-verify-marker $(date +%s)" > /app/vault/B2-MARKER.md`]);
if (dexAdd.exitCode !== 0) fail("could not write marker file in working tree", dexAdd);

const syncRes = await api(cookie, "POST", "/api/lokyy/vault/setup/sync");
if (!syncRes.data.ok) fail("manual sync after mutation failed", syncRes);
if (syncRes.data.committed !== true) fail("expected committed=true after writing marker", syncRes);
console.log("✓ POST /sync committed + pulled + pushed after marker write");

// Verify the bare repo received the new commit.
const log2 = dexec(["git", "-C", bareRepoPath, "log", "--oneline"]);
if (log2.exitCode !== 0) fail("git log on bare repo failed", log2);
const commits = log2.stdout.trim().split("\n");
if (commits.length < 2) fail("expected ≥2 commits in bare repo after sync", { commits });
console.log(`✓ bare repo now has ${commits.length} commits — top: "${commits[0]}"`);

// /status reflects lastSyncAt.
const status2 = await api(cookie, "GET", "/api/lokyy/vault/setup/status");
if (!status2.data.lastSyncAt || Date.now() - status2.data.lastSyncAt > 10_000) {
  fail("lastSyncAt not freshly updated", status2);
}
if (status2.data.syncError !== null) fail("syncError should be null after successful sync", status2);
console.log(`✓ /status: lastSyncAt fresh (Δ=${Date.now() - status2.data.lastSyncAt}ms), syncError=null`);

// ─── Cleanup ─────────────────────────────────────────────────────────────────
await api(cookie, "POST", "/api/lokyy/vault/setup/reset");
dexec(["rm", "-rf", bareRepoPath]);
console.log("✓ cleanup");

console.log("\n✅ B2 Sync-Engine verified — local no-op + remote full lifecycle (add/commit/pull/push) + DB state");
