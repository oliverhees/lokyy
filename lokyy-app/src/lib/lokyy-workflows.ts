/**
 * Lokyy Workflows — typed client for /api/lokyy/workflows (Phase-5).
 *
 * NOTE: an earlier prototype of this file had an "agent-step" shape
 * that was never wired to real persistence. Phase-5 replaces it with
 * the DAG schema that lokyy-mcp's workflow runtime actually uses.
 */

export type TriggerSpec =
  | { type: 'manual' }
  | { type: 'cron'; schedule: string }
  | { type: 'webhook'; tokenId?: string }
  | { type: 'dashboard-action'; dashboardId: string; actionId: string }

export type NodeSpec = {
  id: string
  type: string
  config: Record<string, unknown>
  position?: { x: number; y: number }
  retryPolicy?: { maxAttempts: number; backoffMs: number }
  failurePolicy?: 'halt' | 'skip' | 'continue'
}

export type EdgeSpec = {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

export type WorkflowSpec = {
  schemaVersion: 1
  id: string
  title: string
  description?: string
  triggers: TriggerSpec[]
  nodes: NodeSpec[]
  edges: EdgeSpec[]
  createdAt: string
  updatedAt: string
}

export type WorkflowListItem = {
  id: string
  title: string
  description?: string
  triggers: string[]
  nodeCount: number
  createdAt: string
  updatedAt: string
  lastRunId: string | null
}

export type WorkflowRunNodeResult = {
  nodeId: string
  status: 'ok' | 'error' | 'skipped'
  input?: unknown
  output?: unknown
  error?: string
  startedAt: string
  finishedAt: string
  durationMs: number
}

export type WorkflowRunRecord = {
  runId: string
  workflowId: string
  triggeredBy: string
  status: 'ok' | 'error' | 'halted'
  startedAt: string
  finishedAt: string
  durationMs: number
  nodes: WorkflowRunNodeResult[]
}

const BASE = '/api/lokyy/workflows'

export async function listWorkflows(): Promise<WorkflowListItem[]> {
  const r = await fetch(BASE, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`listWorkflows: HTTP ${r.status}`)
  const data = (await r.json()) as { workflows: WorkflowListItem[] }
  return data.workflows
}

export async function getWorkflow(id: string): Promise<WorkflowSpec> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`getWorkflow: HTTP ${r.status}`)
  const data = (await r.json()) as { spec: WorkflowSpec }
  return data.spec
}

export async function createWorkflow(spec: Partial<WorkflowSpec> & Pick<WorkflowSpec, 'id' | 'title' | 'triggers' | 'nodes' | 'edges'>): Promise<{ workflowId: string }> {
  const r = await fetch(BASE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`createWorkflow: HTTP ${r.status} ${txt}`)
  }
  return (await r.json()) as { workflowId: string }
}

export async function updateWorkflow(id: string, spec: WorkflowSpec): Promise<{ spec: WorkflowSpec }> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`updateWorkflow: HTTP ${r.status} ${txt}`)
  }
  return (await r.json()) as { spec: WorkflowSpec }
}

export async function deleteWorkflow(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!r.ok) throw new Error(`deleteWorkflow: HTTP ${r.status}`)
}

export async function runWorkflowNow(id: string, input?: unknown): Promise<WorkflowRunRecord> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`runWorkflowNow: HTTP ${r.status} ${txt}`)
  }
  return (await r.json()) as WorkflowRunRecord
}

export async function listWorkflowRuns(id: string): Promise<string[]> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/runs`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`listWorkflowRuns: HTTP ${r.status}`)
  const data = (await r.json()) as { runs: string[] }
  return data.runs
}

export async function getWorkflowRun(id: string, runId: string): Promise<WorkflowRunRecord> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`, {
    credentials: 'same-origin',
  })
  if (!r.ok) throw new Error(`getWorkflowRun: HTTP ${r.status}`)
  return (await r.json()) as WorkflowRunRecord
}
