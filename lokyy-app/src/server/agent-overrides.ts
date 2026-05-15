import fs from 'node:fs'
import path from 'node:path'

const OVERRIDES_PATH = path.resolve(process.cwd(), 'data', 'agent-overrides.json')

export type AgentOverrides = {
  /** disabled skill IDs (category/name format) per agent */
  disabledSkills: Record<string, string[]>
  /** disabled mcp IDs per agent */
  disabledMcps: Record<string, string[]>
}

function emptyOverrides(): AgentOverrides {
  return { disabledSkills: {}, disabledMcps: {} }
}

function ensureDir() {
  const dir = path.dirname(OVERRIDES_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function readOverrides(): AgentOverrides {
  if (!fs.existsSync(OVERRIDES_PATH)) return emptyOverrides()
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AgentOverrides>
    return {
      disabledSkills: parsed.disabledSkills ?? {},
      disabledMcps: parsed.disabledMcps ?? {},
    }
  } catch {
    return emptyOverrides()
  }
}

function writeOverrides(data: AgentOverrides) {
  ensureDir()
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2))
}

function toggleInList(list: string[], id: string): { list: string[]; nowDisabled: boolean } {
  if (list.includes(id)) {
    return { list: list.filter((x) => x !== id), nowDisabled: false }
  }
  return { list: [...list, id], nowDisabled: true }
}

export function toggleSkill(agentId: string, skillId: string): { nowEnabled: boolean } {
  const overrides = readOverrides()
  const current = overrides.disabledSkills[agentId] ?? []
  const { list, nowDisabled } = toggleInList(current, skillId)
  overrides.disabledSkills[agentId] = list
  writeOverrides(overrides)
  return { nowEnabled: !nowDisabled }
}

export function toggleMcp(agentId: string, mcpId: string): { nowEnabled: boolean } {
  const overrides = readOverrides()
  const current = overrides.disabledMcps[agentId] ?? []
  const { list, nowDisabled } = toggleInList(current, mcpId)
  overrides.disabledMcps[agentId] = list
  writeOverrides(overrides)
  return { nowEnabled: !nowDisabled }
}

export function isSkillDisabled(agentId: string, skillId: string): boolean {
  const overrides = readOverrides()
  return (overrides.disabledSkills[agentId] ?? []).includes(skillId)
}

export function isMcpDisabled(agentId: string, mcpId: string): boolean {
  const overrides = readOverrides()
  return (overrides.disabledMcps[agentId] ?? []).includes(mcpId)
}
