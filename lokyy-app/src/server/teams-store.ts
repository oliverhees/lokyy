import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'teams.json')

export type Team = {
  id: string
  name: string
  description: string
  memberAgentIds: string[]
  createdAt: string
  updatedAt: string
}

type Store = { teams: Team[] }

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) return { teams: [] }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
  } catch {
    return { teams: [] }
  }
}

function writeStore(store: Store) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function listTeams(): Team[] {
  return readStore().teams.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createTeam(input: { name: string; description?: string; memberAgentIds?: string[] }): Team {
  const store = readStore()
  const now = new Date().toISOString()
  const team: Team = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    memberAgentIds: input.memberAgentIds ?? [],
    createdAt: now,
    updatedAt: now,
  }
  store.teams.push(team)
  writeStore(store)
  return team
}

export function updateTeam(
  id: string,
  patch: Partial<Pick<Team, 'name' | 'description' | 'memberAgentIds'>>,
): Team | null {
  const store = readStore()
  const idx = store.teams.findIndex((t) => t.id === id)
  if (idx < 0) return null
  const next: Team = {
    ...store.teams[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  store.teams[idx] = next
  writeStore(store)
  return next
}

export function deleteTeam(id: string): boolean {
  const store = readStore()
  const before = store.teams.length
  store.teams = store.teams.filter((t) => t.id !== id)
  if (store.teams.length === before) return false
  writeStore(store)
  return true
}
