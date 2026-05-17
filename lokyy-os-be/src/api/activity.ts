/**
 * Activity-log API — read-only surface for events the lokyy-supervisor
 * appends to /app/data/activity.jsonl.
 *
 * Why no POST: the only producer is lokyy-supervisor, which shares the
 * volume and appends directly to the JSONL file. POSIX append <PIPE_BUF
 * (4KB) is atomic, so there's no race with concurrent supervisor instances
 * either (single-replica container).
 *
 * Phase-3 may add POST for user-acknowledged events; not needed in 2b.
 */
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";

export type ActivityEvent = {
  at: string;
  kind:
    | "tick"
    | "hermes-down"
    | "hermes-restart"
    | "hermes-restart-failed"
    | "catch-up";
  service?: string;
  message?: string;
  ok?: boolean;
};

const LOG_PATH = process.env.LOKYY_ACTIVITY_LOG ?? "/app/data/activity.jsonl";
const MAX_RETURN = 500;

function readEvents(): ActivityEvent[] {
  if (!existsSync(LOG_PATH)) return [];
  const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
  // Keep parsing tolerant — a half-written line should not break the read
  const events: ActivityEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip malformed
    }
  }
  return events;
}

export const activity = new Hono();

activity.get("/", (c) => {
  const since = c.req.query("since");
  const sinceMs = since ? new Date(since).getTime() : 0;
  const all = readEvents();
  const filtered = sinceMs
    ? all.filter((e) => new Date(e.at).getTime() > sinceMs)
    : all;
  // Newest last in file → return newest last (chronological) or capped tail
  const tail = filtered.slice(-MAX_RETURN);
  return c.json({ events: tail, total: all.length });
});
