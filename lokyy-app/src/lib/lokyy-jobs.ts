/**
 * lokyy-jobs.ts — API-Wrapper für /api/lokyy/jobs (lokyy-os-be).
 *
 * Spiegelt das Muster aus lokyy-reminders.ts: typisierte fetch-Calls,
 * Fehler werden geworfen, die Route-Komponente fängt sie ab.
 *
 * Fixer API-Vertrag (Epic Cron AP1, Story B1):
 *   - GET  /api/lokyy/jobs       -> { jobs: Job[] }
 *   - POST /api/lokyy/jobs       -> { ok: true, job } | 400 { error }
 *   - PATCH /api/lokyy/jobs/:id  -> { ok: true, job } | 404 { error }
 *   - DELETE /api/lokyy/jobs/:id -> { ok: true }
 *   - POST /api/lokyy/jobs/:id/run -> { ok, hermesContent?, hermesSkipped?, error?, job }
 *
 * Job-Objekt trägt zusätzlich die camelCase Brain-Felder
 * (brainEnabled / brainType / brainFolderHint), die das Backend über
 * POST/PATCH akzeptiert und über GET liefert.
 */

export type JobStatus = 'active' | 'paused' | 'unknown'

/**
 * Geschlossene Liste der Brain-DOC-Typen (deckungsgleich mit dem
 * lokyy-vault SPEC). brainType darf nur einen dieser Werte tragen.
 */
export const BRAIN_TYPES = [
  'note',
  'capture',
  'project',
  'task',
  'decision',
  'meeting',
  'customer',
  'workflow',
  'intervention',
  'content',
  'skill',
] as const
export type BrainType = (typeof BRAIN_TYPES)[number]

/** Sinnvoller Default für einen Scheduler-Lauf, der Output ablegt. */
export const DEFAULT_BRAIN_TYPE: BrainType = 'capture'

export type Job = {
  id: string
  name: string
  schedule: string
  command: string
  status: JobStatus
  lastRun?: string
  nextRun?: string
  /** 0/1 — schreibt der Lauf seinen Output in Brain? Backend liefert ggf. boolean. */
  brainEnabled: boolean | 0 | 1
  /** Brain-DOC-Typ; null wenn brainEnabled aus ist. */
  brainType: string | null
  /** Optionaler Ordner-Hint im Vault. */
  brainFolderHint: string | null
}

export type JobInput = {
  schedule: string
  prompt: string
  name?: string
  brainEnabled: boolean
  brainType: BrainType | null
  brainFolderHint?: string | null
}

export type JobPatch = Partial<{
  name: string
  schedule: string
  prompt: string
  status: JobStatus
  brainEnabled: boolean
  brainType: BrainType | null
  brainFolderHint: string | null
}>

export type RunResult = {
  ok: boolean
  hermesContent?: string
  hermesSkipped?: boolean
  error?: string
  durationMs?: number
  job?: Job
}

const BASE = '/api/lokyy/jobs'

/** Normalisiert das Backend-Feld (0/1 oder boolean) auf einen echten boolean. */
export function isBrainEnabled(job: Pick<Job, 'brainEnabled'>): boolean {
  return job.brainEnabled === true || job.brainEnabled === 1
}

export async function listJobs(): Promise<Job[]> {
  const r = await fetch(BASE)
  if (!r.ok) throw new Error(`Failed: ${r.status}`)
  const data = (await r.json()) as { jobs?: Job[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.jobs ?? []
}

export async function createJob(input: JobInput): Promise<Job> {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      schedule: input.schedule,
      prompt: input.prompt,
      name: input.name,
      brainEnabled: input.brainEnabled,
      brainType: input.brainEnabled ? input.brainType : null,
      brainFolderHint: input.brainEnabled ? (input.brainFolderHint ?? null) : null,
    }),
  })
  const data = (await r.json()) as { ok?: boolean; job?: Job; error?: string; output?: string }
  if (!r.ok || !data.ok || !data.job) {
    throw new Error(data.error ?? data.output ?? `HTTP ${r.status}`)
  }
  return data.job
}

