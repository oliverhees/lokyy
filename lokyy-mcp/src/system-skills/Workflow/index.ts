/**
 * MCP-Tools für Workflow-CRUD + Run-Now (Phase-5.0).
 *
 * Surface:
 *   lokyy.workflows.create({ spec })           → { workflowId }
 *   lokyy.workflows.list()                     → { workflows: [...] }
 *   lokyy.workflows.get({ workflowId })        → { spec }
 *   lokyy.workflows.update({ workflowId, spec }) → { spec }
 *   lokyy.workflows.delete({ workflowId })     → { ok }
 *   lokyy.workflows.run_now({ workflowId, input? }) → run-record
 *   lokyy.workflows.list_runs({ workflowId })  → { runs: [runId] }
 *   lokyy.workflows.get_run({ workflowId, runId }) → WorkflowRunRecord
 *
 * All tools are system-bearer-only (proxied via lokyy-os-be later).
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";
import {
  validateWorkflowSpec,
  type WorkflowSpec,
} from "./schema.ts";
import {
  deleteWorkflow,
  listRunIds,
  listWorkflowIds,
  readRun,
  readWorkflow,
  workflowExists,
  writeWorkflow,
} from "./storage.ts";
import { runWorkflow } from "./executor.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function ensureSpec(input: unknown): WorkflowSpec {
  if (!input || typeof input !== "object") throw new Error("spec object required");
  // Allow caller to omit createdAt/updatedAt on create; we'll fill them in.
  const partial = input as Record<string, unknown>;
  const now = nowIso();
  const candidate = {
    schemaVersion: 1,
    ...partial,
    createdAt: typeof partial.createdAt === "string" ? partial.createdAt : now,
    updatedAt: now,
  };
  const v = validateWorkflowSpec(candidate);
  if (!v.ok) {
    throw new Error(`spec invalid: ${v.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
  }
  return v.spec;
}

// ─── create ────────────────────────────────────────────────────────────────

export const createTool: Tool = {
  name: "lokyy.workflows.create",
  description: "Create a new workflow from a WorkflowSpec.",
  inputSchema: {
    type: "object",
    properties: { spec: { type: "object" } },
    required: ["spec"],
  } as Tool["inputSchema"],
};

async function createHandle(rawArgs: unknown, _p: Principal) {
  const a = rawArgs as { spec?: unknown };
  const spec = ensureSpec(a.spec);
  if (workflowExists(spec.id)) {
    throw new Error(`workflow '${spec.id}' already exists`);
  }
  writeWorkflow(spec);
  return { workflowId: spec.id };
}

// ─── list ──────────────────────────────────────────────────────────────────

export const listTool: Tool = {
  name: "lokyy.workflows.list",
  description: "List all workflow IDs + their titles + trigger types.",
  inputSchema: { type: "object", properties: {} } as Tool["inputSchema"],
};

async function listHandle() {
  const items = listWorkflowIds()
    .map((id) => {
      const s = readWorkflow(id);
      if (!s) return null;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        triggers: s.triggers.map((t) => t.type),
        nodeCount: s.nodes.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastRunId: listRunIds(s.id)[0] ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { workflows: items };
}

// ─── get ───────────────────────────────────────────────────────────────────

export const getTool: Tool = {
  name: "lokyy.workflows.get",
  description: "Read a workflow spec by id.",
  inputSchema: {
    type: "object",
    properties: { workflowId: { type: "string", minLength: 1 } },
    required: ["workflowId"],
  } as Tool["inputSchema"],
};

async function getHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string };
  if (!a.workflowId) throw new Error("workflowId required");
  const spec = readWorkflow(a.workflowId);
  if (!spec) throw new Error(`workflow '${a.workflowId}' not found`);
  return { spec };
}

// ─── update ────────────────────────────────────────────────────────────────

export const updateTool: Tool = {
  name: "lokyy.workflows.update",
  description: "Replace a workflow's spec. The id stays; updatedAt is refreshed.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: { type: "string", minLength: 1 },
      spec: { type: "object" },
    },
    required: ["workflowId", "spec"],
  } as Tool["inputSchema"],
};

async function updateHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string; spec?: unknown };
  if (!a.workflowId) throw new Error("workflowId required");
  if (!workflowExists(a.workflowId)) {
    throw new Error(`workflow '${a.workflowId}' not found`);
  }
  // Force id consistency with the path-arg
  const merged = { ...(a.spec as Record<string, unknown>), id: a.workflowId };
  const spec = ensureSpec(merged);
  writeWorkflow(spec);
  return { spec };
}

// ─── delete ────────────────────────────────────────────────────────────────

export const deleteTool: Tool = {
  name: "lokyy.workflows.delete",
  description: "Delete a workflow + all its runs.",
  inputSchema: {
    type: "object",
    properties: { workflowId: { type: "string", minLength: 1 } },
    required: ["workflowId"],
  } as Tool["inputSchema"],
};

async function deleteHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string };
  if (!a.workflowId) throw new Error("workflowId required");
  const ok = deleteWorkflow(a.workflowId);
  if (!ok) throw new Error(`workflow '${a.workflowId}' not found`);
  return { ok: true, workflowId: a.workflowId };
}

// ─── run_now ───────────────────────────────────────────────────────────────

export const runNowTool: Tool = {
  name: "lokyy.workflows.run_now",
  description:
    "Execute a workflow immediately and return the run-record. Optional 'input' is passed to the manual-trigger node.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: { type: "string", minLength: 1 },
      input: {},
    },
    required: ["workflowId"],
  } as Tool["inputSchema"],
};

async function runNowHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string; input?: unknown };
  if (!a.workflowId) throw new Error("workflowId required");
  const spec = readWorkflow(a.workflowId);
  if (!spec) throw new Error(`workflow '${a.workflowId}' not found`);
  const record = await runWorkflow(spec, {
    triggeredBy: "manual-api",
    externalInput: a.input,
  });
  return record;
}

// ─── runs (list + get) ─────────────────────────────────────────────────────

export const listRunsTool: Tool = {
  name: "lokyy.workflows.list_runs",
  description: "List run-IDs for a workflow (newest first).",
  inputSchema: {
    type: "object",
    properties: { workflowId: { type: "string", minLength: 1 } },
    required: ["workflowId"],
  } as Tool["inputSchema"],
};

async function listRunsHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string };
  if (!a.workflowId) throw new Error("workflowId required");
  return { runs: listRunIds(a.workflowId) };
}

export const getRunTool: Tool = {
  name: "lokyy.workflows.get_run",
  description: "Read a specific run-record.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: { type: "string", minLength: 1 },
      runId: { type: "string", minLength: 1 },
    },
    required: ["workflowId", "runId"],
  } as Tool["inputSchema"],
};

async function getRunHandle(rawArgs: unknown) {
  const a = rawArgs as { workflowId?: string; runId?: string };
  if (!a.workflowId || !a.runId) throw new Error("workflowId + runId required");
  const record = readRun(a.workflowId, a.runId);
  if (!record) throw new Error(`run '${a.runId}' not found`);
  return record;
}

// ─── Exports for tool-registry ─────────────────────────────────────────────

export const tools = {
  create: { tool: createTool, handle: createHandle },
  list: { tool: listTool, handle: listHandle },
  get: { tool: getTool, handle: getHandle },
  update: { tool: updateTool, handle: updateHandle },
  remove: { tool: deleteTool, handle: deleteHandle },
  runNow: { tool: runNowTool, handle: runNowHandle },
  listRuns: { tool: listRunsTool, handle: listRunsHandle },
  getRun: { tool: getRunTool, handle: getRunHandle },
};
