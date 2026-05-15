import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarIcon, PlusIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/lokyy/jobs')
      .then((r) => r.json())
      .then((d: { jobs: Job[]; error?: string }) => {
        if (d.error) setError(d.error)
        else setJobs(d.jobs)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Schedule Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Hermes-Cron-Jobs für regelmäßige Ausführung.
          </p>
        </div>
        <Button
          data-testid="jobs-add"
          title="Add-Wizard kommt in Phase 2.3"
          className="cursor-not-allowed"
          onClick={(e) => e.preventDefault()}
        >
          <PlusIcon className="size-4" />
          Neuer Job
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : jobs === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade Jobs…</p>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="jobs-empty">
              Noch keine Schedule-Jobs angelegt
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leg einen via CLI an:{' '}
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
                <li
                  key={j.id}
                  className="flex items-center gap-4 px-6 py-3"
                  data-testid={`job-row-${j.id}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <CalendarIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{j.name}</span>
                      <Badge variant={j.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {j.status}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      <code>{j.schedule}</code> · {j.command}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    {j.nextRun ? <p>next: {j.nextRun}</p> : null}
                    {j.lastRun ? <p>last: {j.lastRun}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
