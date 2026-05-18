/**
 * Workflow-Schema (Phase-5.0, ADR-009).
 *
 * A workflow is a directed-acyclic-graph (DAG) of typed nodes wired by
 * edges. Triggers fire workflow runs; each run produces a run-record
 * with per-node input/output captured.
 *
 * The schema is plain TS types here + a runtime validator
 * (validateWorkflowSpec) — JSON-Schema generation is a follow-up.
 */

export type TriggerSpec =
  | { type: "manual" }
  | { type: "cron"; schedule: string }
  | { type: "webhook"; tokenId?: string }
  | { type: "dashboard-action"; dashboardId: string; actionId: string };

/** All registered node-types. Add new ones to NODE_TYPES below. */
export type NodeType =
  | "manual-trigger"
  | "http-fetch"
  | "value"
  | "llm-call"
  | "dashboard.save_data"
  | "branch";

export const NODE_TYPES: NodeType[] = [
  "manual-trigger",
  "http-fetch",
  "value",
  "llm-call",
  "dashboard.save_data",
  "branch",
];

export type NodeSpec = {
  id: string;
  type: NodeType;
  /** Node-type-specific configuration. Validation happens in the executor. */
  config: Record<string, unknown>;
  /** Editor-only — position in the canvas. Ignored at runtime. */
  position?: { x: number; y: number };
  retryPolicy?: { maxAttempts: number; backoffMs: number };
  failurePolicy?: "halt" | "skip" | "continue";
};

export type EdgeSpec = {
  id: string;
  source: string;
  target: string;
  /** For branch nodes: which output port to follow ("true" / "false"). */
  sourceHandle?: string;
};

export type WorkflowSpec = {
  /** Schema version — increments when the schema breaks compat. */
  schemaVersion: 1;
  id: string;
  title: string;
  description?: string;
  triggers: TriggerSpec[];
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunNodeResult = {
  nodeId: string;
  status: "ok" | "error" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type WorkflowRunRecord = {
  runId: string;
  workflowId: string;
  triggeredBy: TriggerSpec["type"] | "manual-api";
  status: "ok" | "error" | "halted";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  nodes: WorkflowRunNodeResult[];
};

// ─── Validation ─────────────────────────────────────────────────────────────

type Issue = { path: string; message: string };

export function validateWorkflowSpec(input: unknown): {
  ok: true;
  spec: WorkflowSpec;
} | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, issues: [{ path: "$", message: "spec must be object" }] };
  }
  const s = input as Record<string, unknown>;

  if (s.schemaVersion !== 1) {
    issues.push({ path: "$.schemaVersion", message: "must equal 1" });
  }
  if (typeof s.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/i.test(s.id)) {
    issues.push({ path: "$.id", message: "must be slug (3-64 chars)" });
  }
  if (typeof s.title !== "string" || s.title.trim().length < 1) {
    issues.push({ path: "$.title", message: "title required" });
  }
  if (!Array.isArray(s.triggers)) {
    issues.push({ path: "$.triggers", message: "must be array" });
  } else {
    s.triggers.forEach((t, i) => validateTrigger(t, `$.triggers[${i}]`, issues));
  }
  if (!Array.isArray(s.nodes) || s.nodes.length === 0) {
    issues.push({ path: "$.nodes", message: "at least 1 node required" });
  } else {
    const nodeIds = new Set<string>();
    s.nodes.forEach((n, i) => {
      validateNode(n, `$.nodes[${i}]`, issues);
      if ((n as NodeSpec).id) {
        if (nodeIds.has((n as NodeSpec).id)) {
          issues.push({ path: `$.nodes[${i}].id`, message: "duplicate node id" });
        }
        nodeIds.add((n as NodeSpec).id);
      }
    });
  }
  if (!Array.isArray(s.edges)) {
    issues.push({ path: "$.edges", message: "must be array" });
  } else {
    s.edges.forEach((e, i) => validateEdge(e, `$.edges[${i}]`, issues));
  }
  if (typeof s.createdAt !== "string") {
    issues.push({ path: "$.createdAt", message: "ISO timestamp required" });
  }
  if (typeof s.updatedAt !== "string") {
    issues.push({ path: "$.updatedAt", message: "ISO timestamp required" });
  }

  if (issues.length > 0) return { ok: false, issues };

  // DAG check: no cycles, every edge references existing node
  if (Array.isArray(s.nodes) && Array.isArray(s.edges)) {
    const nodes = s.nodes as NodeSpec[];
    const edges = s.edges as EdgeSpec[];
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (!ids.has(e.source)) {
        issues.push({ path: `edge ${e.id}`, message: `source '${e.source}' not in nodes` });
      }
      if (!ids.has(e.target)) {
        issues.push({ path: `edge ${e.id}`, message: `target '${e.target}' not in nodes` });
      }
    }
    if (hasCycle(nodes, edges)) {
      issues.push({ path: "$.edges", message: "graph has a cycle" });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, spec: input as WorkflowSpec };
}

