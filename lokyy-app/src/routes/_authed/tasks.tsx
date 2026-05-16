import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SquareKanbanIcon, UserIcon, ClockIcon, FolderIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listKanban, KANBAN_COLUMNS, priorityLabel, type KanbanTask } from '@/lib/lokyy-kanban'

export const Route = createFileRoute('/_authed/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listKanban()
      .then((d) => {
        setAvailable(d.available)
        setTasks(d.tasks)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (available === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!available) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
        <Card>
          <CardContent className="p-6 text-center" data-testid="tasks-unavailable">
            <SquareKanbanIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Hermes-Kanban nicht initialisiert</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Init via <code className="rounded bg-muted px-1">hermes kanban init</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const grouped = new Map<string, KanbanTask[]>()
  for (const col of KANBAN_COLUMNS) grouped.set(col.key, [])
  for (const t of tasks) {
    const key = grouped.has(t.status) ? t.status : 'todo'
    grouped.get(key)!.push(t)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Hermes-Kanban-Board. {tasks.length} Tasks insgesamt. Create/Claim/Complete via{' '}
          <code className="rounded bg-muted px-1">hermes kanban</code> CLI (UI-Editor kommt in Phase 7.3).
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="tasks-board">
        {KANBAN_COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? []
          return (
            <Card key={col.key} className="flex flex-col" data-testid={`tasks-col-${col.key}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{col.label}</CardTitle>
                  <Badge variant="secondary" className={col.accent}>{items.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">leer</p>
                ) : (
                  items.map((t) => <TaskCard key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: KanbanTask }) {
  const ageMs = Date.now() - task.createdAt * 1000
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  return (
    <div
      className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{task.title}</p>
        <Badge variant="outline" className="shrink-0 text-xs">{priorityLabel(task.priority)}</Badge>
      </div>
      {task.body ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.body}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.assignee ? (
          <span className="flex items-center gap-1"><UserIcon className="size-3" /> {task.assignee}</span>
        ) : null}
        {task.workspaceKind ? (
          <span className="flex items-center gap-1"><FolderIcon className="size-3" /> {task.workspaceKind}</span>
        ) : null}
        <span className="flex items-center gap-1"><ClockIcon className="size-3" /> {ageDays}d</span>
      </div>
    </div>
  )
}
