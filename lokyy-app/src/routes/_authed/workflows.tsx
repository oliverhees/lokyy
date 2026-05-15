import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PlusIcon, ComponentIcon, Trash2Icon, ChevronRightIcon, PlayIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  listWorkflows,
  createWorkflow,
  deleteWorkflow,
  type Workflow,
  type WorkflowStep,
} from '@/lib/lokyy-workflows'
import { listAgents, type Agent } from '@/lib/lokyy-agents'

export const Route = createFileRoute('/_authed/workflows')({
  component: WorkflowsPage,
})

function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    try {
      setWorkflows(await listWorkflows())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
    listAgents().then(setAgents).catch(() => {})
  }, [])

  async function onCreate(input: { name: string; description: string; steps: WorkflowStep[] }) {
    try {
      await createWorkflow(input)
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Workflow löschen?')) return
    await deleteWorkflow(id)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Verkette Agents zu Pipelines. Jeder Step ist ein Agent mit einem Prompt — Ergebnis fließt in den nächsten.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="workflows-add">
          <PlusIcon className="size-4" /> Neuer Workflow
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : workflows === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <ComponentIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="workflows-empty">Noch keine Workflows</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klick "Neuer Workflow", um deinen ersten Pipeline-Builder anzulegen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="workflows-grid">
          {workflows.map((w) => (
            <Card key={w.id} data-testid={`workflow-card-${w.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{w.name}</CardTitle>
                    {w.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Run-Engine kommt in eigener Phase"
                      className="cursor-not-allowed"
                      onClick={(e) => e.preventDefault()}
                    >
                      <PlayIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(w.id)}
                      data-testid={`workflow-delete-${w.id}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{w.steps.length} steps</Badge>
                </div>
                {w.steps.length > 0 ? (
                  <ol className="space-y-1 text-sm">
                    {w.steps.map((s, i) => {
                      const agent = agents.find((a) => a.id === s.agentId)
                      return (
                        <li key={s.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{i + 1}.</span>
                          <Badge variant="outline" className="text-xs">{agent?.name ?? s.agentId}</Badge>
                          <ChevronRightIcon className="size-3 text-muted-foreground" />
                          <span className="truncate text-xs text-muted-foreground">{s.prompt}</span>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className="text-xs italic text-muted-foreground">keine Steps definiert</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateWorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        onCreate={onCreate}
      />
    </div>
  )
}

function CreateWorkflowDialog({
  open,
  onOpenChange,
  agents,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agents: Agent[]
  onCreate: (input: { name: string; description: string; steps: WorkflowStep[] }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setSteps([])
    }
  }, [open])

  function addStep() {
    if (agents.length === 0) return
    setSteps((s) => [
      ...s,
      { id: crypto.randomUUID(), agentId: agents[0].id, prompt: '' },
    ])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuer Workflow</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onCreate({ name, description, steps })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="workflow-form-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wf-desc">Beschreibung</Label>
            <Input id="wf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steps</Label>
              <Button type="button" size="sm" variant="outline" onClick={addStep}>
                <PlusIcon className="size-3" /> Step
              </Button>
            </div>
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Steps. Füge einen hinzu.</p>
            ) : (
              <ol className="space-y-2">
                {steps.map((s, i) => (
                  <li key={s.id} className="space-y-1 rounded-md border border-border/60 p-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{i + 1}.</span>
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                        value={s.agentId}
                        onChange={(e) => {
                          const v = e.target.value
                          setSteps((arr) => arr.map((x) => (x.id === s.id ? { ...x, agentId: v } : x)))
                        }}
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSteps((arr) => arr.filter((x) => x.id !== s.id))}
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Prompt für diesen Step"
                      value={s.prompt}
                      onChange={(e) => {
                        const v = e.target.value
                        setSteps((arr) => arr.map((x) => (x.id === s.id ? { ...x, prompt: v } : x)))
                      }}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" data-testid="workflow-form-save">Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
