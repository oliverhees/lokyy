import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { TerminalIcon, RefreshCwIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchLogs } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/logs')({ component: LogsPage })

function LogsPage() {
  const [logs, setLogs] = useState('')
  const [lines, setLines] = useState(200)
  const [level, setLevel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetchLogs({ lines, level: level || undefined })
      setLogs(r.raw || r.error || '(leer)')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Logs</h1>
          <p className="text-sm text-muted-foreground">agent.log + gateway.log + errors.log</p>
        </div>
        <Button onClick={refresh} disabled={busy} data-testid="logs-refresh">
          <RefreshCwIcon className="size-4" /> {busy ? 'Lade…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="lines" className="text-xs">Lines</Label>
              <Input id="lines" type="number" min="10" max="2000" value={lines} onChange={(e) => setLines(Number(e.target.value))} className="w-24" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="level" className="text-xs">Level (optional)</Label>
              <Input id="level" placeholder="ERROR / WARN / INFO" value={level} onChange={(e) => setLevel(e.target.value)} className="w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <pre
            className="max-h-[calc(100vh-22rem)] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs"
            data-testid="logs-output"
          >
            {logs || '(leer)'}
          </pre>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        <TerminalIcon className="inline size-3" /> CLI-Power-Mode:{' '}
        <code className="rounded bg-muted px-1">hermes logs -f --level ERROR</code>
      </p>
    </div>
  )
}
