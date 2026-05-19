/**
 * Settings shape returned by lokyy-os-be GET /api/lokyy/settings.
 *
 * Phase-2c+: the backend returns a *flat* object (no { settings: … } wrapper)
 * with general/notifications/hermes blocks plus a hermesLive flag.
 *
 * Older fields (vaultPath, n8nUrl, ttsEnabled, …) are not yet wired in the
 * backend — they remain typed as optional so the UI can degrade gracefully
 * until those slices land.
 */
export type LokyySettings = {
  // Phase-2c backend blocks
  general?: {
    theme?: string
    language?: string
  }
  notifications?: {
    desktop?: boolean
    sounds?: boolean
  }
  hermes?: Record<string, unknown> | null
  hermesLive?: boolean
  hermesError?: string
  phase?: string

  // Local/dev-only fields (vite middleware in dev, not yet in lokyy-os-be).
  // Kept optional so the UI's legacy sections can opt in only when present.
  vaultPath?: string | null
  n8nUrl?: string | null
  ttsEnabled?: boolean
  sttEnabled?: boolean
  autoOpenArtifacts?: boolean
  thinkingEnabled?: boolean
  chatSidebarCollapsed?: boolean
}

/**
 * Unwraps both shapes:
 *   - Phase-1d vite dev middleware:  { settings: { … } }
 *   - Phase-2c lokyy-os-be:          { general, notifications, hermes, hermesLive, … }
 *
 * Without this unwrap, the FE used to read `(await res.json()).settings`,
 * which returned `undefined` against the new backend and left the
 * settings page stuck on `lade…` (Issue #114).
 */
function unwrap(json: unknown): LokyySettings {
  if (json && typeof json === 'object' && 'settings' in (json as Record<string, unknown>)) {
    return (json as { settings: LokyySettings }).settings
  }
  return json as LokyySettings
}

export async function readSettings(): Promise<LokyySettings> {
  const res = await fetch('/api/lokyy/settings')
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return unwrap(await res.json())
}

export async function patchSettings(patch: Partial<LokyySettings>): Promise<LokyySettings> {
  const res = await fetch('/api/lokyy/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return unwrap(await res.json())
}
