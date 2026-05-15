import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'conversations.json')

export type ConvMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
  at: string
}

export type Conversation = {
  id: string
  title: string
  model: string
  agentId: string | null
  messages: ConvMessage[]
  createdAt: string
  updatedAt: string
}

type Store = { conversations: Conversation[] }

function ensureDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStore(): Store {
  if (!fs.existsSync(STORE_PATH)) return { conversations: [] }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store
  } catch {
    return { conversations: [] }
  }
}

function writeStore(store: Store) {
  ensureDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2))
}

export function listConversations(): Conversation[] {
  return readStore().conversations.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function getConversation(id: string): Conversation | null {
  return readStore().conversations.find((c) => c.id === id) ?? null
}

export function createConversation(input: {
  title?: string
  model?: string
  agentId?: string | null
}): Conversation {
  const store = readStore()
  const now = new Date().toISOString()
  const conv: Conversation = {
    id: randomUUID(),
    title: input.title?.trim() || 'Neuer Chat',
    model: input.model ?? 'hermes-agent',
    agentId: input.agentId ?? null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  store.conversations.push(conv)
  writeStore(store)
  return conv
}

export function updateConversation(
  id: string,
  patch: Partial<Pick<Conversation, 'title' | 'messages' | 'model' | 'agentId'>>,
): Conversation | null {
  const store = readStore()
  const idx = store.conversations.findIndex((c) => c.id === id)
  if (idx < 0) return null
  const next: Conversation = {
    ...store.conversations[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  store.conversations[idx] = next
  writeStore(store)
  return next
}

export function deleteConversation(id: string): boolean {
  const store = readStore()
  const before = store.conversations.length
  store.conversations = store.conversations.filter((c) => c.id !== id)
  if (store.conversations.length === before) return false
  writeStore(store)
  return true
}

export function appendMessage(id: string, message: ConvMessage): Conversation | null {
  const store = readStore()
  const idx = store.conversations.findIndex((c) => c.id === id)
  if (idx < 0) return null
  store.conversations[idx].messages.push(message)
  store.conversations[idx].updatedAt = new Date().toISOString()
  if (store.conversations[idx].title === 'Neuer Chat' && message.role === 'user') {
    store.conversations[idx].title = message.content.slice(0, 60)
  }
  writeStore(store)
  return store.conversations[idx]
}
