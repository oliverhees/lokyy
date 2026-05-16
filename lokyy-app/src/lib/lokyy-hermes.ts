async function get<T>(route: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v))
  const url = `/api/lokyy/hermes-${route}${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${route} failed: ${res.status}`)
  return (await res.json()) as T
}

export type InsightsData = {
  raw: string
  summary: { sessions?: number; messages?: number; toolCalls?: number; totalTokens?: number; activeTime?: string }
}
export const fetchInsights = (days = 30) => get<InsightsData>('insights', { days })

export type MemoryStatus = {
  builtinActive: boolean
  activeProvider: string | null
  installedProviders: Array<{ name: string; requiresKey: boolean; mode: string }>
  raw: string
}
export const fetchMemory = () => get<MemoryStatus>('memory')

export type LogsResponse = { raw: string; ok: boolean; error: string }
export const fetchLogs = (opts: { lines?: number; level?: string; component?: string } = {}) =>
  get<LogsResponse>('logs', opts)

export const fetchDoctor = () => get<{ raw: string; ok: boolean }>('doctor')
export const fetchBackup = () => get<{ ok: boolean; output: string; path: string | null }>('backup')

export type WebhooksData = { enabled: boolean; webhooks: unknown[]; raw: string }
export const fetchWebhooks = () => get<WebhooksData>('webhooks')

export type Plugin = { name: string; status: string; version: string; description: string; source: string }
export const fetchPlugins = () => get<{ plugins: Plugin[]; raw: string }>('plugins')

export type Tool = { name: string; emoji: string; description: string; enabled: boolean }
export const fetchTools = () => get<{ tools: Tool[]; raw: string }>('tools')

export type CuratorStatus = { enabled: boolean; runs: number; lastRun: string; lastSummary: string; interval: string; raw: string }
export const fetchCurator = () => get<CuratorStatus>('curator')

export type ChannelPlatform = { id: string; name: string; description: string; configured: boolean }
export const fetchChannels = () => get<ChannelPlatform[]>('channels')
