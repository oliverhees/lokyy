import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const dataDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'auth.db'))
db.pragma('journal_mode = WAL')

export const auth = betterAuth({
  database: db,
  baseURL: process.env.LOKYY_BASE_URL ?? 'http://127.0.0.1:3100',
  secret: process.env.LOKYY_AUTH_SECRET ?? 'dev-secret-replace-in-prod-' + 'a'.repeat(32),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [organization()],
})

export type Session = typeof auth.$Infer.Session

export function ownerExists(): boolean {
  // Open a fresh DB connection so we don't read a stale view —
  // Playwright's globalSetup clears rows in the same file, and the
  // long-lived `db` instance can have an out-of-date prepared-statement cache.
  const probe = new Database(path.join(dataDir, 'auth.db'), { readonly: true, fileMustExist: false })
  try {
    const row = probe.prepare('SELECT COUNT(*) as c FROM user').get() as { c: number } | undefined
    return (row?.c ?? 0) > 0
  } catch {
    return false
  } finally {
    probe.close()
  }
}
