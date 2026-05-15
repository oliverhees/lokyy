import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type HermesAgentSummary = {
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

const HERMES_HOME = path.join(os.homedir(), '.hermes')

function readConfigYaml(profileDir: string) {
  const cfgPath = path.join(profileDir, 'config.yaml')
  if (!fs.existsSync(cfgPath)) return null
  const raw = fs.readFileSync(cfgPath, 'utf8')
  const model = raw.match(/^\s*default:\s*(\S+)/m)?.[1] ?? 'unknown'
  const provider = raw.match(/^\s*provider:\s*(\S+)/m)?.[1] ?? 'unknown'
  return { model, provider, raw }
}

function countSkills(profileDir: string): number {
  const skillsDir = path.join(profileDir, 'skills')
  if (!fs.existsSync(skillsDir)) return 0
  let count = 0
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subDir = path.join(skillsDir, entry.name)
      const inner = fs.readdirSync(subDir, { withFileTypes: true })
      const direct = inner.filter((e) => e.isDirectory()).length
      count += direct || 1
    }
  }
  return count
}

function countMcps(raw: string): number {
  const mcpBlock = raw.match(/^mcp[_-]?servers?:\s*([\s\S]*?)(?=^\S)/m)
  if (!mcpBlock) return 0
  const entries = mcpBlock[1].match(/^\s{2}\w/gm)
  return entries?.length ?? 0
}

function readSoulFirstLine(profileDir: string): string {
  const soulPath = path.join(profileDir, 'SOUL.md')
  if (!fs.existsSync(soulPath)) return ''
  const raw = fs.readFileSync(soulPath, 'utf8').trim()
  const firstSentence = raw.split(/\.\s/)[0]
  return firstSentence.length > 220 ? firstSentence.slice(0, 217) + '…' : firstSentence
}

export function listAgents(): HermesAgentSummary[] {
  const agents: HermesAgentSummary[] = []

  const defaultCfg = readConfigYaml(HERMES_HOME)
  if (defaultCfg) {
    agents.push({
      id: 'default',
      name: 'Default',
      model: defaultCfg.model,
      provider: defaultCfg.provider,
      skillCount: countSkills(HERMES_HOME),
      mcpCount: countMcps(defaultCfg.raw),
      hasSoul: fs.existsSync(path.join(HERMES_HOME, 'SOUL.md')),
      description: readSoulFirstLine(HERMES_HOME),
      isDefault: true,
      configPath: HERMES_HOME,
    })
  }

  const profilesDir = path.join(HERMES_HOME, 'profiles')
  if (fs.existsSync(profilesDir)) {
    for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(profilesDir, entry.name)
      const cfg = readConfigYaml(dir)
      if (!cfg) continue
      agents.push({
        id: entry.name,
        name: entry.name,
        model: cfg.model,
        provider: cfg.provider,
        skillCount: countSkills(dir),
        mcpCount: countMcps(cfg.raw),
        hasSoul: fs.existsSync(path.join(dir, 'SOUL.md')),
        description: readSoulFirstLine(dir),
        isDefault: false,
        configPath: dir,
      })
    }
  }

  return agents
}
