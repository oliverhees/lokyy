/**
 * job-runner.ts — In-process cron-runner für lokyy_job rows.
 *
 * Issue #141 (follow-up zu #135). Ticks alle SCHEDULER_TICK_MS (default 60s),
 * lädt status='active' Jobs aus der DB, matched ihren schedule gegen die
 * aktuelle Minute und feuert pro Treffer einen Hermes /v1/chat/completions
 * Call mit job.prompt. lastRun wird auf den Fire-Zeitpunkt gesetzt.
 *
 * Dedup-Fenster verhindert Double-Fire bei Tick-Jitter und kurz-Intervall-
 * Tests. Wenn HERMES_API_KEY nicht gesetzt ist (dev-box ohne Schlüssel),
 * loggen wir den prompt und markieren lastRun trotzdem — der Lauf gilt
 * als "executed" für audit-evidence, der Hermes-Call ist eben no-op.
 *
 * Manual-fire (POST /jobs/:id/run) ruft fireJob() direkt auf, ohne durch
 * den Tick zu müssen.
 */
import { lokyyDb, type LokyyJobRow } from "../db/lokyy-db.ts";
import { cronMatches, isPlausibleCron } from "./cron-match.ts";

const TICK_MS = Number.parseInt(process.env.SCHEDULER_TICK_MS ?? "60000", 10);
const DEDUP_MS = Math.min(TICK_MS, 60_000) - 1_000;
const HERMES_BASE_URL =
  process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? "";
const HERMES_MODEL = process.env.HERMES_CHAT_MODEL ?? "hermes-agent";

let started = false;
const recentFires = new Map<string, number>(); // jobId → lastFiredAt ms

export type FireResult = {
  ok: boolean;
  durationMs: number;
  error?: string;
  hermesContent?: string;
  hermesSkipped?: boolean;
};

export async function fireJob(job: LokyyJobRow): Promise<FireResult> {
  const t0 = Date.now();
  recentFires.set(job.id, t0);
  lokyyDb
    .query("UPDATE lokyy_job SET lastRun = ? WHERE id = ?")
    .run(t0, job.id);

  // No API key → degrade gracefully (still useful for the audit-test path
  // and for local dev boxes without provider credentials).
  if (!HERMES_API_KEY) {
    console.log(`[scheduler] fire ${job.id} "${job.name}" — Hermes skipped (no key)`);
    return { ok: true, durationMs: Date.now() - t0, hermesSkipped: true };
  }

  try {
    const r = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HERMES_API_KEY}`,
      },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages: [{ role: "user", content: job.prompt }],
        stream: false,
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return {
        ok: false,
        durationMs: Date.now() - t0,
        error: `HTTP ${r.status} ${txt.slice(0, 200)}`,
      };
    }
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log(
      `[scheduler] fire ${job.id} "${job.name}" → ok (${Date.now() - t0}ms)`,
    );
    return { ok: true, durationMs: Date.now() - t0, hermesContent: content };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - t0,
      error: (err as Error).message,
    };
  }
}

function loadActiveJobs(): LokyyJobRow[] {
  return lokyyDb
    .query<LokyyJobRow, []>(
      "SELECT id, name, schedule, prompt, status, createdAt, lastRun, nextRun FROM lokyy_job WHERE status = 'active'",
    )
    .all();
}

async function tick(): Promise<void> {
  const now = new Date();
  const nowMs = Date.now();
  const jobs = loadActiveJobs();
  for (const job of jobs) {
    if (!isPlausibleCron(job.schedule)) continue;
    if (!cronMatches(job.schedule, now)) continue;
    const last = recentFires.get(job.id) ?? 0;
    if (nowMs - last < DEDUP_MS) continue;
    await fireJob(job);
  }
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  console.log(`[scheduler] started · tick=${TICK_MS / 1000}s`);
  // Fire-and-forget. Errors inside tick() are caught per-job in fireJob().
  setInterval(() => {
    void tick();
  }, TICK_MS);
}

/** Used by POST /jobs/:id/run for on-demand fires. */
export function getJobById(id: string): LokyyJobRow | null {
  return (
    lokyyDb
      .query<LokyyJobRow, [string]>(
        "SELECT id, name, schedule, prompt, status, createdAt, lastRun, nextRun FROM lokyy_job WHERE id = ?",
      )
      .get(id) ?? null
  );
}
