/**
 * vault-sync.ts — Phase-3 B2.
 *
 * Periodically pulls + pushes the Second-Brain working tree when mode='remote'.
 *
 * Tick: VAULT_SYNC_TICK_MS (default 300_000 = 5min).
 *
 * Sequence per tick:
 *   1. read lokyy_vault row; bail when mode !== 'remote' or no sshKeyId
 *   2. materialize private key into /root/.ssh/<id> (idempotent)
 *   3. git add -A
 *   4. git diff --quiet  → if dirty: git commit -m "lokyy: auto-sync <iso>"
 *   5. git pull --rebase
 *   6. git push
 *   7. on success: UPDATE lokyy_vault SET lastSyncAt=?, syncError=NULL
 *      on any-step failure: UPDATE lokyy_vault SET syncError=stderr
 *
 * runVaultSync() is exported separately so POST /api/lokyy/vault/setup/sync
 * can trigger it on demand without waiting for the tick.
 */
import { lokyyDb } from "../db/lokyy-db.ts";
import { getVaultRow } from "../vault/runtime.ts";
import { runGit } from "../vault/git-runner.ts";
import { materializePrivateKey, privateKeyPathIfMaterialized } from "../vault/ssh-key-manager.ts";

const VAULT_SYNC_TICK_MS = Number.parseInt(process.env.VAULT_SYNC_TICK_MS ?? "300000", 10);

let started = false;
let inFlight = false;

export type VaultSyncResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; committed: boolean; pulled: string; pushed: string }
  | { ok: false; step: string; error: string };

function setSyncSuccess(): void {
  lokyyDb.run(
    `UPDATE lokyy_vault SET lastSyncAt = ?, syncError = NULL, updatedAt = ? WHERE id = 'default'`,
    [Date.now(), Date.now()],
  );
}

function setSyncError(msg: string): void {
  lokyyDb.run(
    `UPDATE lokyy_vault SET syncError = ?, updatedAt = ? WHERE id = 'default'`,
    [msg.slice(0, 4000), Date.now()],
  );
}

export async function runVaultSync(): Promise<VaultSyncResult> {
  const row = getVaultRow();
  if (!row) return { ok: true, skipped: true, reason: "vault not configured" };
  if (row.mode !== "remote") return { ok: true, skipped: true, reason: "mode=local — nothing to sync" };
  if (!row.sshKeyId) return { ok: true, skipped: true, reason: "no ssh key on vault row" };

  if (inFlight) return { ok: true, skipped: true, reason: "sync already in flight" };
  inFlight = true;

  try {
    const sshKeyPath = privateKeyPathIfMaterialized(row.sshKeyId) ?? materializePrivateKey(row.sshKeyId);
    const opts = { sshKeyPath };

    const add = await runGit(["add", "-A"], opts);
    if (!add.ok) {
      const err = `git add failed: ${add.stderr.trim()}`;
      setSyncError(err);
      return { ok: false, step: "add", error: err };
    }

    const diff = await runGit(["diff", "--cached", "--quiet"], opts);
    let committed = false;
    if (!diff.ok) {
      // exit 1 = dirty index — commit.
      const msg = `lokyy: auto-sync ${new Date().toISOString()}`;
      const commit = await runGit(["commit", "-m", msg], opts);
      if (!commit.ok) {
        const err = `git commit failed: ${commit.stderr.trim()}`;
        setSyncError(err);
        return { ok: false, step: "commit", error: err };
      }
      committed = true;
    }

    const pull = await runGit(["pull", "--rebase", "origin", "main"], opts);
    if (!pull.ok) {
      const err = `git pull --rebase failed: ${pull.stderr.trim()}`;
      setSyncError(err);
      return { ok: false, step: "pull", error: err };
    }

    const push = await runGit(["push", "origin", "main"], opts);
    if (!push.ok) {
      const err = `git push failed: ${push.stderr.trim()}`;
      setSyncError(err);
      return { ok: false, step: "push", error: err };
    }

    setSyncSuccess();
    return {
      ok: true,
      skipped: false,
      committed,
      pulled: pull.stdout.trim().slice(0, 200) || "up to date",
      pushed: push.stderr.trim().slice(0, 200) || "up to date",
    };
  } finally {
    inFlight = false;
  }
}

export function startVaultSyncScheduler(): void {
  if (started) return;
  started = true;
  console.log(`[vault-sync] started · tick=${VAULT_SYNC_TICK_MS / 1000}s`);
  setInterval(() => {
    void runVaultSync().catch((err) => {
      console.error("[vault-sync] unhandled error:", err);
    });
  }, VAULT_SYNC_TICK_MS);
}
