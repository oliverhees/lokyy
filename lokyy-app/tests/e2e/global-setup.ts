import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'auth.db')
const overridesPath = path.join(dataDir, 'agent-overrides.json')
const promptsPath = path.join(dataDir, 'prompts.json')
const workflowsPath = path.join(dataDir, 'workflows.json')
const teamsPath = path.join(dataDir, 'teams.json')
const integrationsPath = path.join(dataDir, 'integrations.json')
const settingsPath = path.join(dataDir, 'settings.json')
const conversationsPath = path.join(dataDir, 'conversations.json')

export default async function globalSetup() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (fs.existsSync(overridesPath)) fs.unlinkSync(overridesPath)
  if (fs.existsSync(promptsPath)) fs.unlinkSync(promptsPath)
  if (fs.existsSync(workflowsPath)) fs.unlinkSync(workflowsPath)
  if (fs.existsSync(teamsPath)) fs.unlinkSync(teamsPath)
  if (fs.existsSync(integrationsPath)) fs.unlinkSync(integrationsPath)
  if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath)
  if (fs.existsSync(conversationsPath)) fs.unlinkSync(conversationsPath)

  // If DB doesn't exist or has no tables, run the Better Auth migrate.
  let needsMigrate = !fs.existsSync(dbPath)
  if (!needsMigrate) {
    try {
      const probe = new Database(dbPath, { readonly: true })
      const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      probe.close()
      needsMigrate = !tables.some((t) => t.name === 'user')
    } catch {
      needsMigrate = true
    }
  }

  if (needsMigrate) {
    execSync('npx --yes @better-auth/cli migrate -y', {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
  }

  // Clear all rows from all tables — preserves the file handle the running
  // dev server holds open. Deleting the file leaves the dev server pointing
  // at a stale inode.
  const db = new Database(dbPath)
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>
    db.exec('PRAGMA foreign_keys = OFF;')
    for (const t of tables) {
      db.prepare(`DELETE FROM "${t.name}"`).run()
    }
    db.exec('PRAGMA foreign_keys = ON;')
  } finally {
    db.close()
  }
}
