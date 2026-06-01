/**
 * /api/lokyy/vault/setup — Second Brain provisioning endpoints (B1).
 *
 * Endpoints (all behind user-session auth):
 *   GET   /status        → { configured, mode, remoteUrl, lastSyncAt, syncError, sshPublicKey }
 *   GET   /ssh-key       → { sshKeyId, publicKey } — creates one on first call.
 *   POST  /setup         → { mode: 'local' } OR { mode: 'remote', remoteUrl, init: bool }
 *                          For mode='local': writes the start-vault template into /app/vault.
 *                          For mode='remote' with init=true: `git init` + remote add + initial commit + push.
 *                          For mode='remote' with init=false: assumes the remote is empty/non-existent;
 *                          use /setup/import to CLONE an existing remote instead.
 *   POST  /setup/import  → { source: 'remote' | 'localPath', remoteUrl?, localPath? }
 *                          remote: git clone <url> into /app/vault.
 *                          localPath: copy the host-mounted dir contents into /app/vault (rsync-equivalent).
 *   POST  /reset         → wipes vault dir + clears DB rows. Destructive — UI must confirm.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import { mkdirSync, rmSync, readdirSync, statSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { runGit, gitVersion } from "../vault/git-runner.ts";
import { createSshKey, getSshKey, getLatestSshKey, materializePrivateKey } from "../vault/ssh-key-manager.ts";
import { runVaultSync } from "../scheduler/vault-sync.ts";
import {
  MANAGED_VAULT_PATH,
  readVaultStatus,
  upsertVault,
  getVaultRow,
  clearVault,
} from "../vault/runtime.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

export const vaultSetup = new Hono();
vaultSetup.use("*", requireAuth);

vaultSetup.get("/status", (c) => {
  const status = readVaultStatus();
  if (!status.configured) {
    return c.json({
      configured: false,
      gitVersion: null,
      legacyPath: status.legacyPath,
    });
  }
  const row = getVaultRow();
  const sshPublicKey = row?.sshKeyId ? getSshKey(row.sshKeyId)?.publicKey ?? null : null;
  return c.json({
    configured: true,
    mode: status.mode,
    remoteUrl: status.remoteUrl,
    lastSyncAt: status.lastSyncAt,
    syncError: status.syncError,
    sshPublicKey,
  });
});

vaultSetup.get("/git-version", async (c) => {
  return c.json({ version: await gitVersion() });
});

// Returns the public key. If no key has been generated yet, generates one.
vaultSetup.get("/ssh-key", async (c) => {
  const row = getVaultRow();
  let keyId = row?.sshKeyId ?? null;
  if (!keyId) {
    // Reuse the key the wizard already showed (and the user pasted into Forgejo);
  // creating a fresh one here would invalidate that paste.
  const key = getLatestSshKey() ?? (await createSshKey());
    keyId = key.id;
  }
  const key = getSshKey(keyId);
  if (!key) return c.json({ error: "key vanished" }, 500);
  return c.json({ sshKeyId: key.id, publicKey: key.publicKey });
});

// Recursively copy a directory tree. Skips .git and .obsidian/workspace.json.
function copyTree(src: string, dst: string): number {
  let count = 0;
  function walk(srcDir: string): void {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const srcAbs = join(srcDir, entry.name);
      const rel = relative(src, srcAbs);
      const dstAbs = join(dst, rel);
      if (entry.isDirectory()) {
        mkdirSync(dstAbs, { recursive: true });
        walk(srcAbs);
      } else if (entry.isFile()) {
        mkdirSync(dirname(dstAbs), { recursive: true });
        copyFileSync(srcAbs, dstAbs);
        count++;
      }
    }
  }
  walk(src);
  return count;
}

function vaultIsEmpty(): boolean {
  try {
    const entries = readdirSync(MANAGED_VAULT_PATH);
    return entries.length === 0;
  } catch {
    return true;
  }
}

function writeStartVault(): void {
  mkdirSync(MANAGED_VAULT_PATH, { recursive: true });
  const readme = `# Second Brain

Willkommen in deinem Lokyy Second Brain.

Dieses Vault ist eine Sammlung von Markdown-Dateien — kompatibel mit Obsidian,
Logseq, jedem Editor. Lokyy listet, sucht und (in späteren Stories) schreibt
Notizen via Agent.

## Ordner-Konvention

- **Inbox/** — schnelle Notizen, später sortieren
- **Daily/** — Tages-Logs (YYYY-MM-DD.md)
- **Projects/** — pro Projekt ein Folder
- **Templates/** — Vorlagen die Skills/Agents referenzieren können

Editiere diese Datei oder lösche sie — es ist dein Vault.
`;
  const inboxNote = `# Inbox

Schmeiß hier alles rein was du noch nicht weißt wohin damit.
`;
  const dailyNote = `# Daily-Log Template

Verschiebe diese Datei oder ersetz sie mit \`YYYY-MM-DD.md\`.
`;
  writeFileSync(join(MANAGED_VAULT_PATH, "README.md"), readme);
  mkdirSync(join(MANAGED_VAULT_PATH, "Inbox"), { recursive: true });
  writeFileSync(join(MANAGED_VAULT_PATH, "Inbox", "Welcome.md"), inboxNote);
  mkdirSync(join(MANAGED_VAULT_PATH, "Daily"), { recursive: true });
  writeFileSync(join(MANAGED_VAULT_PATH, "Daily", "_template.md"), dailyNote);
  mkdirSync(join(MANAGED_VAULT_PATH, "Projects"), { recursive: true });
  mkdirSync(join(MANAGED_VAULT_PATH, "Templates"), { recursive: true });
}

async function gitInitAndPush(remoteUrl: string, sshKeyPath: string): Promise<{ ok: boolean; error?: string }> {
  const opts = { sshKeyPath };
  const init = await runGit(["init", "-b", "main"], opts);
  if (!init.ok) return { ok: false, error: `git init failed: ${init.stderr}` };
  await runGit(["config", "user.email", "lokyy@local"], opts);
  await runGit(["config", "user.name", "Lokyy"], opts);
  await runGit(["add", "."], opts);
  const commit = await runGit(["commit", "-m", "lokyy: initial vault commit"], opts);
  if (!commit.ok && !/nothing to commit/i.test(commit.stdout + commit.stderr)) {
    return { ok: false, error: `git commit failed: ${commit.stderr}` };
  }
  const remote = await runGit(["remote", "add", "origin", remoteUrl], opts);
  if (!remote.ok) return { ok: false, error: `git remote add failed: ${remote.stderr}` };
  const push = await runGit(["push", "-u", "origin", "main"], opts);
  if (!push.ok) return { ok: false, error: `git push failed: ${push.stderr}` };
  return { ok: true };
}

async function gitClone(remoteUrl: string, sshKeyPath: string): Promise<{ ok: boolean; error?: string }> {
  // git clone refuses non-empty target. Wipe /app/vault contents first.
  for (const entry of readdirSync(MANAGED_VAULT_PATH)) {
    rmSync(join(MANAGED_VAULT_PATH, entry), { recursive: true, force: true });
  }
  const r = await runGit(["clone", remoteUrl, MANAGED_VAULT_PATH], {
    cwd: "/",
    sshKeyPath,
  });
  if (!r.ok) return { ok: false, error: `git clone failed: ${r.stderr}` };
  return { ok: true };
}

function rejectIfNotSshShaped(url: string): string | null {
  const t = url.trim();
  if (/^(git@|ssh:\/\/|file:\/\/)/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) {
    const m = t.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
    const suggest = m && m[1] && m[2] ? `git@${m[1]}:${m[2]}.git` : null;
    return suggest
      ? `HTTPS-URL nicht unterstützt — Lokyy nutzt SSH-Keys. Bitte verwende: ${suggest}`
      : "HTTPS-URL nicht unterstützt — Lokyy nutzt SSH-Keys (git@host:user/repo.git)";
  }
  return "URL-Format nicht erkannt. Erwartet: git@host:user/repo.git";
}

vaultSetup.post("/setup", async (c) => {
  let body: { mode?: string; remoteUrl?: string; init?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const mode = body.mode;
  if (mode !== "local" && mode !== "remote") {
    return c.json({ error: "mode must be 'local' or 'remote'" }, 400);
  }
  if (getVaultRow()) {
    return c.json({ error: "vault already configured — POST /reset first" }, 409);
  }
  if (!vaultIsEmpty()) {
    return c.json({ error: `/app/vault is not empty (${readdirSync(MANAGED_VAULT_PATH).length} entries) — POST /reset to wipe` }, 409);
  }

  if (mode === "local") {
    writeStartVault();
    upsertVault({ mode: "local", remoteUrl: null, sshKeyId: null });
    return c.json({ ok: true, mode: "local", path: MANAGED_VAULT_PATH });
  }

  // mode === 'remote'
  const remoteUrl = body.remoteUrl?.trim();
  if (!remoteUrl) return c.json({ error: "remoteUrl required for mode=remote" }, 400);
  const urlErr = rejectIfNotSshShaped(remoteUrl);
  if (urlErr) return c.json({ error: urlErr }, 400);
  // Reuse the key the wizard already showed (and the user pasted into Forgejo);
  // creating a fresh one here would invalidate that paste.
  const key = getLatestSshKey() ?? (await createSshKey());
  const keyPath = materializePrivateKey(key.id);
  if (body.init === false) {
    return c.json({ error: "use /setup/import for cloning an existing remote" }, 400);
  }
  writeStartVault();
  const result = await gitInitAndPush(remoteUrl, keyPath);
  if (!result.ok) {
    // Roll back the dir so a retry can start clean.
    for (const entry of readdirSync(MANAGED_VAULT_PATH)) {
      rmSync(join(MANAGED_VAULT_PATH, entry), { recursive: true, force: true });
    }
    return c.json({ error: result.error, sshPublicKey: key.publicKey }, 502);
  }
  upsertVault({ mode: "remote", remoteUrl, sshKeyId: key.id });
  return c.json({ ok: true, mode: "remote", remoteUrl, sshPublicKey: key.publicKey });
});

vaultSetup.post("/setup/import", async (c) => {
  let body: { source?: string; remoteUrl?: string; localPath?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (getVaultRow()) return c.json({ error: "vault already configured" }, 409);

  if (body.source === "remote") {
    const remoteUrl = body.remoteUrl?.trim();
    if (!remoteUrl) return c.json({ error: "remoteUrl required" }, 400);
    const urlErr = rejectIfNotSshShaped(remoteUrl);
    if (urlErr) return c.json({ error: urlErr }, 400);
    // Reuse the key the wizard already showed (and the user pasted into Forgejo);
  // creating a fresh one here would invalidate that paste.
  const key = getLatestSshKey() ?? (await createSshKey());
    const keyPath = materializePrivateKey(key.id);
    const result = await gitClone(remoteUrl, keyPath);
    if (!result.ok) {
      return c.json({ error: result.error, sshPublicKey: key.publicKey }, 502);
    }
    upsertVault({ mode: "remote", remoteUrl, sshKeyId: key.id });
    return c.json({ ok: true, mode: "remote", remoteUrl, sshPublicKey: key.publicKey });
  }

  if (body.source === "localPath") {
    const src = body.localPath?.trim();
    if (!src) return c.json({ error: "localPath required" }, 400);
    if (!existsSync(src)) return c.json({ error: `localPath does not exist: ${src}` }, 400);
    if (!statSync(src).isDirectory()) return c.json({ error: "localPath is not a directory" }, 400);
    if (!vaultIsEmpty()) return c.json({ error: "/app/vault not empty" }, 409);
    const fileCount = copyTree(src, MANAGED_VAULT_PATH);
    upsertVault({ mode: "local", remoteUrl: null, sshKeyId: null });
    return c.json({ ok: true, mode: "local", path: MANAGED_VAULT_PATH, fileCount });
  }

  return c.json({ error: "source must be 'remote' or 'localPath'" }, 400);
});

vaultSetup.post("/sync", async (c) => {
  const result = await runVaultSync();
  if (!result.ok) {
    return c.json({ ok: false, step: result.step, error: result.error }, 502);
  }
  return c.json(result);
});

vaultSetup.post("/reset", (c) => {
  for (const entry of readdirSync(MANAGED_VAULT_PATH)) {
    rmSync(join(MANAGED_VAULT_PATH, entry), { recursive: true, force: true });
  }
  // Wipe materialized private keys too so stale ones don't accumulate and so
  // a "permission denied" scenario can't be debugged with the wrong key.
  try {
    for (const entry of readdirSync("/root/.ssh")) {
      if (entry.startsWith("key_")) rmSync(join("/root/.ssh", entry), { force: true });
    }
  } catch {
    /* ignore — dir might not exist yet on first reset */
  }
  clearVault();
  return c.json({ ok: true });
});
