export type ReminderChannel = 'in-app' | 'telegram' | 'email' | 'calendar'
export type ReminderStatus = 'pending' | 'fired' | 'dismissed' | 'failed'
export type ReminderOrigin = 'user' | 'agent'

export type Reminder = {
  id: string
  text: string
  scheduledAt: string
  channel: ReminderChannel
  status: ReminderStatus
  createdAt: string
  firedAt?: string
  deliveryError?: string
  origin: ReminderOrigin
}

const BASE = '/api/lokyy/reminders'

export async function listReminders(): Promise<Reminder[]> {
  const r = await fetch(BASE)
  if (!r.ok) throw new Error(`Failed: ${r.status}`)
  return (await r.json()).reminders as Reminder[]
}

export async function createReminder(input: {
  text: string
  scheduledAt: string
  channel: ReminderChannel
}): Promise<Reminder> {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await r.json()) as { reminder?: Reminder; error?: string }
  if (!r.ok || !data.reminder) throw new Error(data.error ?? `HTTP ${r.status}`)
  return data.reminder
}

export async function patchReminder(
  id: string,
  patch: Partial<Pick<Reminder, 'text' | 'scheduledAt' | 'channel' | 'status'>>,
): Promise<Reminder> {
  const r = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = (await r.json()) as { reminder?: Reminder; error?: string }
  if (!r.ok || !data.reminder) throw new Error(data.error ?? `HTTP ${r.status}`)
  return data.reminder
}

export async function deleteReminder(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function listPendingDeliveries(): Promise<Reminder[]> {
  const r = await fetch(`${BASE}/pending-deliveries`)
  if (!r.ok) return []
  return (await r.json()).reminders as Reminder[]
}

export function formatRelativeFuture(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return iso
  if (ms < 0) return `vor ${formatDuration(-ms)}`
  if (ms < 60_000) return 'jetzt'
  return `in ${formatDuration(ms)}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86_400) return `${Math.floor(s / 3600)} h`
  return `${Math.floor(s / 86_400)} d`
}
