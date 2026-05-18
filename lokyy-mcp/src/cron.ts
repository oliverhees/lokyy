/**
 * In-process cron scheduler for Dashboards + Workflows.
 *
 * - Dashboards: producer.json.schedule → fires lokyy.dashboards.run_now
 * - Workflows: spec.json.triggers[].cron → fires lokyy.workflows.run_now
 *
 * Single setInterval tick reloads both job lists every minute and fires
 * any that match the current (minute, hour, dom, month, dow). Dedup
 * window prevents accidental double-fire on jitter.
 *
 * Why in-process: see ADR-007/ADR-009. Avoids docker-exec/shared-volume
 * coupling that an external scheduler would need.
 *
 * Format: 5-field POSIX cron (minute hour dom month dow). Supports *,
 * literals, comma-lists, dash-ranges, and step expressions like (asterisk)/5.
 * Does not support @yearly / @daily aliases.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { invokeTool } from "./tool-registry.ts";

const DASHBOARDS_ROOT =
  process.env.LOKYY_DASHBOARDS_ROOT ?? "/app/data/dashboards";
const WORKFLOWS_ROOT =
  process.env.LOKYY_WORKFLOWS_ROOT ?? "/app/data/workflows";
const TICK_INTERVAL_MS = 60_000;
const DEDUP_WINDOW_MS = 50_000;

type Job = {
  kind: "dashboard" | "workflow";
  /** ID of the dashboard or workflow. */
  targetId: string;
  schedule: string;
  lastFiredAt: number;
};

let jobs: Job[] = [];

function jobKey(j: Pick<Job, "kind" | "targetId">): string {
  return `${j.kind}:${j.targetId}`;
}

function loadJobs(): void {
  const seen = new Map(jobs.map((j) => [jobKey(j), j.lastFiredAt]));
  jobs = [];

  // Dashboards
  if (existsSync(DASHBOARDS_ROOT)) {
    for (const entry of readdirSync(DASHBOARDS_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(DASHBOARDS_ROOT, entry.name, "producer.json");
      if (!existsSync(path)) continue;
      try {
        const p = JSON.parse(readFileSync(path, "utf8")) as { schedule?: string };
        if (p.schedule && isPlausibleCron(p.schedule)) {
          const j: Job = {
            kind: "dashboard",
            targetId: entry.name,
            schedule: p.schedule,
            lastFiredAt: seen.get(`dashboard:${entry.name}`) ?? 0,
          };
          jobs.push(j);
        }
      } catch {
        // skip corrupt
      }
    }
  }

  // Workflows — any trigger of type 'cron' contributes one job (a workflow
  // can have multiple cron triggers, e.g. weekday morning + Sunday noon).
  if (existsSync(WORKFLOWS_ROOT)) {
    for (const entry of readdirSync(WORKFLOWS_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(WORKFLOWS_ROOT, entry.name, "spec.json");
      if (!existsSync(path)) continue;
      try {
        const s = JSON.parse(readFileSync(path, "utf8")) as {
          triggers?: Array<{ type?: string; schedule?: string }>;
        };
        for (const t of s.triggers ?? []) {
          if (t.type === "cron" && t.schedule && isPlausibleCron(t.schedule)) {
            const j: Job = {
              kind: "workflow",
              targetId: entry.name,
              schedule: t.schedule,
              lastFiredAt: seen.get(`workflow:${entry.name}`) ?? 0,
            };
            jobs.push(j);
          }
        }
      } catch {
        // skip corrupt
      }
    }
  }
}

function isPlausibleCron(s: string): boolean {
  const fields = s.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => /^[\d*/,-]+$/.test(f));
}

function cronMatches(expr: string, now: Date): boolean {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/) as [
    string, string, string, string, string,
  ];
  return (
    fieldMatches(min, now.getMinutes()) &&
    fieldMatches(hour, now.getHours()) &&
    fieldMatches(dom, now.getDate()) &&
    fieldMatches(mon, now.getMonth() + 1) &&
    fieldMatches(dow, now.getDay())
  );
}

function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.includes(",")) {
    return field.split(",").some((part) => fieldMatches(part, value));
  }
  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr ?? "1", 10);
    if (!step) return false;
    if (range === "*") return value % step === 0;
    if (range && range.includes("-")) {
      const [lo, hi] = range.split("-").map((s) => parseInt(s, 10));
      if (lo === undefined || hi === undefined) return false;
      return value >= lo && value <= hi && (value - lo) % step === 0;
    }
    return false;
  }
  if (field.includes("-")) {
    const [lo, hi] = field.split("-").map((s) => parseInt(s, 10));
    if (lo === undefined || hi === undefined) return false;
    return value >= lo && value <= hi;
  }
  return parseInt(field, 10) === value;
}

async function tick(): Promise<void> {
  loadJobs();
  const now = new Date();
  for (const job of jobs) {
    if (!cronMatches(job.schedule, now)) continue;
    if (Date.now() - job.lastFiredAt < DEDUP_WINDOW_MS) continue;
    job.lastFiredAt = Date.now();
    const tool =
      job.kind === "dashboard"
        ? "lokyy.dashboards.run_now"
        : "lokyy.workflows.run_now";
    const args =
      job.kind === "dashboard"
        ? { dashboardId: job.targetId }
        : { workflowId: job.targetId };
    console.log(
      `[cron] fire ${job.kind}=${job.targetId} schedule="${job.schedule}" at=${now.toISOString()}`
    );
    try {
      await invokeTool(tool, args, { kind: "system", label: "system" });
    } catch (err) {
      console.error(
        `[cron] ${job.kind}=${job.targetId} ${tool} failed:`,
        (err as Error).message
      );
    }
  }
}

export function startCron(): void {
  loadJobs();
  const lines = jobs.map(
    (j) => `${j.kind}:${j.targetId} (${j.schedule})`
  );
  console.log(
    `[cron] started · tick=${TICK_INTERVAL_MS / 1000}s · ${jobs.length} job(s) scheduled` +
      (lines.length > 0 ? "\n         " + lines.join("\n         ") : "")
  );
  setInterval(tick, TICK_INTERVAL_MS);
}

/** Exposed for ops + verify scripts. */
export function currentJobs(): Array<{
  kind: "dashboard" | "workflow";
  targetId: string;
  schedule: string;
  lastFiredAt: number | null;
  /** Backwards-compat alias for the dashboard-only earlier API. */
  dashboardId?: string;
}> {
  return jobs.map((j) => ({
    kind: j.kind,
    targetId: j.targetId,
    schedule: j.schedule,
    lastFiredAt: j.lastFiredAt || null,
    // Keep the old field for any existing caller that only knew dashboards.
    dashboardId: j.kind === "dashboard" ? j.targetId : undefined,
  }));
}
