import { runHermes, stripBoxDrawing } from './hermes-cli'

// =============== INSIGHTS ===============
export type InsightsData = {
  raw: string
  summary: { sessions?: number; messages?: number; toolCalls?: number; totalTokens?: number; activeTime?: string }
}

export function getInsights(days = 30): InsightsData {
  const r = runHermes(['insights', '--days', String(days)])
  const text = stripBoxDrawing(r.stdout)
  const grab = (label: string) => {
    const m = text.match(new RegExp(`${label}:?\\s+([\\d.,]+|~?[\\dhms ]+)`, 'i'))
    return m?.[1]?.trim()
  }
  const num = (v?: string) => (v ? Number(v.replace(/[.,]/g, '')) : undefined)
  return {
    raw: r.stdout,
    summary: {
      sessions: num(grab('Sessions')),
      messages: num(grab('Messages')),
      toolCalls: num(grab('Tool calls')),
      totalTokens: num(grab('Total tokens')),
      activeTime: grab('Active time'),
    },
  }
}

// =============== MEMORY ===============
export type MemoryProvider = { name: string; requiresKey: boolean; mode: string }
export type MemoryStatus = {
  builtinActive: boolean
  activeProvider: string | null
  installedProviders: MemoryProvider[]
  raw: string
}

export function getMemoryStatus(): MemoryStatus {
  const r = runHermes(['memory', 'status'])
  const text = stripBoxDrawing(r.stdout)
  const providers: MemoryProvider[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*•\s*(\w+)\s*\(([^)]+)\)/)
    if (m) {
      providers.push({
        name: m[1],
        requiresKey: /requires/i.test(m[2]),
        mode: m[2].trim(),
      })
    }
  }
  const activeMatch = text.match(/Provider:\s*\(?(.+?)\)?$/m)
  const activeProvider =
    activeMatch && !/^none/i.test(activeMatch[1]) ? activeMatch[1].trim() : null
  return {
    builtinActive: /Built-in:\s*always active/i.test(text),
    activeProvider,
    installedProviders: providers,
    raw: r.stdout,
  }
}

// =============== LOGS ===============
export function getLogs(opts: { lines?: number; level?: string; component?: string }): { raw: string; ok: boolean; error: string } {
  const args = ['logs', '-n', String(opts.lines ?? 200)]
  if (opts.level) args.push('--level', opts.level)
  if (opts.component) args.push('--component', opts.component)
  const r = runHermes(args)
  return { raw: r.stdout, ok: r.ok, error: r.stderr }
}

// =============== DOCTOR ===============
export function getDoctorReport(): { raw: string; ok: boolean } {
  const r = runHermes(['doctor'])
  return { raw: r.stdout, ok: r.ok }
}

// =============== BACKUP ===============
export function runBackup(): { ok: boolean; output: string; path: string | null } {
  const r = runHermes(['backup', '--quick'])
  const pathMatch = r.stdout.match(/(\/[^\s]+\.zip)/)
  return { ok: r.ok, output: r.stdout || r.stderr, path: pathMatch?.[1] ?? null }
}

// =============== WEBHOOKS ===============
export type Webhook = { name?: string; url?: string; events?: string; status?: string; raw: string }
export function listWebhooks(): { enabled: boolean; webhooks: Webhook[]; raw: string } {
  const r = runHermes(['webhook', 'list'])
  const text = stripBoxDrawing(r.stdout)
  const enabled = !/Webhook platform is not enabled/i.test(text)
  return { enabled, webhooks: [], raw: r.stdout }
}

// =============== PLUGINS ===============
export type Plugin = { name: string; status: string; version: string; description: string; source: string }
export function listPlugins(): { plugins: Plugin[]; raw: string } {
  const r = runHermes(['plugins', 'list'])
  const text = stripBoxDrawing(r.stdout)
  const plugins: Plugin[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^Name/i.test(line) || /^Plugins/i.test(line)) continue
    const cols = line.split(/\s{2,}/).filter(Boolean)
    if (cols.length >= 4 && /^\w/.test(cols[0])) {
      plugins.push({
        name: cols[0],
        status: cols[1] ?? '',
        version: cols[2] ?? '',
        description: cols[3] ?? '',
        source: cols[4] ?? '',
      })
    }
  }
  return { plugins, raw: r.stdout }
}

