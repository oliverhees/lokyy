/**
 * Workflow runtime (Phase-5.0).
 *
 * Sequential DAG-executor: topo-sort the nodes, then walk in order.
 * Each node receives a `NodeInputs` object keyed by upstream-node-id;
 * its output is captured + recorded.
 *
 * Per-node policy is respected:
 *   - retryPolicy:    { maxAttempts, backoffMs }
 *   - failurePolicy:  'halt' (default) | 'skip' | 'continue'
 *
 * Parallel branches stay sequential in v1 — topo-sort already linearizes
 * a valid DAG. We add a parallel-executor in a later sub-slice if needed.
 */
import {
  type WorkflowSpec,
  type WorkflowRunRecord,
  type WorkflowRunNodeResult,
  type TriggerSpec,
  topoSort,
} from "./schema.ts";
import { newRunId, writeRunRecord } from "./storage.ts";
import { NODE_EXECUTORS, isKnownNodeType, type NodeInputs } from "./nodes.ts";

export type RunOptions = {
  triggeredBy?: TriggerSpec["type"] | "manual-api";
  externalInput?: unknown;
};

export async function runWorkflow(
  spec: WorkflowSpec,
  opts: RunOptions = {}
): Promise<WorkflowRunRecord> {
  const runId = newRunId();
  const triggeredBy = opts.triggeredBy ?? "manual-api";
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const nodeResults: WorkflowRunNodeResult[] = [];
  const outputs = new Map<string, unknown>();

  const sorted = topoSort(spec.nodes, spec.edges);
  if (!sorted) {
    const record: WorkflowRunRecord = {
      runId,
      workflowId: spec.id,
      triggeredBy,
      status: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      nodes: [
        {
          nodeId: "(graph)",
          status: "error",
          error: "cycle detected — cannot execute",
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: 0,
        },
      ],
    };
    writeRunRecord(record);
    return record;
  }

  // Pre-compute inputs-source-map: for each node, which upstream nodes feed it.
  const incoming = new Map<string, string[]>();
  for (const n of sorted) incoming.set(n.id, []);
  for (const e of spec.edges) incoming.get(e.target)?.push(e.source);

  let halted = false;

  for (const node of sorted) {
    const nodeStart = new Date().toISOString();
    const nt0 = Date.now();

    // If we previously halted, mark remaining nodes as skipped.
    if (halted) {
      nodeResults.push({
        nodeId: node.id,
        status: "skipped",
        error: "halted by earlier failure",
        startedAt: nodeStart,
        finishedAt: nodeStart,
        durationMs: 0,
      });
      continue;
    }

    // Check that the node-type is implemented in this Lokyy build.
    if (!isKnownNodeType(node.type)) {
      nodeResults.push({
        nodeId: node.id,
        status: "error",
        error: `unknown node-type '${node.type}' — not registered in this build`,
        startedAt: nodeStart,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - nt0,
      });
      if ((node.failurePolicy ?? "halt") === "halt") halted = true;
      continue;
    }

    // Build inputs from upstream node outputs.
    const inputs: NodeInputs = {};
    for (const upstreamId of incoming.get(node.id) ?? []) {
      if (outputs.has(upstreamId)) inputs[upstreamId] = outputs.get(upstreamId);
    }

    // Execute with retry policy.
    const exec = NODE_EXECUTORS[node.type]!;
    const maxAttempts = Math.max(1, node.retryPolicy?.maxAttempts ?? 1);
    const backoffMs = Math.max(0, node.retryPolicy?.backoffMs ?? 0);

    let result: { ok: true; output: unknown } | { ok: false; error: string } = {
      ok: false,
      error: "not run",
    };
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const output = await exec(node.config ?? {}, inputs, {
          workflowId: spec.id,
          runId,
          externalInput: opts.externalInput,
        });
        result = { ok: true, output };
        break;
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        result = { ok: false, error: msg };
        if (attempt < maxAttempts && backoffMs > 0) {
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - nt0;

    if (result.ok) {
      outputs.set(node.id, result.output);
      nodeResults.push({
        nodeId: node.id,
        status: "ok",
        input: inputs,
        output: result.output,
        startedAt: nodeStart,
        finishedAt,
        durationMs,
      });
    } else {
      const policy = node.failurePolicy ?? "halt";
      nodeResults.push({
        nodeId: node.id,
        status: "error",
        input: inputs,
        error: result.error,
        startedAt: nodeStart,
        finishedAt,
        durationMs,
      });
      if (policy === "halt") halted = true;
      // 'skip' and 'continue' both let the workflow proceed — they differ
      // only in whether downstream nodes can see this node's output.
      // For now both are treated the same (no output captured).
    }
  }

  const status: WorkflowRunRecord["status"] = halted
    ? "halted"
    : nodeResults.some((r) => r.status === "error")
    ? "error"
    : "ok";

  const record: WorkflowRunRecord = {
    runId,
    workflowId: spec.id,
    triggeredBy,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    nodes: nodeResults,
  };
  writeRunRecord(record);
  return record;
}
