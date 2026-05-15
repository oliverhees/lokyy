import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import Database from 'better-sqlite3'

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

const DB_PATH = path.join(os.homedir(), '.hermes', 'kanban.db')

function openDb(): Database.Database | null {
  if (!fs.existsSync(DB_PATH)) return null
  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
}

export function kanbanAvailable(): boolean {
  return fs.existsSync(DB_PATH)
}

export function listKanbanTasks(): KanbanTask[] {
  const db = openDb()
  if (!db) return []
  try {
    const rows = db
      .prepare(
        `SELECT id, title, body, status, priority, assignee, created_by, created_at,
         started_at, completed_at, workspace_kind, workspace_path
         FROM tasks ORDER BY priority DESC, created_at DESC`,
      )
      .all() as Array<{
      id: string
      title: string
      body: string | null
      status: string
      priority: number
      assignee: string | null
      created_by: string | null
      created_at: number
      started_at: number | null
      completed_at: number | null
      workspace_kind: string | null
      workspace_path: string | null
    }>
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? '',
      status: r.status,
      priority: r.priority,
      assignee: r.assignee,
      createdBy: r.created_by,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      workspaceKind: r.workspace_kind,
      workspacePath: r.workspace_path,
    }))
  } finally {
    db.close()
  }
}

export function listKanbanStatuses(): string[] {
  const db = openDb()
  if (!db) return []
  try {
    const rows = db.prepare('SELECT DISTINCT status FROM tasks').all() as Array<{ status: string }>
    return rows.map((r) => r.status)
  } finally {
    db.close()
  }
}
