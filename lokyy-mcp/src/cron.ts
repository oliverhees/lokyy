/**
 * In-process cron scheduler — fires `lokyy.dashboards.run_now` whenever
 * a dashboard's cron expression matches the current minute (ISC-91 full).
 *
 * Design rationale: rather than register each Producer with Hermes-cron
 * (which would require shared volume mounts, per-dashboard shell scripts,
 * cleanup on delete, etc.), we run a single-tick-per-minute loop here.
 * Same outcome, far less moving parts, and no docker-exec coupling
 * between lokyy-mcp and the hermes container.
 *
 * If the user wants to surface jobs in `hermes cron list` later, a future
 * slice can swap this for the Hermes-bridge — the run_now tool surface
 * stays the same.
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
const TICK_INTERVAL_MS = 60_000;
const DEDUP_WINDOW_MS = 50_000; // a job fires at most once per minute

type Job = {
  dashboardId: string;
  schedule: string;
  lastFiredAt: number;
};

let jobs: Job[] = [];

function loadJobs(): void {
  const seen = new Map(jobs.map((j) => [j.dashboardId, j.lastFiredAt]));
  jobs = [];
  if (!existsSync(DASHBOARDS_ROOT)) return;
  for (const id of readdirSync(DASHBOARDS_ROOT, { withFileTypes: true })) {
    if (!id.isDirectory()) continue;
    const producerPath = join(DASHBOARDS_ROOT, id.name, "producer.json");
    if (!existsSync(producerPath)) continue;
    try {
      const p = JSON.parse(readFileSync(producerPath, "utf8")) as {
        schedule?: string;
      };
      if (p.schedule && isPlausibleCron(p.schedule)) {
        jobs.push({
          dashboardId: id.name,
          schedule: p.schedule,
          // Keep previous lastFiredAt across reloads so a schedule change
          // doesn't re-fire within the dedup window.
          lastFiredAt: seen.get(id.name) ?? 0,
        });
      }
    } catch {
      // skip corrupt producer.json
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
    console.log(
      `[cron] fire dashboard=${job.dashboardId} schedule="${job.schedule}" at=${now.toISOString()}`
    );
    try {
      await invokeTool(
        "lokyy.dashboards.run_now",
        { dashboardId: job.dashboardId },
        { kind: "system", label: "system" }
      );
    } catch (err) {
      console.error(
        `[cron] dashboard=${job.dashboardId} run_now failed:`,
        (err as Error).message
      );
    }
  }
}

export function startCron(): void {
  loadJobs();
  console.log(
    `[cron] started · tick=${TICK_INTERVAL_MS / 1000}s · ${jobs.length} job(s) scheduled` +
      (jobs.length
        ? "\n         " +
          jobs.map((j) => `${j.dashboardId} (${j.schedule})`).join("\n         ")
        : "")
  );
  // First tick after one full minute — avoids firing immediately on startup.
  setInterval(tick, TICK_INTERVAL_MS);
}

// Exposed for verify scripts: list current jobs (no auth — same surface
// already protected by the bearer that gates everything else).
export function currentJobs(): Array<{
  dashboardId: string;
  schedule: string;
  lastFiredAt: number | null;
}> {
  return jobs.map((j) => ({
    dashboardId: j.dashboardId,
    schedule: j.schedule,
    lastFiredAt: j.lastFiredAt || null,
  }));
}
