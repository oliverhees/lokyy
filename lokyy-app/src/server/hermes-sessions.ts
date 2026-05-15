import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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

const SESSIONS_DIR = path.join(os.homedir(), '.hermes', 'sessions')

type RawSession = {
  session_id?: string
  model?: string
  base_url?: string
  platform?: string
  session_start?: string
  last_updated?: string
  system_prompt?: string
  messages?: unknown[]
}

function providerFromBaseUrl(url?: string): string {
  if (!url) return 'unknown'
  if (url.includes('anthropic')) return 'anthropic'
  if (url.includes('openai')) return 'openai'
  if (url.includes('googleapis') || url.includes('gemini')) return 'google'
  return new URL(url).hostname
}

function readSession(file: string): HermesSession | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawSession
    if (!raw.session_id) return null
    const sp = raw.system_prompt ?? ''
    const preview = sp.length > 240 ? sp.slice(0, 237) + '…' : sp
    return {
      id: raw.session_id,
      model: raw.model ?? 'unknown',
      provider: providerFromBaseUrl(raw.base_url),
      platform: raw.platform ?? 'unknown',
      sessionStart: raw.session_start ?? '',
      lastUpdated: raw.last_updated ?? raw.session_start ?? '',
      messageCount: Array.isArray(raw.messages) ? raw.messages.length : 0,
      systemPromptPreview: preview,
    }
  } catch {
    return null
  }
}

export function listSessions(): HermesSession[] {
  if (!fs.existsSync(SESSIONS_DIR)) return []
  const files = fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(SESSIONS_DIR, f))
  const sessions: HermesSession[] = []
  for (const f of files) {
    const s = readSession(f)
    if (s) sessions.push(s)
  }
  return sessions.sort((a, b) => (a.lastUpdated < b.lastUpdated ? 1 : -1))
}
