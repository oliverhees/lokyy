import { execSync } from 'node:child_process'

export type HermesJob = {
  id: string
  name: string
  schedule: string
  command: string
  status: 'active' | 'paused' | 'unknown'
  lastRun?: string
  nextRun?: string
}

function runHermesCronList(): string {
  try {
    return execSync('hermes cron list', { encoding: 'utf8', timeout: 5000 })
  } catch (err) {
    if (err instanceof Error && 'stdout' in err && typeof err.stdout === 'string') return err.stdout
    return ''
  }
}

function stripBoxDrawing(s: string): string {
  return s.replace(/[━─┃┏┓┗┛┳┻╋┣┫│]/g, ' ')
}

function parseJobsTable(raw: string): HermesJob[] {
  if (/no scheduled jobs/i.test(raw)) return []
  const cleaned = stripBoxDrawing(raw)
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean)
  const dataLines = lines.filter(
    (l) =>
      !/^\s*$/.test(l) &&
      !/^Scheduled/.test(l) &&
      !/^Id\s+Name\s+Schedule/i.test(l) &&
      !/Create one with/i.test(l),
  )
  const jobs: HermesJob[] = []
  for (const line of dataLines) {
    const cols = line.split(/\s{2,}/).filter(Boolean)
    if (cols.length < 3) continue
    jobs.push({
      id: cols[0],
      name: cols[1] ?? cols[0],
      schedule: cols[2] ?? '',
      command: cols[3] ?? '',
      status: /paus/i.test(line) ? 'paused' : 'active',
      lastRun: cols[4],
      nextRun: cols[5],
    })
  }
  return jobs
}

export function listJobs(): HermesJob[] {
  const raw = runHermesCronList()
  return parseJobsTable(raw)
}
