import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeftIcon, ClockIcon, KeyIcon, CalendarIcon, PlayIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { getDashboard, getDashboardData, dashboardViewUrl, type DashboardDetail, type DashboardData } from '@/lib/lokyy-dashboards'

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
  const { dashboard } = Route.useLoaderData() as { dashboard: DashboardDetail }
  const [selectedDate, setSelectedDate] = useState<string | null>(dashboard.runs[0] ?? null)
  const [data, setData] = useState<DashboardData | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
      window.location.origin,
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
          window.location.origin,
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
          <Button variant="outline" disabled title="Hermes-Cron-Trigger landet mit nächster Slice">
            <PlayIcon className="size-3" />
            Jetzt laufen
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden" data-testid="dashboard-iframe-card">
          <iframe
            ref={iframeRef}
            src={dashboardViewUrl(dashboard.id)}
            // ISC-95: sandbox the iframe — scripts only, no forms, no top-nav,
            // no same-origin (so the view cannot fetch our APIs).
            sandbox="allow-scripts"
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
