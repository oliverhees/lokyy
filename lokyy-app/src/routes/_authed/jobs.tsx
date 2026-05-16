import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const Route = createFileRoute('/_authed/jobs')({
  component: JobsPage,
})

type Job = {
  id: string
  name: string
  schedule: string
  command: string
  status: 'active' | 'paused' | 'unknown'
  lastRun?: string
  nextRun?: string
}

const SCHEDULE_PRESETS = [
  { label: 'Every 30 min', value: '30m' },
  { label: 'Every hour', value: '1h' },
  { label: 'Every 2 hours', value: '2h' },
  { label: 'Daily at 9:00', value: '0 9 * * *' },
  { label: 'Weekly Mo 9:00', value: '0 9 * * 1' },
]

function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    try {
      const r = await fetch('/api/lokyy/jobs')
      const d = (await r.json()) as { jobs?: Job[]; error?: string }
      if (d.error) setError(d.error)
      else setJobs(d.jobs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onCreate(input: { schedule: string; prompt: string; name?: string }) {
    setError(null)
    const r = await fetch('/api/lokyy/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const d = (await r.json()) as { ok?: boolean; output?: string; error?: string }
    if (!d.ok || d.error) {
      setError(d.output ?? d.error ?? 'Create failed')
      return
    }
    setDialogOpen(false)
    await refresh()
  }

  async function onDelete(id: string) {
    if (!confirm(`Job '${id}' löschen?`)) return
    setError(null)
    const r = await fetch(`/api/lokyy/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const d = (await r.json()) as { ok?: boolean; output?: string }
    if (!d.ok) setError(d.output ?? 'Delete failed')
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Schedule Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Wiederkehrende Hermes-Aufgaben. Schedule via Cron-Expression oder
            <code className="mx-1 rounded bg-muted px-1">30m</code>/<code className="mx-1 rounded bg-muted px-1">2h</code> Style.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="jobs-add">
          <PlusIcon className="size-4" /> Neuer Job
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap text-xs text-destructive" role="alert">{error}</pre>
          </CardContent>
        </Card>
      ) : null}

      {jobs === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade Jobs…</p>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="jobs-empty">Noch keine Schedule-Jobs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klick „Neuer Job" oder leg via CLI an:{' '}
              <code className="rounded bg-muted px-1">hermes cron create</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{jobs.length} Job{jobs.length === 1 ? '' : 's'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" data-testid="jobs-list">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-4 px-6 py-3" data-testid={`job-row-${j.id}`}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <CalendarIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{j.name}</span>
                      <Badge variant={j.status === 'active' ? 'default' : 'secondary'} className="text-xs">{j.status}</Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      <code>{j.schedule}</code> · {j.command}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(j.id)} data-testid={`job-delete-${j.id}`}>
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CreateJobDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={onCreate} />
    </div>
  )
}

function CreateJobDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (input: { schedule: string; prompt: string; name?: string }) => void
}) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setSchedule('')
      setPrompt('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Schedule-Job</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onCreate({ schedule, prompt, name: name || undefined })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="job-name">Name (optional)</Label>
            <Input id="job-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="job-form-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-schedule">Schedule</Label>
            <Input
              id="job-schedule"
              required
              placeholder="z.B. 1h, 30m, oder 0 9 * * *"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              data-testid="job-form-schedule"
            />
            <div className="flex flex-wrap gap-1">
              {SCHEDULE_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSchedule(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-prompt">Prompt / Task-Instruction</Label>
            <Textarea
              id="job-prompt"
              required
              rows={4}
              placeholder="z.B. 'Fasse die letzten 24h E-Mails zusammen.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              data-testid="job-form-prompt"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" data-testid="job-form-save">Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
