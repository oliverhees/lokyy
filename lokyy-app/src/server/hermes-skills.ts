import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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

const HERMES_HOME = path.join(os.homedir(), '.hermes')

function profileSkillsRoot(agentId: string): string {
  if (agentId === 'default') return path.join(HERMES_HOME, 'skills')
  return path.join(HERMES_HOME, 'profiles', agentId, 'skills')
}

function parseFrontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1').trim()
  }
  return out
}

function readSkill(categoryDir: string, skillName: string, category: string): AgentSkill | null {
  const skillDir = path.join(categoryDir, skillName)
  const skillFile = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) return null
  const raw = fs.readFileSync(skillFile, 'utf8')
  const fm = parseFrontmatter(raw)
  return {
    id: `${category}/${skillName}`,
    name: fm.name || skillName,
    category,
    description: fm.description || '',
    version: fm.version || '',
    author: fm.author || '',
    source: 'builtin',
    status: 'enabled',
  }
}

export function listSkillsForAgent(agentId: string): AgentSkill[] {
  const root = profileSkillsRoot(agentId)
  if (!fs.existsSync(root)) return []
  const skills: AgentSkill[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const categoryDir = path.join(root, entry.name)
    const inner = fs.readdirSync(categoryDir, { withFileTypes: true })
    const hasSubDirs = inner.some((e) => e.isDirectory())
    if (hasSubDirs) {
      for (const sub of inner) {
        if (sub.isDirectory()) {
          const s = readSkill(categoryDir, sub.name, entry.name)
          if (s) skills.push(s)
        }
      }
    } else {
      const s = readSkill(root, entry.name, '')
      if (s) skills.push(s)
    }
  }
  return skills.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.name.localeCompare(b.name)
  })
}
