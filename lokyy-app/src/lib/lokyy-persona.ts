/**
 * Client for the SOUL.md (Hermes persona) + USER.md (stable user facts)
 * editor endpoints — Issue #152.
 *
 * Both files live in the lokyy-hermes container at /opt/data/SOUL.md and
 * /opt/data/USER.md. Hermes reads them fresh on every chat-message, so a
 * save here takes effect on the next user prompt — no restart.
 */
export type EditableFile = {
  ok: boolean
  path: string
  content: string
  exists: boolean
}

async function getFile(slug: 'hermes-persona' | 'hermes-user-facts'): Promise<EditableFile> {
  const r = await fetch(`/api/lokyy/${slug}`)
  const data = (await r.json()) as Partial<EditableFile> & { error?: string }
  if (data.error) throw new Error(data.error)
  return {
    ok: data.ok ?? false,
    path: data.path ?? '',
    content: data.content ?? '',
    exists: data.exists ?? false,
  }
}

async function putFile(slug: 'hermes-persona' | 'hermes-user-facts', content: string): Promise<void> {
  const r = await fetch(`/api/lokyy/${slug}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${r.status}`)
  }
}

export const fetchPersona = () => getFile('hermes-persona')
export const savePersona = (content: string) => putFile('hermes-persona', content)

export const fetchUserFacts = () => getFile('hermes-user-facts')
export const saveUserFacts = (content: string) => putFile('hermes-user-facts', content)
