/**
 * Lokyy-Agents — user-created agents distinct from Hermes-Profiles.
 * Hits /api/lokyy/lokyy-agents (not /api/lokyy/agents which is the
 * Hermes-Profile proxy).
 */

export type LokyyAgent = {
  id: string
  name: string
  description?: string
  systemPrompt: string
  model: string
  skills: string[]
  mcps: string[]
  createdAt: string
  updatedAt: string
}

const BASE = '/api/lokyy/lokyy-agents'

export async function listMyAgents(): Promise<LokyyAgent[]> {
  const r = await fetch(BASE, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`listMyAgents: HTTP ${r.status}`)
  return ((await r.json()) as { agents: LokyyAgent[] }).agents
}

export async function getMyAgent(id: string): Promise<LokyyAgent> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`getMyAgent: HTTP ${r.status}`)
  return ((await r.json()) as { agent: LokyyAgent }).agent
}

export async function createMyAgent(agent: Omit<LokyyAgent, 'createdAt' | 'updatedAt'>): Promise<LokyyAgent> {
  const r = await fetch(BASE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent }),
  })
  if (!r.ok) throw new Error(`createMyAgent: HTTP ${r.status} ${await r.text().catch(() => '')}`)
  return ((await r.json()) as { agent: LokyyAgent }).agent
}

export async function updateMyAgent(id: string, agent: Omit<LokyyAgent, 'createdAt' | 'updatedAt'>): Promise<LokyyAgent> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent }),
  })
  if (!r.ok) throw new Error(`updateMyAgent: HTTP ${r.status}`)
  return ((await r.json()) as { agent: LokyyAgent }).agent
}

export async function deleteMyAgent(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!r.ok) throw new Error(`deleteMyAgent: HTTP ${r.status}`)
}
