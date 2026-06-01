import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { listPendingDeliveries, patchReminder, type Reminder } from '@/lib/lokyy-reminders'

const POLL_INTERVAL_MS = 15_000
const SEEN_KEY = 'lokyy:reminders:seen'
const SEEN_CAP = 200

function fireOsNotification(rem: Reminder): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification('Lokyy Reminder', {
      body: rem.text,
      tag: `reminder-${rem.id}`,
      requireInteraction: true,
      icon: '/favicon.svg',
    })
    n.onclick = () => {
      window.focus()
      window.location.assign('/reminders')
      n.close()
    }
  } catch {
    /* notification API can throw on some platforms — ignore */
  }
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function persistSeen(seen: Set<string>): void {
  const arr = [...seen].slice(-SEEN_CAP)
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
  } catch {
    /* quota / private mode — silently drop */
  }
}

export function RemindersPoller(): null {
  const seenRef = useRef<Set<string>>(loadSeen())

  useEffect(() => {
    let cancelled = false

    async function tick(): Promise<void> {
      let pending: Awaited<ReturnType<typeof listPendingDeliveries>>
      try {
        pending = await listPendingDeliveries()
      } catch {
        return
      }
      if (cancelled) return
      const seen = seenRef.current
      let changed = false
      for (const rem of pending) {
        if (seen.has(rem.id)) continue
        seen.add(rem.id)
        changed = true
        fireOsNotification(rem)
        const toastId = `reminder-${rem.id}`
        toast(rem.text, {
          id: toastId,
          duration: Infinity,
          action: {
            label: 'Quittieren',
            onClick: () => {
              void (async () => {
                try {
                  await patchReminder(rem.id, { status: 'dismissed' })
                } catch {
                  toast.error('Quittieren fehlgeschlagen')
                  return
                }
                toast.dismiss(toastId)
              })()
            },
          },
        })
      }
      if (changed) persistSeen(seen)
    }

    void tick()
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return null
}
