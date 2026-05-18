import { useEffect, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, PlayIcon, TrashIcon, ZapIcon, ClockIcon, CheckCircleIcon, XCircleIcon, SkipForwardIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getWorkflow, runWorkflowNow, listWorkflowRuns, getWorkflowRun, deleteWorkflow, updateWorkflow, type WorkflowSpec, type WorkflowRunRecord } from '@/lib/lokyy-workflows'
import { WorkflowEditor } from '@/components/lokyy/workflow-editor'

export const Route = createFileRoute('/_authed/workflows/$id')({
  loader: async ({ params }) => {
    try {
      const spec = await getWorkflow(params.id)
      return { spec }
    } catch {
      throw redirect({ to: '/workflows' })
    }
  },
  component: WorkflowDetailPage,
})

function WorkflowDetailPage() {
  const { spec: initialSpec } = Route.useLoaderData() as { spec: WorkflowSpec }
  const [spec, setSpec] = useState<WorkflowSpec>(initialSpec)
  const [runs, setRuns] = useState<string[]>([])
  const [activeRun, setActiveRun] = useState<WorkflowRunRecord | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function reloadRuns() {
    listWorkflowRuns(spec.id).then(setRuns).catch(() => {})
  }
  useEffect(reloadRuns, [spec.id])

  // When the user picks a run from history, load its full record
  useEffect(() => {
    if (!activeRunId) {
      setActiveRun(null)
      return
    }
    getWorkflowRun(spec.id, activeRunId).then(setActiveRun).catch(() => setActiveRun(null))
  }, [activeRunId, spec.id])

  async function handleRunNow() {
    setRunning(true)
    setError(null)
    try {
      const record = await runWorkflowNow(spec.id)
      setActiveRun(record)
      setActiveRunId(record.runId)
      reloadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteWorkflow(spec.id)
      navigate({ to: '/workflows' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="workflow-detail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/workflows">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{spec.title}</h1>
            <p className="text-xs text-muted-foreground font-mono">{spec.id}</p>
          </div>
          <div className="flex gap-1">
            {spec.triggers.map((t, i) => (
              <Badge key={i} variant="outline">{t.type}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRunNow} disabled={running} data-testid="workflow-run-now">
            <PlayIcon className="size-3" />
            {running ? 'Läuft…' : 'Jetzt laufen'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
            data-testid="workflow-delete"
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/50 text-destructive rounded-md px-3 py-2 text-sm">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div data-testid="workflow-nodes-card">
            <WorkflowEditor
              spec={spec}
              onSave={async (next) => {
                const updated = await updateWorkflow(spec.id, next)
                setSpec(updated.spec)
              }}
            />
          </div>

          {activeRun && (
            <Card data-testid="workflow-active-run">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm">Run {activeRun.runId.slice(0, 19)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activeRun.startedAt).toLocaleString('de-DE')} · {activeRun.durationMs}ms
                  </p>
                </div>
                <Badge variant={activeRun.status === 'ok' ? 'default' : activeRun.status === 'halted' ? 'destructive' : 'secondary'}>
                  {activeRun.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {activeRun.nodes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border p-2">
                    <div className="pt-0.5">
                      {n.status === 'ok' ? <CheckCircleIcon className="size-4 text-emerald-500" />
                        : n.status === 'skipped' ? <SkipForwardIcon className="size-4 text-muted-foreground" />
                        : <XCircleIcon className="size-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{n.nodeId}</span>
                        <span className="text-xs text-muted-foreground">{n.durationMs}ms</span>
                      </div>
                      {n.error && (
                        <p className="text-xs text-destructive line-clamp-2">{n.error}</p>
                      )}
                      {n.output !== undefined && n.output !== null && (
                        <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto max-h-32 whitespace-pre-wrap">{
                          (() => {
                            try { return JSON.stringify(n.output, null, 2).slice(0, 600) }
                            catch { return String(n.output).slice(0, 200) }
                          })()
                        }</pre>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card data-testid="workflow-meta-panel">
          <CardHeader>
            <CardTitle className="text-sm">Run-Historie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Noch keine Runs.</p>
            ) : (
              runs.slice(0, 30).map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRunId(r)}
                  className={`block w-full text-left rounded px-2 py-1 text-[10px] font-mono hover:bg-muted ${activeRunId === r ? 'bg-muted' : ''}`}
                  data-testid={`workflow-run-link-${r}`}
                >
                  {r}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow löschen?</DialogTitle>
            <DialogDescription>
              «{spec.title}» und alle {runs.length} Run{runs.length === 1 ? '' : 's'} werden unwiderruflich gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete} data-testid="workflow-delete-confirm">
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
