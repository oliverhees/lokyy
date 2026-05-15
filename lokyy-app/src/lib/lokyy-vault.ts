export type VaultEntry = {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  modified?: string
}

export type VaultListResponse = {
  configured: boolean
  root: string | null
  entries: VaultEntry[]
  path: string
}

export type VaultReadResponse = {
  configured: boolean
  root: string | null
  content: string
  path: string
}

export async function listVault(relPath = ''): Promise<VaultListResponse> {
  const res = await fetch(`/api/lokyy/vault?path=${encodeURIComponent(relPath)}`)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()) as VaultListResponse
}

export async function readVault(relPath: string): Promise<VaultReadResponse> {
  const res = await fetch(`/api/lokyy/vault?action=read&path=${encodeURIComponent(relPath)}`)
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()) as VaultReadResponse
}
