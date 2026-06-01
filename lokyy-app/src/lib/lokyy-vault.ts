export type VaultEntry = {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  modified?: string
}

export type VaultListResponse = {
  configured: boolean
  root: string | null
  entries: VaultEntry[]
  path: string
}

export type VaultReadResponse = {
  configured: boolean
  root: string | null
  content: string
  path: string
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

/**
 * Detects HTTPS Forgejo/GitHub/GitLab URLs and converts them to the SSH form.
 * Returns null if input is already SSH-shaped or unrecognized.
 *
 * Examples:
 *   https://forgejo.paione.de/oliver/vault     → git@forgejo.paione.de:oliver/vault.git
 *   https://github.com/user/repo.git           → git@github.com:user/repo.git
 *   https://gitlab.com/group/sub/repo          → git@gitlab.com:group/sub/repo.git
 */
export function httpsToSsh(url: string): string | null {
  const trimmed = url.trim()
  const m = trimmed.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/i)
  if (!m) return null
  const host = m[1]
  const repoPath = m[2]
  if (!host || !repoPath) return null
  return `git@${host}:${repoPath}.git`
}

export function looksLikeSshUrl(url: string): boolean {
  const t = url.trim()
  return /^(git@|ssh:\/\/)/.test(t) || /^file:\/\//.test(t)
}

// ─── Phase-3 B1 — Setup endpoints ─────────────────────────────────────────────

export type VaultStatus =
  | { configured: false; legacyPath: string | null }
  | {
      configured: true
      mode: 'local' | 'remote'
      remoteUrl: string | null
      lastSyncAt: number | null
      syncError: string | null
      sshPublicKey: string | null
    }

export async function getVaultStatus(): Promise<VaultStatus> {
  const r = await fetch('/api/lokyy/vault/setup/status')
  if (!r.ok) throw new Error(`status HTTP ${r.status}`)
  return (await r.json()) as VaultStatus
}

export async function getVaultSshKey(): Promise<{ sshKeyId: string; publicKey: string }> {
  const r = await fetch('/api/lokyy/vault/setup/ssh-key')
  if (!r.ok) throw new Error(`ssh-key HTTP ${r.status}`)
  return (await r.json()) as { sshKeyId: string; publicKey: string }
}

export type SetupLocalResult = { ok: true; mode: 'local'; path: string }
export type SetupRemoteResult = { ok: true; mode: 'remote'; remoteUrl: string; sshPublicKey: string }
export type SetupErrorResult = { error: string; sshPublicKey?: string }

export async function vaultSetupLocal(): Promise<SetupLocalResult | SetupErrorResult> {
  const r = await fetch('/api/lokyy/vault/setup/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'local' }),
  })
  return (await r.json()) as SetupLocalResult | SetupErrorResult
}

export async function vaultSetupRemoteInit(remoteUrl: string): Promise<SetupRemoteResult | SetupErrorResult> {
  const r = await fetch('/api/lokyy/vault/setup/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'remote', remoteUrl, init: true }),
  })
  return (await r.json()) as SetupRemoteResult | SetupErrorResult
}

export async function vaultImportRemote(remoteUrl: string): Promise<SetupRemoteResult | SetupErrorResult> {
  const r = await fetch('/api/lokyy/vault/setup/setup/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'remote', remoteUrl }),
  })
  return (await r.json()) as SetupRemoteResult | SetupErrorResult
}

export async function vaultImportLocalPath(
  localPath: string,
): Promise<(SetupLocalResult & { fileCount: number }) | SetupErrorResult> {
  const r = await fetch('/api/lokyy/vault/setup/setup/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'localPath', localPath }),
  })
  return (await r.json()) as (SetupLocalResult & { fileCount: number }) | SetupErrorResult
}

export type VaultSyncResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; committed: boolean; pulled: string; pushed: string }
  | { ok: false; step: string; error: string }

export async function vaultSync(): Promise<VaultSyncResult> {
  const r = await fetch('/api/lokyy/vault/setup/sync', { method: 'POST' })
  return (await r.json()) as VaultSyncResult
}

export async function vaultReset(): Promise<{ ok: boolean }> {
  const r = await fetch('/api/lokyy/vault/setup/reset', { method: 'POST' })
  return (await r.json()) as { ok: boolean }
}

// ─── Reader endpoints (existing) ──────────────────────────────────────────────

export async function listVault(relPath = ''): Promise<VaultListResponse> {
  const res = await fetch(`/api/lokyy/vault?path=${encodeURIComponent(relPath)}`)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()) as VaultListResponse
}

export async function readVault(relPath: string): Promise<VaultReadResponse> {
  const res = await fetch(`/api/lokyy/vault?action=read&path=${encodeURIComponent(relPath)}`)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()) as VaultReadResponse
}
