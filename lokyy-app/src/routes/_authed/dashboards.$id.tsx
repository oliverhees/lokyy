import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeftIcon, ClockIcon, KeyIcon, CalendarIcon, PlayIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { getDashboard, getDashboardData, dashboardViewUrl, runDashboardNow, type DashboardDetail, type DashboardData } from '@/lib/lokyy-dashboards'

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
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
    </div>
  )
}
