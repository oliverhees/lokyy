import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export default async function globalSetup() {
  const dataDir = path.resolve(process.cwd(), 'data')
  if (fs.existsSync(dataDir)) {
    for (const f of fs.readdirSync(dataDir)) {
      if (f.startsWith('auth.db')) fs.unlinkSync(path.join(dataDir, f))
    }
  } else {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  execSync('npx --yes @better-auth/cli migrate -y', {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
}
