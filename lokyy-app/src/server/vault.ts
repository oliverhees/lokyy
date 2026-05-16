import fs from 'node:fs'
import path from 'node:path'
import { readSettings } from './settings-store'

export type VaultEntry = {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  modified?: string
}

function resolveVaultRoot(): string | null {
  const fromSettings = readSettings().vaultPath
  if (fromSettings && fromSettings.trim()) return fromSettings.trim()
  const fromEnv = process.env.LOKYY_VAULT_PATH
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : null
}

function ensureSafe(root: string, relPath: string): string {
  const abs = path.resolve(root, relPath || '')
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error('path traversal blocked')
  }
  return abs
}

export function vaultConfigured(): boolean {
  const root = resolveVaultRoot()
  return !!root && fs.existsSync(root)
}

export function vaultRoot(): string | null {
  return resolveVaultRoot()
}

export function listVaultDir(relPath = ''): VaultEntry[] {
  const root = resolveVaultRoot()
  if (!root || !fs.existsSync(root)) return []
  const abs = ensureSafe(root, relPath)
  if (!fs.existsSync(abs)) return []
  const entries: VaultEntry[] = []
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
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
  const root = resolveVaultRoot()
  if (!root) throw new Error('Vault not configured')
  const abs = ensureSafe(root, relPath)
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error('file not found')
  }
  return fs.readFileSync(abs, 'utf8')
}
