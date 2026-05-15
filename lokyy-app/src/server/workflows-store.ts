import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'workflows.json')

export type WorkflowStep = {
  id: string
  agentId: string
  prompt: string
}

export type Workflow = {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

type Store = { workflows: Workflow[] }

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) return { workflows: [] }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
  } catch {
    return { workflows: [] }
  }
}

function writeStore(store: Store) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function listWorkflows(): Workflow[] {
  return readStore().workflows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createWorkflow(input: {
  name: string
  description?: string
  steps?: WorkflowStep[]
}): Workflow {
  const store = readStore()
  const now = new Date().toISOString()
  const wf: Workflow = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    steps: input.steps ?? [],
    createdAt: now,
    updatedAt: now,
  }
  store.workflows.push(wf)
  writeStore(store)
  return wf
}

export function updateWorkflow(
  id: string,
  patch: Partial<Pick<Workflow, 'name' | 'description' | 'steps'>>,
): Workflow | null {
  const store = readStore()
  const idx = store.workflows.findIndex((w) => w.id === id)
  if (idx < 0) return null
  const next: Workflow = {
    ...store.workflows[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  store.workflows[idx] = next
  writeStore(store)
  return next
}

export function deleteWorkflow(id: string): boolean {
  const store = readStore()
  const before = store.workflows.length
  store.workflows = store.workflows.filter((w) => w.id !== id)
  if (store.workflows.length === before) return false
  writeStore(store)
  return true
}