function validateTrigger(t: unknown, path: string, issues: Issue[]) {
  if (!t || typeof t !== "object") {
    issues.push({ path, message: "must be object" });
    return;
  }
  const tt = (t as { type?: string }).type;
  if (!tt) {
    issues.push({ path: `${path}.type`, message: "required" });
    return;
  }
  switch (tt) {
    case "manual":
      break;
    case "cron":
      if (typeof (t as { schedule?: string }).schedule !== "string") {
        issues.push({ path: `${path}.schedule`, message: "required for cron" });
      }
      break;
    case "webhook":
      break;
    case "dashboard-action": {
      const dt = t as { dashboardId?: string; actionId?: string };
      if (!dt.dashboardId) issues.push({ path: `${path}.dashboardId`, message: "required" });
      if (!dt.actionId) issues.push({ path: `${path}.actionId`, message: "required" });
      break;
    }
    default:
      issues.push({ path: `${path}.type`, message: `unknown: ${tt}` });
  }
}

function validateNode(n: unknown, path: string, issues: Issue[]) {
  if (!n || typeof n !== "object") {
    issues.push({ path, message: "must be object" });
    return;
  }
  const node = n as Record<string, unknown>;
  if (typeof node.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(node.id)) {
    issues.push({ path: `${path}.id`, message: "slug-shaped id required" });
  }
  if (typeof node.type !== "string" || !NODE_TYPES.includes(node.type as NodeType)) {
    issues.push({
      path: `${path}.type`,
      message: `must be one of: ${NODE_TYPES.join(", ")}`,
    });
  }
  if (!node.config || typeof node.config !== "object") {
    issues.push({ path: `${path}.config`, message: "config object required (can be {})" });
  }
}

function validateEdge(e: unknown, path: string, issues: Issue[]) {
  if (!e || typeof e !== "object") {
    issues.push({ path, message: "must be object" });
    return;
  }
  const edge = e as Record<string, unknown>;
  if (typeof edge.id !== "string") issues.push({ path: `${path}.id`, message: "required" });
  if (typeof edge.source !== "string") issues.push({ path: `${path}.source`, message: "required" });
  if (typeof edge.target !== "string") issues.push({ path: `${path}.target`, message: "required" });
}

function hasCycle(nodes: NodeSpec[], edges: EdgeSpec[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);
  function dfs(id: string): boolean {
    color.set(id, GRAY);
    for (const next of adj.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  }
  for (const n of nodes) {
    if (color.get(n.id) === WHITE && dfs(n.id)) return true;
  }
  return false;
}

/** Topo-sort. Returns nodes in execution order, or null on cycle. */
export function topoSort(nodes: NodeSpec[], edges: EdgeSpec[]): NodeSpec[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const ready: string[] = [];
  for (const [id, d] of indeg.entries()) if (d === 0) ready.push(id);
  const result: NodeSpec[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  while (ready.length > 0) {
    const id = ready.shift()!;
    const n = byId.get(id);
    if (n) result.push(n);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if (indeg.get(next) === 0) ready.push(next);
    }
  }
  if (result.length !== nodes.length) return null; // cycle
  return result;
}
