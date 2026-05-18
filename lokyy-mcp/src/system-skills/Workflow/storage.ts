/**
 * File-based Workflow storage. Mirrors the Dashboards pattern.
 *
 *   /app/data/workflows/{id}/
 *     spec.json            ← WorkflowSpec
 *     runs/{run-id}.json   ← WorkflowRunRecord per execution
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { WorkflowSpec, WorkflowRunRecord } from "./schema.ts";

const WORKFLOWS_ROOT =
  process.env.LOKYY_WORKFLOWS_ROOT ?? "/app/data/workflows";

function safeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(id);
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function workflowExists(id: string): boolean {
  if (!safeId(id)) return false;
  return existsSync(join(WORKFLOWS_ROOT, id, "spec.json"));
}

export function listWorkflowIds(): string[] {
  if (!existsSync(WORKFLOWS_ROOT)) return [];
  return readdirSync(WORKFLOWS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter(safeId)
    .filter((id) => existsSync(join(WORKFLOWS_ROOT, id, "spec.json")));
}

export function readWorkflow(id: string): WorkflowSpec | null {
  if (!safeId(id)) return null;
  const p = join(WORKFLOWS_ROOT, id, "spec.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as WorkflowSpec;
  } catch {
    return null;
  }
}

export function writeWorkflow(spec: WorkflowSpec): void {
  if (!safeId(spec.id)) throw new Error("invalid workflow id");
  const p = join(WORKFLOWS_ROOT, spec.id, "spec.json");
  ensureDir(dirname(p));
  writeFileSync(p, JSON.stringify(spec, null, 2));
}

export function deleteWorkflow(id: string): boolean {
  if (!safeId(id)) return false;
  const dir = join(WORKFLOWS_ROOT, id);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}

export function newRunId(): string {
  // Sortable by lex order — ISO date prefix + 8 hex chars
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${ts}-${randomBytes(4).toString("hex")}`;
}

export function writeRunRecord(record: WorkflowRunRecord): string {
  const runDir = join(WORKFLOWS_ROOT, record.workflowId, "runs");
  ensureDir(runDir);
  const path = join(runDir, `${record.runId}.json`);
  writeFileSync(path, JSON.stringify(record, null, 2));
  return path;
}

export function listRunIds(workflowId: string): string[] {
  if (!safeId(workflowId)) return [];
  const runDir = join(WORKFLOWS_ROOT, workflowId, "runs");
  if (!existsSync(runDir)) return [];
  return readdirSync(runDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort()
    .reverse(); // newest first
}

export function readRun(workflowId: string, runId: string): WorkflowRunRecord | null {
  if (!safeId(workflowId)) return null;
  const p = join(WORKFLOWS_ROOT, workflowId, "runs", `${runId}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as WorkflowRunRecord;
  } catch {
    return null;
  }
}
