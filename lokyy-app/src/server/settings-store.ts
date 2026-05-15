import fs from 'node:fs'
import path from 'node:path'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'settings.json')

export type LokyySettings = {
  vaultPath: string | null
  n8nUrl: string | null
  ttsEnabled: boolean
  sttEnabled: boolean
}

const DEFAULTS: LokyySettings = {
  vaultPath: null,
  n8nUrl: null,
  ttsEnabled: false,
  sttEnabled: false,
}

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function readSettings(): LokyySettings {
  if (!fs.existsSync(STORE_PATH)) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Partial<LokyySettings>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(patch: Partial<LokyySettings>): LokyySettings {
  ensureDir()
  const current = readSettings()
  const next = { ...current, ...patch }
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2))
  return next
}
