/**
 * Vault runtime helpers — paths, status read-out, single-source-of-truth
 * for "where does the managed vault live in the container".
 */
import { lokyyDb, type LokyyVaultRow } from "../db/lokyy-db.ts";

/** Container-side path where the managed (named-volume-backed) vault lives. */
export const MANAGED_VAULT_PATH = "/app/vault";

export function getVaultRow(): LokyyVaultRow | null {
  const row = lokyyDb
    .query<LokyyVaultRow, [string]>(
      `SELECT id, mode, remoteUrl, sshKeyId, lastSyncAt, syncError, createdAt, updatedAt
       FROM lokyy_vault WHERE id = ?`,
    )
    .get("default");
  return row ?? null;
}

export type VaultStatus =
  | { configured: false; legacyPath: string | null }
  | {
      configured: true;
      mode: "local" | "remote";
      remoteUrl: string | null;
      lastSyncAt: number | null;
      syncError: string | null;
      sshKeyId: string | null;
    };

export function readVaultStatus(): VaultStatus {
  const row = getVaultRow();
  if (!row) {
    const legacy = process.env.LOKYY_VAULT_PATH ?? null;
    return { configured: false, legacyPath: legacy };
  }
  return {
    configured: true,
    mode: row.mode,
    remoteUrl: row.remoteUrl,
    lastSyncAt: row.lastSyncAt,
    syncError: row.syncError,
    sshKeyId: row.sshKeyId,
  };
}

export function upsertVault(input: {
  mode: "local" | "remote";
  remoteUrl: string | null;
  sshKeyId: string | null;
}): void {
  const now = Date.now();
  lokyyDb.run(
    `INSERT INTO lokyy_vault (id, mode, remoteUrl, sshKeyId, createdAt, updatedAt)
     VALUES ('default', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       remoteUrl = excluded.remoteUrl,
       sshKeyId = excluded.sshKeyId,
       updatedAt = excluded.updatedAt,
       syncError = NULL`,
    [input.mode, input.remoteUrl, input.sshKeyId, now, now],
  );
}

export function clearVault(): void {
  lokyyDb.run("DELETE FROM lokyy_vault WHERE id = 'default'");
  lokyyDb.run("DELETE FROM lokyy_ssh_key");
}