// =============== TOOLS ===============
export type Tool = { name: string; emoji: string; description: string; enabled: boolean }
export function listTools(): { tools: Tool[]; raw: string } {
  const r = runHermes(['tools', 'list'])
  const text = stripBoxDrawing(r.stdout)
  const tools: Tool[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([✓✗])\s+(enabled|disabled)\s+(\w+)\s+(\S+)\s+(.+)$/)
    if (m) {
      tools.push({
        enabled: m[2] === 'enabled',
        name: m[3],
        emoji: m[4],
        description: m[5].trim(),
      })
    }
  }
  return { tools, raw: r.stdout }
}

// =============== CURATOR ===============
export type CuratorStatus = {
  enabled: boolean
  runs: number
  lastRun: string
  lastSummary: string
  interval: string
  raw: string
}
export function getCuratorStatus(): CuratorStatus {
  const r = runHermes(['curator', 'status'])
  const text = stripBoxDrawing(r.stdout)
  const grab = (k: string) => text.match(new RegExp(`${k}:?\\s+(.+)`, 'i'))?.[1]?.trim() ?? ''
  return {
    enabled: /curator:\s*ENABLED/i.test(text),
    runs: Number(grab('runs')) || 0,
    lastRun: grab('last run'),
    lastSummary: grab('last summary'),
    interval: grab('interval'),
    raw: r.stdout,
  }
}

// =============== CHANNELS / PLATFORMS ===============
export type ChannelPlatform = {
  id: string
  name: string
  description: string
  configured: boolean
}

const PLATFORMS: ChannelPlatform[] = [
  { id: 'telegram', name: 'Telegram', description: 'Bot via @BotFather token, optional username allowlist.', configured: false },
  { id: 'discord', name: 'Discord', description: 'Bot via Application token, channel allowlists.', configured: false },
  { id: 'slack', name: 'Slack', description: 'OAuth-Bot mit App-Manifest, Channel-allowlists.', configured: false },
  { id: 'whatsapp', name: 'WhatsApp', description: 'WhatsApp Business Cloud API.', configured: false },
  { id: 'signal', name: 'Signal', description: 'signal-cli mit Account-Linking.', configured: false },
  { id: 'matrix', name: 'Matrix', description: 'Matrix-Account mit Room-Membership.', configured: false },
  { id: 'mattermost', name: 'Mattermost', description: 'Bot-Token + Server-URL.', configured: false },
  { id: 'teams', name: 'MS Teams', description: 'Microsoft-Teams Bot via Azure.', configured: false },
  { id: 'google_chat', name: 'Google Chat', description: 'Google Workspace Chat App.', configured: false },
  { id: 'homeassistant', name: 'Home Assistant', description: 'HA conversation entity bridge.', configured: false },
]

export function listChannels(): ChannelPlatform[] {
  // For Phase 8.10 simple: read ~/.hermes/config.yaml and check each platform key for non-empty config.
  // Pragmatic fallback: parse `hermes gateway list` for hint, otherwise report all as not configured.
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const os = require('node:os') as typeof import('node:os')
    const cfgPath = path.join(os.homedir(), '.hermes', 'config.yaml')
    if (!fs.existsSync(cfgPath)) return PLATFORMS
    const text = fs.readFileSync(cfgPath, 'utf8')
    return PLATFORMS.map((p) => {
      // Heuristic: configured if there's a non-empty bot_token / token / api_key in the platform block
      const block = text.match(new RegExp(`^\\s*${p.id}:[\\s\\S]*?(?=^\\S|\\Z)`, 'm'))?.[0] ?? ''
      const configured = /(?:bot_token|token|api_key|client_id|enabled):\s*[^\s"'][^\s]*/m.test(block) && !/enabled:\s*false/i.test(block)
      return { ...p, configured }
    })
  } catch {
    return PLATFORMS
  }
}
