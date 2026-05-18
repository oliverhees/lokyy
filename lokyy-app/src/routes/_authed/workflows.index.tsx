import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ComponentIcon, PlusIcon, ClockIcon, PlayIcon, ZapIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listWorkflows, createWorkflow, type WorkflowListItem } from '@/lib/lokyy-workflows'

export const Route = createFileRoute('/_authed/workflows/')({
  component: WorkflowsListPage,
})

function WorkflowsListPage() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  function reload() {
    listWorkflows()
      .then((list) => {
        const sorted = [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        setWorkflows(sorted)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  useEffect(reload, [])

  async function submit() {
    if (newId.trim().length < 3 || newTitle.trim().length < 1 || creating) return
    setCreating(true)
    setError(null)
    try {
      // Minimal starter spec: manual-trigger only. User wires the rest in the editor.
      const id = newId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      const result = await createWorkflow({
        schemaVersion: 1,
        id,
        title: newTitle.trim(),
        triggers: [{ type: 'manual' }],
        nodes: [
          { id: 'start', type: 'manual-trigger', config: {} },
        ],
        edges: [],
      })
      setDialogOpen(false)
      setNewId('')
      setNewTitle('')
      navigate({ to: '/workflows/$id', params: { id: result.workflowId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="workflows-page">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Verkette Skills, Tools, Agents und Dashboards zu wiederverwendbaren AI-Workflows. Trigger: Cron, Manual, Dashboard-Klick, Webhook.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="workflows-create">
              <PlusIcon className="size-4" />
              Neuer Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuer Workflow</DialogTitle>
              <DialogDescription>
                Klein anfangen — nur ID + Titel. Nodes + Edges baust du im Editor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="wf-id">ID</Label>
                <Input
                  id="wf-id"
                  data-testid="workflows-id-input"
                  placeholder="z.B. ki-news-daily-summary"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">URL-safe (a-z, 0-9, '-'). Wird automatisch lowerc'd.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wf-title">Titel</Label>
                <Input
                  id="wf-title"
                  data-testid="workflows-title-input"
                  placeholder="z.B. KI-News Daily Summary"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button
                onClick={submit}
                disabled={newId.trim().length < 3 || newTitle.trim().length < 1 || creating}
                data-testid="workflows-create-submit"
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

      {workflows === null && !error ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : workflows && workflows.length === 0 ? (
        <Card data-testid="workflows-empty">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ComponentIcon className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Noch kein Workflow</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Klick auf <em>Neuer Workflow</em> und gib ID + Titel ein. Den Rest verkabelst du im Editor (kommt in Phase-5.2).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="workflows-grid">
          {workflows?.map((w) => (
            <Link key={w.id} to="/workflows/$id" params={{ id: w.id }}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`workflow-card-${w.id}`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ComponentIcon className="size-5 text-primary" />
                      <h3 className="font-semibold leading-tight">{w.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {w.triggers.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                  {w.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{w.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1">
                      <ZapIcon className="size-3" />
                      {w.nodeCount} {w.nodeCount === 1 ? 'Node' : 'Nodes'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="size-3" />
                      {w.lastRunId ? 'lief schon' : 'noch nicht gelaufen'}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <PlayIcon className="size-3" />
                    <span className="font-mono text-[10px] truncate">{w.id}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
