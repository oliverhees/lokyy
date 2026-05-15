export type Agent = {
  id: string
  name: string
  model: string
  provider: string
  skillCount: number
  mcpCount: number
  hasSoul: boolean
  description: string
  isDefault: boolean
  configPath: string
}

export async function listAgents(): Promise<Agent[]> {
  const res = await fetch('/api/lokyy/agents')
  if (!res.ok) throw new Error(`Failed to load agents: ${res.status}`)
  const data = (await res.json()) as { agents: Agent[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.agents
}

export type AgentSkill = {
  id: string
  name: string
  category: string
  description: string
  version: string
  author: string
  source: 'builtin' | 'user'
  status: 'enabled' | 'disabled'
}

export async function listAgentSkills(agentId: string): Promise<AgentSkill[]> {
  const res = await fetch(`/api/lokyy/agents/${encodeURIComponent(agentId)}/skills`)
  if (!res.ok) throw new Error(`Failed to load skills: ${res.status}`)
  const data = (await res.json()) as { skills: AgentSkill[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.skills
}

export type AgentMcp = {
  id: string
  name: string
  transportType: string
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
    transportType: string
    command?: string
    args?: string[]
    url?: string
  }
}

export async function listAgentMcps(agentId: string): Promise<{ mcps: AgentMcp[]; presets: McpPreset[] }> {
  const res = await fetch(`/api/lokyy/agents/${encodeURIComponent(agentId)}/mcps`)
  if (!res.ok) throw new Error(`Failed to load mcps: ${res.status}`)
  const data = (await res.json()) as { mcps: AgentMcp[]; presets: McpPreset[]; error?: string }
  if (data.error) throw new Error(data.error)
  return { mcps: data.mcps, presets: data.presets }
}

async function postToggle(path: string): Promise<{ nowEnabled: boolean }> {
  const res = await fetch(path, { method: 'POST' })
  if (!res.ok) throw new Error(`Toggle failed: ${res.status}`)
  return (await res.json()) as { nowEnabled: boolean }
}

export function toggleAgentSkill(agentId: string, skillId: string): Promise<{ nowEnabled: boolean }> {
  return postToggle(`/api/lokyy/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}/toggle`)
}

export function toggleAgentMcp(agentId: string, mcpId: string): Promise<{ nowEnabled: boolean }> {
  return postToggle(`/api/lokyy/agents/${encodeURIComponent(agentId)}/mcps/${encodeURIComponent(mcpId)}/toggle`)
}

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#06b6d4'],
  ['#10b981', '#14b8a6'],
  ['#f59e0b', '#f97316'],
  ['#ec4899', '#f43f5e'],
  ['#a855f7', '#d946ef'],
  ['#3b82f6', '#0ea5e9'],
  ['#14b8a6', '#22c55e'],
  ['#f43f5e', '#ec4899'],
  ['#fb923c', '#f59e0b'],
]

export function gradientForAgent(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const palette = GRADIENTS[Math.abs(hash) % GRADIENTS.length]
  return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
