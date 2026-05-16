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

const BASE = '/api/lokyy/workflows'

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).workflows as Workflow[]
}

export async function createWorkflow(input: { name: string; description: string; steps: WorkflowStep[] }): Promise<Workflow> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).workflow as Workflow
}

export async function updateWorkflow(id: string, patch: Partial<Pick<Workflow, 'name' | 'description' | 'steps'>>): Promise<Workflow> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).workflow as Workflow
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
}
