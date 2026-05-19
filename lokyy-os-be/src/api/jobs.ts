/**
 * Jobs router — sqlite-backed CRUD für scheduled jobs auf
 * /api/lokyy/jobs.
 *
 * Issue #135. Erste Slice: Persistenz pur. Cron-runner (Phase-5.3
 * `lokyy-mcp/src/cron.ts` erweitern um kind='job') ist eigene Story
 * — neu erzeugte Jobs starten daher als status='paused', bis die
 * Anbindung kommt.
 *
 * Response-Shape (matches FE in lokyy-app/src/routes/_authed/jobs.tsx):
 *   GET  /api/lokyy/jobs       -> { jobs: Job[] }
 *   POST /api/lokyy/jobs       -> { ok: true, job }       (or 400 { error })
 *   DELETE /api/lokyy/jobs/:id -> { ok: true }            (or 404 { error })
 *
 * Field mapping:
 *   FE.command  ←→  DB.prompt   (the FE calls it "command" but it's
 *                                 actually a free-text prompt that the
 *                                 future cron-runner will send to Hermes).
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import { lokyyDb, type LokyyJobRow } from "../db/lokyy-db.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

export const jobs = new Hono();
jobs.use("*", requireAuth);

type Job = {
  id: string;
  name: string;
  schedule: string;
  command: string;
  status: "active" | "paused" | "unknown";
  lastRun?: string;
  nextRun?: string;
};

function rowToJob(r: LokyyJobRow): Job {
  return {
    id: r.id,
    name: r.name,
    schedule: r.schedule,
    command: r.prompt,
    status: r.status,
    lastRun: r.lastRun ? new Date(r.lastRun).toISOString() : undefined,
    nextRun: r.nextRun ? new Date(r.nextRun).toISOString() : undefined,
  };
}

jobs.get("/", (c) => {
  const rows = lokyyDb
    .query<LokyyJobRow, []>(
      "SELECT id, name, schedule, prompt, status, createdAt, lastRun, nextRun FROM lokyy_job ORDER BY createdAt DESC",
    )
    .all();
  return c.json({ jobs: rows.map(rowToJob) });
});

jobs.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    schedule?: unknown;
    prompt?: unknown;
  };

  const schedule = typeof body.schedule === "string" ? body.schedule.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : prompt.slice(0, 40) || "Unbenannter Job";

  if (!schedule) return c.json({ ok: false, error: "schedule is required" }, 400);
  if (!prompt) return c.json({ ok: false, error: "prompt is required" }, 400);

  const id = `job_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  lokyyDb
    .query(
      `INSERT INTO lokyy_job (id, name, schedule, prompt, status, createdAt, lastRun, nextRun)
       VALUES (?, ?, ?, ?, 'paused', ?, NULL, NULL)`,
    )
    .run(id, name, schedule, prompt, now);

  const row = lokyyDb
    .query<LokyyJobRow, [string]>(
      "SELECT id, name, schedule, prompt, status, createdAt, lastRun, nextRun FROM lokyy_job WHERE id = ?",
    )
    .get(id);
  if (!row) {
    return c.json({ ok: false, error: "insert failed" }, 500);
  }
  return c.json({ ok: true, job: rowToJob(row) }, 201);
});

jobs.delete("/:id", (c) => {
  const id = c.req.param("id");
  const result = lokyyDb.query("DELETE FROM lokyy_job WHERE id = ?").run(id);
  // Bun:sqlite Statement.run() returns { changes, lastInsertRowid }
  const changes = (result as { changes: number }).changes;
  if (changes === 0) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  return c.json({ ok: true });
});
