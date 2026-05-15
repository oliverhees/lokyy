export type Team = {
  id: string
  name: string
  description: string
  memberAgentIds: string[]
  createdAt: string
  updatedAt: string
}

const BASE = '/api/lokyy/teams'

export async function listTeams(): Promise<Team[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).teams as Team[]
}

export async function createTeam(input: { name: string; description: string; memberAgentIds: string[] }): Promise<Team> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).team as Team
}

export async function updateTeam(id: string, patch: Partial<Pick<Team, 'name' | 'description' | 'memberAgentIds'>>): Promise<Team> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).team as Team
}

export async function deleteTeam(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
}
