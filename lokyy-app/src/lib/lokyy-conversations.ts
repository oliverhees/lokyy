export type ConvMessage = { role: 'system' | 'user' | 'assistant'; content: string; at: string }
export type Conversation = {
  id: string
  title: string
  model: string
  agentId: string | null
  messages: ConvMessage[]
  createdAt: string
  updatedAt: string
}

const BASE = '/api/lokyy/conversations'

export async function listConversations(): Promise<Conversation[]> {
  const r = await fetch(BASE)
  return (await r.json()).conversations as Conversation[]
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const r = await fetch(`${BASE}/${id}`)
  return (await r.json()).conversation as Conversation | null
}

export async function createConversation(input: { title?: string; agentId?: string | null; model?: string } = {}): Promise<Conversation> {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await r.json()).conversation as Conversation
}

export async function updateConversation(id: string, patch: Partial<Pick<Conversation, 'title' | 'messages' | 'model' | 'agentId'>>): Promise<Conversation> {
  const r = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return (await r.json()).conversation as Conversation
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE}/${id}`, { method: 'DELETE' })
}

export async function appendMessage(id: string, msg: ConvMessage): Promise<Conversation> {
  const r = await fetch(`${BASE}/${id}/append`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
  })
  return (await r.json()).conversation as Conversation
}

export function groupByDate(conversations: Conversation[]): Array<{ label: string; items: Conversation[] }> {
  const groups: Record<string, Conversation[]> = { Heute: [], Gestern: [], 'Letzte 7 Tage': [], 'Letzte 30 Tage': [], Älter: [] }
  const now = Date.now()
  for (const c of conversations) {
    const ageMs = now - new Date(c.updatedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays < 1) groups.Heute.push(c)
    else if (ageDays < 2) groups.Gestern.push(c)
    else if (ageDays < 7) groups['Letzte 7 Tage'].push(c)
    else if (ageDays < 30) groups['Letzte 30 Tage'].push(c)
    else groups.Älter.push(c)
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}
