import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, ClockIcon, CalendarIcon, PlayIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDashboard, getDashboardData, dashboardViewUrl, runDashboardNow, updateDashboard, deleteDashboard, type DashboardDetail, type DashboardData } from '@/lib/lokyy-dashboards'

export const Route = createFileRoute('/_authed/dashboards/$id')({
  loader: async ({ params }) => {
    try {
      const dashboard = await getDashboard(params.id)
      return { dashboard }
    } catch {
      throw redirect({ to: '/dashboards' })
    }
  },
  component: DashboardDetailPage,
})

function DashboardDetailPage() {
  const { dashboard: initialDashboard } = Route.useLoaderData() as { dashboard: DashboardDetail }
  const [dashboard, setDashboard] = useState<DashboardDetail>(initialDashboard)
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDashboard.runs[0] ?? null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(initialDashboard.title)
  const [editSchedule, setEditSchedule] = useState(initialDashboard.schedule)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navigate = useNavigate()

  async function handleSaveEdit() {
    setSaving(true)
    setEditError(null)
    try {
      const updated = await updateDashboard(dashboard.id, {
        title: editTitle.trim() !== dashboard.title ? editTitle.trim() : undefined,
        schedule: editSchedule.trim() !== dashboard.schedule ? editSchedule.trim() : undefined,
      })
      setDashboard({ ...dashboard, ...updated, runs: dashboard.runs })
      setEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteDashboard(dashboard.id)
      navigate({ to: '/dashboards' })
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    setRunError(null)
    try {
      const result = await runDashboardNow(dashboard.id)
      // Refetch dashboard metadata (runs[] now includes today) + the new data
      const fresh = await getDashboard(dashboard.id)
      setDashboard(fresh)
      setSelectedDate(result.runDate)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  // Load data for the currently-selected date
  useEffect(() => {
    getDashboardData(dashboard.id, selectedDate ?? undefined)
      .then(setData)
      .catch(() => setData({ payload: null, runAt: null, date: selectedDate }))
  }, [dashboard.id, selectedDate])

  // Push data into the iframe whenever it (re)loads or the data changes
  useEffect(() => {
    if (!data || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage(
      { type: 'lokyy:dashboard:data', payload: data.payload },
      '*', // iframe is sandboxed without allow-same-origin → opaque origin
    )
  }, [data])

  // Iframe asks for data once it's ready (handshake covers cases where
  // the iframe loads after our state is already set).
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const win = iframeRef.current?.contentWindow
      if (!win || ev.source !== win) return
      if (ev.data?.type === 'lokyy:dashboard:ready' && data) {
        win.postMessage(
          { type: 'lokyy:dashboard:data', payload: data.payload },
          '*', // iframe is sandboxed without allow-same-origin → opaque origin
        )
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [data])

  return (
    <div className="space-y-4" data-testid="dashboard-detail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboards">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{dashboard.title}</h1>
            {dashboard.originalIntent && (
              <p className="text-xs text-muted-foreground">«{dashboard.originalIntent}»</p>
            )}
          </div>
          <Badge variant="outline">{dashboard.template}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {dashboard.runs.length > 0 && (
            <NativeSelect
              data-testid="dashboard-history-select"
              value={selectedDate ?? ''}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {dashboard.runs.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </NativeSelect>
          )}
          <Button
            variant="outline"
            onClick={handleRunNow}
            disabled={running}
            data-testid="dashboard-run-now"
          >
            <PlayIcon className="size-3" />
            {running ? 'Läuft…' : 'Jetzt laufen'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setEditTitle(dashboard.title)
              setEditSchedule(dashboard.schedule)
              setEditError(null)
              setEditOpen(true)
            }}
            title="Bearbeiten"
            data-testid="dashboard-edit"
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            title="Löschen"
            data-testid="dashboard-delete"
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden" data-testid="dashboard-iframe-card">
          <iframe
            ref={iframeRef}
            src={dashboardViewUrl(dashboard.id)}
            // ISC-95: sandbox the iframe — scripts execute, links can open
            // in new tabs (popups), but the iframe cannot navigate our top
            // window, has no same-origin (so it cannot fetch our APIs),
            // and popups escape the sandbox so external sites aren't crippled.
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            title={dashboard.title}
            data-testid="dashboard-iframe"
            className="w-full block bg-background"
            style={{ height: '70vh', border: 0 }}
          />
        </Card>

        <Card data-testid="dashboard-meta-panel">
          <CardHeader>
            <CardTitle className="text-sm">Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Schedule (Hermes-Cron)</div>
              <div className="font-mono text-xs inline-flex items-center gap-1">
                <ClockIcon className="size-3" /> {dashboard.schedule}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Erstellt</div>
              <div className="text-xs">{new Date(dashboard.createdAt).toLocaleString('de-DE')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Producer-Capability</div>
              <div className="font-mono text-xs truncate">{dashboard.capabilityTokenId}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Letzter Run</div>
              <div className="text-xs">{data?.runAt ? new Date(data.runAt).toLocaleString('de-DE') : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Run-Historie</div>
              <div className="text-xs">{dashboard.runs.length} Einträge</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard bearbeiten</DialogTitle>
            <DialogDescription>Titel + Schedule anpassen. Andere Felder (Template, Producer, View) sind durch die LLM-Wizard-Phase abgedeckt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-title">Titel</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="dashboard-edit-title" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-schedule">Schedule (cron)</Label>
              <Input id="edit-schedule" value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} placeholder="0 8 * * *" className="font-mono" data-testid="dashboard-edit-schedule" />
              <p className="text-xs text-muted-foreground">5-Field cron: minute hour day month weekday. Z.B. <code className="font-mono">0 8 * * *</code> = täglich 8:00.</p>
            </div>
            {editError && <div className="text-xs text-destructive">{editError}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Abbrechen</Button>
            <Button onClick={handleSaveEdit} disabled={saving} data-testid="dashboard-edit-save">
              {saving ? 'Speichert…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard löschen?</DialogTitle>
            <DialogDescription>
              «{dashboard.title}» und alle {dashboard.runs.length} Run{dashboard.runs.length === 1 ? '' : 's'} werden unwiderruflich gelöscht. Die Producer-Capability wird ebenfalls revoked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} data-testid="dashboard-delete-confirm">
              {deleting ? 'Löscht…' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