export async function patchJob(id: string, patch: JobPatch): Promise<Job> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = (await r.json()) as { ok?: boolean; job?: Job; error?: string }
  if (!r.ok || !data.ok || !data.job) {
    throw new Error(data.error ?? `HTTP ${r.status}`)
  }
  return data.job
}

export async function deleteJob(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${r.status}`)
  }
}

export async function runJob(id: string): Promise<RunResult> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/run`, { method: 'POST' })
  const data = (await r.json()) as RunResult & { error?: string }
  if (!r.ok && !data.error) throw new Error(`HTTP ${r.status}`)
  return data
}

// ──────────────────────────────────────────────────────────────────
// Schedule Preset-Builder
//
// Das Backend (lokyy-os-be normalizeSchedule/cronMatches) akzeptiert:
//   • Interval-Shortcuts:  "30m" (Minuten 1–59), "1h", "2h" (Stunden 2–23)
//   • 5-Feld POSIX-Cron:   "0 8 * * *"  (min hour dom mon dow)
// normalizeSchedule mappt die Shortcuts intern auf echtes Cron; wir
// liefern hier exakt diese akzeptierten Formate, kein eigenes Format.
// ──────────────────────────────────────────────────────────────────

export type PresetFrequency = 'hourly' | 'daily' | 'weekly'

export type SchedulePreset = {
  frequency: PresetFrequency
  /** "HH:mm" — relevant für daily/weekly. */
  time: string
  /** 0=So … 6=Sa — relevant für weekly. */
  weekday: number
}

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
]

/**
 * Mappt ein Preset auf einen vom Backend akzeptierten schedule-String.
 *   hourly  -> "1h"             (normalizeSchedule -> "0 * * * *")
 *   daily   -> "M H * * *"      (5-Feld-Cron, passiert isPlausibleCron)
 *   weekly  -> "M H * * DOW"    (5-Feld-Cron mit Wochentag)
 */
export function presetToSchedule(preset: SchedulePreset): string {
  if (preset.frequency === 'hourly') return '1h'

  const [hh, mm] = preset.time.split(':')
  const hour = Number.parseInt(hh ?? '0', 10)
  const minute = Number.parseInt(mm ?? '0', 10)
  const h = Number.isFinite(hour) ? hour : 0
  const m = Number.isFinite(minute) ? minute : 0

  if (preset.frequency === 'weekly') {
    return `${m} ${h} * * ${preset.weekday}`
  }
  // daily
  return `${m} ${h} * * *`
}

/** Best-effort Rück-Parse eines schedule-Strings in ein Preset (für Edit). */
export function scheduleToPreset(schedule: string): SchedulePreset | null {
  const s = schedule.trim()
  // Shortcut "1h" oder normalisiertes hourly "0 * * * *"
  if (/^1\s*h(our?s?)?$/i.test(s) || s === '0 * * * *') {
    return { frequency: 'hourly', time: '09:00', weekday: 1 }
  }
  const fields = s.split(/\s+/)
  if (fields.length !== 5) return null
  const [min, hour, dom, mon, dow] = fields
  // Nur einfache Literale (kein Step/Range/List) lassen sich sauber zurückmappen.
  if (dom !== '*' || mon !== '*') return null
  const m = Number.parseInt(min ?? '', 10)
  const h = Number.parseInt(hour ?? '', 10)
  if (!Number.isInteger(m) || !Number.isInteger(h)) return null
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  if (dow === '*') return { frequency: 'daily', time, weekday: 1 }
  const wd = Number.parseInt(dow ?? '', 10)
  if (Number.isInteger(wd) && wd >= 0 && wd <= 6) {
    return { frequency: 'weekly', time, weekday: wd }
  }
  return null
}

export function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'gerade eben'
  if (s < 3600) return `vor ${Math.floor(s / 60)} min`
  if (s < 86_400) return `vor ${Math.floor(s / 3600)} h`
  return `vor ${Math.floor(s / 86_400)} d`
}
