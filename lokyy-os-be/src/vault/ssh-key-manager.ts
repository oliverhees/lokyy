/**
 * SSH-key lifecycle for Second-Brain remote auth.
 *
 * Generates an ed25519 keypair via `ssh-keygen`, encrypts the private key
 * with AES-256-GCM (key derived from BETTER_AUTH_SECRET via SHA-256),
 * persists both halves in lokyy_ssh_key, and writes the private key to
 * /root/.ssh/<id> with 0600 perms on demand so `git` can use it.
 *
 * BETTER_AUTH_SECRET is the only mandatory env in be — using it as the KDF
 * input avoids a second secret surface. The private key never leaves
 * /root/.ssh inside the container.
 */
import { lokyyDb, type LokyySshKeyRow } from "../db/lokyy-db.ts";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

const KEY_DIR = "/root/.ssh";

function deriveKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET missing — cannot encrypt SSH keys");
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${Buffer.concat([enc, tag]).toString("base64")}`;
}

function decrypt(encoded: string): string {
  const [ivB64, payloadB64] = encoded.split(":");
  if (!ivB64 || !payloadB64) throw new Error("malformed ciphertext");
  const iv = Buffer.from(ivB64, "base64");
  const payload = Buffer.from(payloadB64, "base64");
  const tag = payload.subarray(payload.length - 16);
  const ct = payload.subarray(0, payload.length - 16);
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Returns the most recently created keypair, if any. Used by /setup endpoints
 * so we reuse the key the wizard already showed to the user (and they pasted
 * into Forgejo) instead of generating a fresh one whose public half nobody
 * has registered on the remote.
 */
export function getLatestSshKey(): LokyySshKeyRow | null {
  return (
    lokyyDb
      .query<LokyySshKeyRow, []>(
        `SELECT id, keyType, publicKey, encPrivateKey, createdAt FROM lokyy_ssh_key ORDER BY createdAt DESC LIMIT 1`,
      )
      .get() ?? null
  );
}

export function getSshKey(id: string): LokyySshKeyRow | null {
  return (
    lokyyDb
      .query<LokyySshKeyRow, [string]>(
        `SELECT id, keyType, publicKey, encPrivateKey, createdAt FROM lokyy_ssh_key WHERE id = ?`,
      )
      .get(id) ?? null
  );
}

/**
 * Generates an ed25519 keypair, stores it encrypted in lokyy_ssh_key,
 * and returns the row.
 */
export async function createSshKey(): Promise<LokyySshKeyRow> {
  const id = `key_${randomUUID().slice(0, 12).replace(/-/g, "")}`;
  const tmp = mkdtempSync(join(tmpdir(), "lokyy-ssh-"));
  const privPath = join(tmp, "id");
  const pubPath = `${privPath}.pub`;
  const proc = Bun.spawn([
    "ssh-keygen",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    `lokyy-vault-${id}`,
    "-f",
    privPath,
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ssh-keygen failed (exit ${exitCode})`);
  }
  const privKey = readFileSync(privPath, "utf8");
  const publicKey = readFileSync(pubPath, "utf8").trim();
  // Wipe the on-disk tmp copy immediately.
  try { unlinkSync(privPath); unlinkSync(pubPath); } catch { /* best-effort */ }

  const row: LokyySshKeyRow = {
    id,
    keyType: "ed25519",
    publicKey,
    encPrivateKey: encrypt(privKey),
    createdAt: Date.now(),
  };
  lokyyDb.run(
    `INSERT INTO lokyy_ssh_key (id, keyType, publicKey, encPrivateKey, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.keyType, row.publicKey, row.encPrivateKey, row.createdAt],
  );
  return row;
}

/**
 * Writes the private key for `id` to /root/.ssh/<id> with mode 0600 and
 * returns the path. Idempotent — re-writes the file each call so a wipe of
 * the container doesn't break sync after restart.
 */
export function materializePrivateKey(id: string): string {
  const row = getSshKey(id);
  if (!row) throw new Error(`ssh key ${id} not found`);
  const path = join(KEY_DIR, id);
  writeFileSync(path, decrypt(row.encPrivateKey), { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

export function privateKeyPathIfMaterialized(id: string): string | null {
  const path = join(KEY_DIR, id);
  return existsSync(path) ? path : null;
}
