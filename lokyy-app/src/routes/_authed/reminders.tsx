import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BellIcon, PlusIcon, Trash2Icon, BotIcon, UserIcon, AlertCircleIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NotificationsPermissionCard } from '@/components/notifications-permission-card'
import {
  listReminders,
  createReminder,
  deleteReminder,
  patchReminder,
  formatRelativeFuture,
  type Reminder,
  type ReminderChannel,
} from '@/lib/lokyy-reminders'

export const Route = createFileRoute('/_authed/reminders')({ component: RemindersPage })

const CHANNELS: { id: ReminderChannel; label: string; note?: string }[] = [
  { id: 'in-app', label: 'In-app (Toast wenn Browser offen)' },
  { id: 'telegram', label: 'Telegram', note: 'Delivery noch nicht wired (siehe roadmap)' },
  { id: 'email', label: 'Email', note: 'Delivery noch nicht wired (siehe roadmap)' },
  { id: 'calendar', label: 'Kalender (ICS)', note: 'Delivery noch nicht wired (siehe roadmap)' },
]

function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    try {
      setReminders(await listReminders())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  async function onCreate(input: { text: string; scheduledAt: string; channel: ReminderChannel }) {
    try {
      await createReminder(input)
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Reminder löschen?')) return
    await deleteReminder(id)
    await refresh()
  }

  async function onDismiss(id: string) {
    try {
      await patchReminder(id, { status: 'dismissed' })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const pending = (reminders ?? []).filter((r) => r.status === 'pending')
  const fired = (reminders ?? []).filter((r) => r.status === 'fired')
  const dismissed = (reminders ?? []).filter((r) => r.status === 'dismissed')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Reminders</h1>
          <p className="text-sm text-muted-foreground">
            One-shot Erinnerungen. Vom Agent erstellbar (per Chat) oder hier manuell.
            Channels Telegram/Email/Calendar: <strong>Delivery noch nicht wired</strong> —
            siehe Roadmap. <code className="rounded bg-muted px-1">in-app</code> ist heute der einzige aktive Channel.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="reminders-add">
          <PlusIcon className="size-4" /> Neue Erinnerung
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap text-xs text-destructive" role="alert">{error}</pre>
          </CardContent>
        </Card>
      ) : null}

      <NotificationsPermissionCard />

      <ReminderListCard
        title="Anstehend"
        empty="Keine offenen Reminders. Frag den Agent oder leg manuell einen an."
        items={pending}
        showRelative
        onDelete={onDelete}
        testid="reminders-pending"
      />

      {fired.length > 0 ? (
        <ReminderListCard
          title="Gefeuert (nicht quittiert)"
          empty=""
          items={fired}
          showRelative={false}
          onDelete={onDelete}
          onDismiss={onDismiss}
          testid="reminders-fired"
        />
      ) : null}

      {dismissed.length > 0 ? (
        <ReminderListCard
          title="Erledigt"
          empty=""
          items={dismissed}
          showRelative={false}
          onDelete={onDelete}
          testid="reminders-dismissed"
        />
      ) : null}

      <CreateReminderDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={onCreate} />
    </div>
  )
}

function ReminderListCard({
  title,
  empty,
  items,
  showRelative,
  onDelete,
  onDismiss,
  testid,
}: {
  title: string
  empty: string
  items: Reminder[]
  showRelative: boolean
  onDelete: (id: string) => void
  onDismiss?: (id: string) => void
  testid: string
}) {
  if (items.length === 0 && empty.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground" data-testid={`${testid}-empty`}>{empty}</p>
        ) : (
          <ul className="divide-y divide-border/60" data-testid={testid}>
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-6 py-3" data-testid={`reminder-row-${r.id}`}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  <BellIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.text}</span>
                    <Badge variant="secondary" className="text-xs">{r.channel}</Badge>
                    {r.origin === 'agent' ? (
                      <Badge variant="outline" className="text-xs" title="Vom Agent angelegt"><BotIcon className="mr-1 size-3" />agent</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs" title="Manuell angelegt"><UserIcon className="mr-1 size-3" />user</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {showRelative
                      ? <>fällig: {formatRelativeFuture(r.scheduledAt)} · </>
                      : null}
                    {new Date(r.scheduledAt).toLocaleString('de-DE')}
                  </p>
                  {r.deliveryError ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600" data-testid={`reminder-warn-${r.id}`}>
                      <AlertCircleIcon className="size-3" /> {r.deliveryError}
                    </p>
                  ) : null}
                </div>
                {onDismiss ? (
                  <Button variant="outline" size="sm" onClick={() => onDismiss(r.id)} data-testid={`reminder-dismiss-${r.id}`}>
                    quittieren
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} data-testid={`reminder-delete-${r.id}`}>
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function CreateReminderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (input: { text: string; scheduledAt: string; channel: ReminderChannel }) => void
}) {
  const [text, setText] = useState('')
  const [when, setWhen] = useState('')
  const [channel, setChannel] = useState<ReminderChannel>('in-app')

  useEffect(() => {
    if (open) {
      setText('')
      // default scheduledAt to "in 1 hour" — datetime-local format YYYY-MM-DDTHH:mm
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const local = `${inOneHour.getFullYear()}-${pad(inOneHour.getMonth() + 1)}-${pad(inOneHour.getDate())}T${pad(inOneHour.getHours())}:${pad(inOneHour.getMinutes())}`
      setWhen(local)
      setChannel('in-app')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Erinnerung</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            // datetime-local is in local time without TZ → toISOString converts to UTC
            const iso = new Date(when).toISOString()
            onCreate({ text, scheduledAt: iso, channel })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="rem-text">Worauf?</Label>
            <Input id="rem-text" required value={text} onChange={(e) => setText(e.target.value)} data-testid="reminder-form-text" placeholder="z.B. Paket zur Post bringen" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rem-when">Wann?</Label>
            <Input
              id="rem-when"
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              data-testid="reminder-form-when"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rem-channel">Channel</Label>
            <select
              id="rem-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as ReminderChannel)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="reminder-form-channel"
            >
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}{c.note ? ` — ${c.note}` : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" data-testid="reminder-form-save">Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
