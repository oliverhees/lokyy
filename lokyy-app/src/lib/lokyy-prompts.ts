export type Prompt = {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

const BASE = '/api/lokyy/prompts'

export async function listPrompts(): Promise<Prompt[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  const data = (await res.json()) as { prompts: Prompt[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.prompts
}

export async function createPrompt(input: { title: string; body: string; tags: string[] }): Promise<Prompt> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  const data = (await res.json()) as { prompt: Prompt; error?: string }
  if (data.error) throw new Error(data.error)
  return data.prompt
}

export async function updatePrompt(id: string, patch: Partial<Pick<Prompt, 'title' | 'body' | 'tags'>>): Promise<Prompt> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  const data = (await res.json()) as { prompt: Prompt; error?: string }
  if (data.error) throw new Error(data.error)
  return data.prompt
}

export async function deletePrompt(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
}
