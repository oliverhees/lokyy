import fs from 'node:fs'
import path from 'node:path'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'integrations.json')

export type IntegrationStatus = 'connected' | 'disconnected'

export type IntegrationProvider = {
  id: string
  name: string
  description: string
  category: 'calendar' | 'email' | 'crm' | 'docs' | 'comms' | 'dev'
  homepage: string
}

export const PROVIDERS: IntegrationProvider[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Lese und plane Termine aus deinem Google-Kalender.',
    category: 'calendar',
    homepage: 'https://calendar.google.com',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Lies und triagiere Mails aus deinem Gmail-Postfach.',
    category: 'email',
    homepage: 'https://gmail.com',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Workspace-Inhalte und Datenbanken aus Notion synchronisieren.',
    category: 'docs',
    homepage: 'https://notion.so',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Tickets, Projekte und Cycles aus Linear pullen.',
    category: 'dev',
    homepage: 'https://linear.app',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Channels lesen, posten, threads zusammenfassen.',
    category: 'comms',
    homepage: 'https://slack.com',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Issues, PRs und Repos aus deinen GitHub-Workspaces.',
    category: 'dev',
    homepage: 'https://github.com',
  },
]

type Store = { connected: Record<string, { connectedAt: string }> }

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) return { connected: {} }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
  } catch {
    return { connected: {} }
  }
}

function writeStore(store: Store) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function listIntegrations(): Array<IntegrationProvider & { status: IntegrationStatus; connectedAt?: string }> {
  const store = readStore()
  return PROVIDERS.map((p) => ({
    ...p,
    status: store.connected[p.id] ? 'connected' : 'disconnected',
    connectedAt: store.connected[p.id]?.connectedAt,
  }))
}

export function connectIntegration(id: string): { ok: boolean } {
  if (!PROVIDERS.some((p) => p.id === id)) return { ok: false }
  const store = readStore()
  store.connected[id] = { connectedAt: new Date().toISOString() }
  writeStore(store)
  return { ok: true }
}

export function disconnectIntegration(id: string): { ok: boolean } {
  const store = readStore()
  delete store.connected[id]
  writeStore(store)
  return { ok: true }
}
