export type HermesSession = {
  id: string
  model: string
  provider: string
  platform: string
  sessionStart: string
  lastUpdated: string
  messageCount: number
  systemPromptPreview: string
}

export async function listSessions(): Promise<HermesSession[]> {
  const res = await fetch('/api/lokyy/sessions')
  if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`)
  const data = (await res.json()) as { sessions: HermesSession[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.sessions
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `vor ${days}d`
  return date.toLocaleDateString()
}
