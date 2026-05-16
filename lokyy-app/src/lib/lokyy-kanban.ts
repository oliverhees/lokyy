export type KanbanTask = {
  id: string
  title: string
  body: string
  status: string
  priority: number
  assignee: string | null
  createdBy: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  workspaceKind: string | null
  workspacePath: string | null
}

export type KanbanResponse = {
  available: boolean
  tasks: KanbanTask[]
  statuses: string[]
}

export async function listKanban(): Promise<KanbanResponse> {
  const res = await fetch('/api/lokyy/tasks')
  if (!res.ok) throw new Error(`Failed: ${res.status}`)
  return (await res.json()) as KanbanResponse
}

export const KANBAN_COLUMNS = [
  { key: 'todo', label: 'To Do', accent: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { key: 'claimed', label: 'In Progress', accent: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { key: 'blocked', label: 'Blocked', accent: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  { key: 'done', label: 'Done', accent: 'bg-green-500/10 text-green-700 dark:text-green-300' },
] as const

export function priorityLabel(p: number): string {
  if (p >= 10) return 'P0'
  if (p >= 5) return 'P1'
  if (p >= 1) return 'P2'
  return 'P3'
}
