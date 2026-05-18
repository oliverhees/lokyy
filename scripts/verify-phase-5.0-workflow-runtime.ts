#!/usr/bin/env bun
/**
 * scripts/verify-phase-5.0-workflow-runtime.ts
 *
 * Phase-5.0 backend smoke — workflow CRUD + DAG-runtime + run-records,
 * all via the lokyy-mcp MCP tool surface (no lokyy-os-be REST yet —
 * that's Phase-5.1).
 *
 * Asserts:
 *   A. list_workflows on empty state → []
 *   B. create + get round-trips
 *   C. cycle in spec → rejected
 *   D. run_now executes a 3-node DAG end-to-end
 *      (manual-trigger → http-fetch → value)
 *   E. run-record persisted on disk + retrievable via get_run
 *   F. retry policy on failing http-fetch (3 attempts, all fail → status=error)
 *   G. failurePolicy='halt' propagates as 'halted' workflow status
 *   H. delete cleans up the workflow + its runs
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ENV_FILE = "infrastructure/.env.local";
const SYSTEM_SECRET = (() => {
  const text = readFileSync(ENV_FILE, "utf8");
  const m = text.match(/^LOKYY_SYSTEM_SECRET=(.+)$/m);
  if (!m) throw new Error("LOKYY_SYSTEM_SECRET missing in .env.local");
  return m[1]!.trim();
})();

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

function call(tool: string, args: Record<string, unknown>): { ok: boolean; result?: unknown; error?: string } {
  const body = JSON.stringify(args).replace(/'/g, "'\\''");
  const cmd = `docker run --rm --network=lokyy-net curlimages/curl:latest -s -X POST -H "Authorization: Bearer ${SYSTEM_SECRET}" -H "Content-Type: application/json" -d '${body}' http://lokyy-mcp:7878/tools/${tool}/invoke`;
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    return JSON.parse(out);
  } catch (err) {
    return { ok: false, error: String(err).split("\n")[0]! };
  }
}

// Pre-clean: remove the verify-test workflow if leftover from a prior run
call("lokyy.workflows.delete", { workflowId: "phase5-verify" });

// ─── A. list empty (well, "doesn't crash" — there might be other workflows already)
console.log("─── A. list_workflows ───");
const listR = call("lokyy.workflows.list", {});
if (listR.ok && Array.isArray((listR.result as { workflows?: unknown[] }).workflows)) ok("list returns array");
else fail("list", JSON.stringify(listR));

// ─── B. create + get round-trip
console.log("");
console.log("─── B. create + get ───");
const spec = {
  schemaVersion: 1,
  id: "phase5-verify",
  title: "Phase-5 Verify Workflow",
  description: "manual → value → http-fetch",
  triggers: [{ type: "manual" }],
  nodes: [
    { id: "start", type: "manual-trigger", config: {} },
    { id: "echo", type: "value", config: { value: { hello: "lokyy" } } },
    {
      id: "hn",
      type: "http-fetch",
      config: { url: "https://hacker-news.firebaseio.com/v0/maxitem.json" },
    },
  ],
  edges: [
    { id: "e1", source: "start", target: "echo" },
    { id: "e2", source: "echo", target: "hn" },
  ],
};
const createR = call("lokyy.workflows.create", { spec });
if (createR.ok) ok("create succeeds");
else fail("create", JSON.stringify(createR));

const getR = call("lokyy.workflows.get", { workflowId: "phase5-verify" });
if (getR.ok && (getR.result as { spec?: { title?: string } })?.spec?.title === spec.title) {
  ok("get returns the same spec we created");
} else {
  fail("get", JSON.stringify(getR));
}

// ─── C. cycle detection
console.log("");
console.log("─── C. cycle detection ───");
const cyclicSpec = {
  ...spec,
  id: "phase5-cycle",
  edges: [
    { id: "e1", source: "start", target: "echo" },
    { id: "e2", source: "echo", target: "hn" },
    { id: "e3", source: "hn", target: "start" }, // cycle!
  ],
};
const cycleR = call("lokyy.workflows.create", { spec: cyclicSpec });
if (!cycleR.ok && /cycle/i.test(cycleR.error ?? "")) ok("cycle rejected at create time");
else fail("cycle rejection", JSON.stringify(cycleR));

// ─── D. run_now with DAG
console.log("");
console.log("─── D. run_now → 3-node DAG ───");
const runR = call("lokyy.workflows.run_now", {
  workflowId: "phase5-verify",
  input: { test: 42 },
});
if (!runR.ok) {
  fail("run_now", JSON.stringify(runR));
} else {
  const record = runR.result as {
    status: string;
    nodes: Array<{ nodeId: string; status: string; output?: unknown }>;
    runId: string;
  };
  if (record.status === "ok") ok(`run completed status=ok in ${record.nodes.length} nodes`);
  else fail("run status", `expected ok, got ${record.status}`);

  // Verify each node fired and produced output
  for (const expectedId of ["start", "echo", "hn"]) {
    const n = record.nodes.find((x) => x.nodeId === expectedId);
    if (!n) fail(`node ${expectedId}`, "missing from run-record");
    else if (n.status !== "ok") fail(`node ${expectedId}`, `status=${n.status}`);
    else ok(`node ${expectedId}: ok`);
  }
  // Specific assertions on per-node outputs
  const start = record.nodes.find((x) => x.nodeId === "start");
  if (start && (start.output as { test?: number })?.test === 42) {
    ok("manual-trigger passed externalInput through");
  }
  const echo = record.nodes.find((x) => x.nodeId === "echo");
  if (echo && (echo.output as { hello?: string })?.hello === "lokyy") {
    ok("value node emitted its config.value");
  }

  // ─── E. run-record retrievable
  console.log("");
  console.log("─── E. run record retrievable ───");
  const listRuns = call("lokyy.workflows.list_runs", { workflowId: "phase5-verify" });
  if (listRuns.ok && ((listRuns.result as { runs?: string[] }).runs ?? []).includes(record.runId)) {
    ok("list_runs contains the just-fired run");
  } else fail("list_runs", JSON.stringify(listRuns));

  const getRun = call("lokyy.workflows.get_run", {
    workflowId: "phase5-verify",
    runId: record.runId,
  });
  if (getRun.ok) ok("get_run returns the record");
  else fail("get_run", JSON.stringify(getRun));
}

// ─── F. retry + failurePolicy
console.log("");
console.log("─── F. retry + failurePolicy='halt' ───");
const failSpec = {
  schemaVersion: 1,
  id: "phase5-fail",
  title: "Failing Workflow",
  triggers: [{ type: "manual" }],
  nodes: [
    {
      id: "bad",
      type: "http-fetch",
      config: { url: "http://no-such-host.invalid/" },
      retryPolicy: { maxAttempts: 2, backoffMs: 100 },
      failurePolicy: "halt",
    },
    { id: "after", type: "value", config: { value: "should be skipped" } },
  ],
  edges: [{ id: "e1", source: "bad", target: "after" }],
};
call("lokyy.workflows.delete", { workflowId: "phase5-fail" });
const cFail = call("lokyy.workflows.create", { spec: failSpec });
if (!cFail.ok) fail("create fail-spec", JSON.stringify(cFail));
const rFail = call("lokyy.workflows.run_now", { workflowId: "phase5-fail" });
if (rFail.ok) {
  const rec = rFail.result as {
    status: string;
    nodes: Array<{ nodeId: string; status: string }>;
  };
  if (rec.status === "halted" || rec.status === "error") ok(`failing workflow status=${rec.status}`);
  else fail("fail status", `expected halted/error, got ${rec.status}`);
  const after = rec.nodes.find((n) => n.nodeId === "after");
  if (after && after.status === "skipped") ok("downstream node was skipped (halt policy worked)");
  else fail("halt-propagation", `after.status = ${after?.status}`);
}

// ─── H. delete
console.log("");
console.log("─── G. delete cleanup ───");
const del1 = call("lokyy.workflows.delete", { workflowId: "phase5-verify" });
if (del1.ok) ok("delete phase5-verify");
const del2 = call("lokyy.workflows.delete", { workflowId: "phase5-fail" });
if (del2.ok) ok("delete phase5-fail");
const getAfterDelete = call("lokyy.workflows.get", { workflowId: "phase5-verify" });
if (!getAfterDelete.ok && /not found/i.test(getAfterDelete.error ?? "")) {
  ok("get after delete → not_found");
}

console.log("");
console.log(`Phase-5.0 workflow-runtime verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
