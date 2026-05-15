export type LokyySettings = {
  vaultPath: string | null
  n8nUrl: string | null
  ttsEnabled: boolean
  sttEnabled: boolean
}

export async function readSettings(): Promise<LokyySettings> {
  const res = await fetch('/api/lokyy/settings')
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).settings as LokyySettings
}

export async function patchSettings(patch: Partial<LokyySettings>): Promise<LokyySettings> {
  const res = await fetch('/api/lokyy/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).settings as LokyySettings
}
