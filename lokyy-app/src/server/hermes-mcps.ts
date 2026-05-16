import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { isMcpDisabled } from './agent-overrides'

export type AgentMcp = {
  id: string
  name: string
  transportType: 'stdio' | 'http' | 'sse' | string
  command?: string
  args?: string[]
  url?: string
  status: 'configured' | 'enabled' | 'disabled'
}

export type McpPreset = {
  id: string
  name: string
  description: string
  category: string
  homepage?: string
  tags?: string[]
  template: {
    name: string
    transportType: 'stdio' | 'http' | 'sse' | string
    command?: string
    args?: string[]
    url?: string
  }
}

const HERMES_HOME = path.join(os.homedir(), '.hermes')

function profileConfigPath(agentId: string): string {
  return agentId === 'default'
    ? path.join(HERMES_HOME, 'config.yaml')
    : path.join(HERMES_HOME, 'profiles', agentId, 'config.yaml')
}

function parseMcpServers(yamlText: string): AgentMcp[] {
  const block = yamlText.match(/^(mcp_servers|mcpServers):\s*\n([\s\S]*?)(?=^\S|\Z)/m)
  if (!block) return []
  const body = block[2]
  if (!body.trim()) return []

  const entries: AgentMcp[] = []
  const lines = body.split('\n')
  let current: Partial<AgentMcp> & { id: string } | null = null

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ')
    const nameMatch = line.match(/^ {2}([\w-]+):\s*$/)
    if (nameMatch) {
      if (current) entries.push({ ...(current as AgentMcp), status: current.status ?? 'configured' })
      current = { id: nameMatch[1], name: nameMatch[1] }
      continue
    }
    if (!current) continue
    const kv = line.match(/^ {4}(\w+):\s*(.*)$/)
    if (kv) {
      const [, key, value] = kv
      const v = value.replace(/^"(.*)"$/, '$1').trim()
      if (key === 'transportType' || key === 'transport') current.transportType = v
      else if (key === 'command') current.command = v
      else if (key === 'url') current.url = v
      else if (key === 'enabled') current.status = v === 'false' ? 'disabled' : 'enabled'
    }
  }
  if (current) entries.push({ ...(current as AgentMcp), status: current.status ?? 'configured' })
  return entries
}

export function listMcpsForAgent(agentId: string): AgentMcp[] {
  const cfg = profileConfigPath(agentId)
  if (!fs.existsSync(cfg)) return []
  const yamlText = fs.readFileSync(cfg, 'utf8')
  const parsed = parseMcpServers(yamlText)
  return parsed.map((m) => ({
    ...m,
    status: isMcpDisabled(agentId, m.id) ? 'disabled' : m.status,
  }))
}

export function listMcpPresets(): McpPreset[] {
  const presetsPath = path.join(HERMES_HOME, 'mcp-presets.json')
  if (!fs.existsSync(presetsPath)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(presetsPath, 'utf8')) as { presets?: McpPreset[] }
    return raw.presets ?? []
  } catch {
    return []
  }
}
