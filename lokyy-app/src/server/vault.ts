import fs from 'node:fs'
import path from 'node:path'

const VAULT_ROOT = process.env.LOKYY_VAULT_PATH

export type VaultEntry = {
  name: string
  path: string // relative to vault root
  type: 'file' | 'dir'
  size?: number
  modified?: string
}

function ensureSafe(relPath: string): string {
  if (!VAULT_ROOT) throw new Error('LOKYY_VAULT_PATH not set')
  const abs = path.resolve(VAULT_ROOT, relPath || '')
  if (!abs.startsWith(path.resolve(VAULT_ROOT))) {
    throw new Error('path traversal blocked')
  }
  return abs
}

export function vaultConfigured(): boolean {
  return !!VAULT_ROOT && fs.existsSync(VAULT_ROOT)
}

export function vaultRoot(): string | null {
  return VAULT_ROOT ?? null
}

export function listVaultDir(relPath = ''): VaultEntry[] {
  if (!vaultConfigured()) return []
  const abs = ensureSafe(relPath)
  if (!fs.existsSync(abs)) return []
  const entries: VaultEntry[] = []
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue // skip hidden + .obsidian
    const childRel = path.join(relPath, e.name)
    const childAbs = path.join(abs, e.name)
    if (e.isDirectory()) {
      entries.push({ name: e.name, path: childRel, type: 'dir' })
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      const stat = fs.statSync(childAbs)
      entries.push({
        name: e.name,
        path: childRel,
        type: 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      })
    }
  }
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function readVaultFile(relPath: string): string {
  const abs = ensureSafe(relPath)
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error('file not found')
  }
  return fs.readFileSync(abs, 'utf8')
}
