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
