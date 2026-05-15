export type IntegrationProvider = {
  id: string
  name: string
  description: string
  category: 'calendar' | 'email' | 'crm' | 'docs' | 'comms' | 'dev'
  homepage: string
  status: 'connected' | 'disconnected'
  connectedAt?: string
}

const BASE = '/api/lokyy/integrations'

export async function listIntegrations(): Promise<IntegrationProvider[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()).integrations as IntegrationProvider[]
}

export async function connectIntegration(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/connect`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
}

export async function disconnectIntegration(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/disconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
}
