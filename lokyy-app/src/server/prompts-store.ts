import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'prompts.json')

export type Prompt = {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

type Store = { prompts: Prompt[] }

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) return { prompts: [] }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
  } catch {
    return { prompts: [] }
  }
}

function writeStore(store: Store) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function listPrompts(): Prompt[] {
  return readStore().prompts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createPrompt(input: { title: string; body: string; tags?: string[] }): Prompt {
  const store = readStore()
  const now = new Date().toISOString()
  const prompt: Prompt = {
    id: randomUUID(),
    title: input.title.trim(),
    body: input.body,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
  }
  store.prompts.push(prompt)
  writeStore(store)
  return prompt
}

export function updatePrompt(id: string, patch: Partial<Pick<Prompt, 'title' | 'body' | 'tags'>>): Prompt | null {
  const store = readStore()
  const idx = store.prompts.findIndex((p) => p.id === id)
  if (idx < 0) return null
  const next: Prompt = {
    ...store.prompts[idx],
    ...patch,
    tags: patch.tags ?? store.prompts[idx].tags,
    updatedAt: new Date().toISOString(),
  }
  store.prompts[idx] = next
  writeStore(store)
  return next
}

export function deletePrompt(id: string): boolean {
  const store = readStore()
  const before = store.prompts.length
  store.prompts = store.prompts.filter((p) => p.id !== id)
  if (store.prompts.length === before) return false
  writeStore(store)
  return true
}
