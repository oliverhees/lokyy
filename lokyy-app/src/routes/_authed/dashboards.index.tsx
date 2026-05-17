import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { LayoutDashboardIcon, PlusIcon, ClockIcon, CalendarIcon, MailIcon, ZapIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listDashboards, createDashboardFromIntent, type DashboardListItem } from '@/lib/lokyy-dashboards'

export const Route = createFileRoute('/_authed/dashboards/')({
  component: DashboardsListPage,
})

function DashboardsListPage() {
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [intent, setIntent] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  function reload() {
    listDashboards()
      .then(setDashboards)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  useEffect(reload, [])

  async function submit() {
    if (intent.trim().length < 3 || creating) return
    setCreating(true)
    try {
      const result = await createDashboardFromIntent(intent.trim())
      setDialogOpen(false)
      setIntent('')
      navigate({ to: '/dashboards/$id', params: { id: result.dashboardId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="dashboards-page">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboards</h1>
          <p className="text-sm text-muted-foreground">
            Selbstgebaute Dashboards — agentengetrieben, mit Historie. Chatte deinen Wunsch und Lokyy bastelt die View + den Producer-Skill.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="dashboards-create">
              <PlusIcon className="size-4" />
              Neues Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Dashboard erstellen</DialogTitle>
              <DialogDescription>
                Beschreibe in einem Satz was du sehen willst. Lokyy wählt die passende Vorlage und legt einen Producer an.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="intent">Intent</Label>
              <Input
                id="intent"
                data-testid="dashboards-intent-input"
                placeholder="z.B. KI-News täglich um 8 Uhr"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Vorlagen heute: KI-News, Email-Digest. Weitere kommen mit dem LLM-Generator.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button
                onClick={submit}
                disabled={intent.trim().length < 3 || creating}
                data-testid="dashboards-create-submit"
              >
                {creating ? 'Wird erstellt…' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="border border-destructive/50 text-destructive rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {dashboards === null && !error ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : dashboards && dashboards.length === 0 ? (
        <Card data-testid="dashboards-empty">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutDashboardIcon className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Noch kein Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Klick auf <em>Neues Dashboard</em> und beschreibe deinen Wunsch — Lokyy generiert die View und legt den Producer-Skill an.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="dashboards-grid">
          {dashboards?.map((d) => (
            <Link key={d.id} to="/dashboards/$id" params={{ id: d.id }}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`dashboard-card-${d.id}`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {d.template === 'email-digest' ? <MailIcon className="size-5 text-emerald-500" /> : <ZapIcon className="size-5 text-primary" />}
                      <h3 className="font-semibold leading-tight">{d.title}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">{d.template}</Badge>
                  </div>
                  {d.originalIntent && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      «{d.originalIntent}»
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {d.schedule}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="size-3" />
                    {d.runCount === 0 ? 'noch keine Runs' : `${d.runCount} Run${d.runCount > 1 ? 's' : ''}`}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
