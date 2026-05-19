/**
 * Reminders router — sqlite-backed CRUD for one-shot reminders on
 * /api/lokyy/reminders. Issue #154.
 *
 * FE-Shape (lokyy-app/src/lib/lokyy-reminders.ts):
 *   Reminder = { id, text, scheduledAt, channel, status, createdAt,
 *                firedAt?, deliveryError?, origin }
 *
 * Endpoints:
 *   GET    /                    → { reminders: Reminder[] }   (newest first)
 *   POST   /                    → 201 { reminder }            | 400 { error }
 *   PATCH  /:id                 → 200 { reminder }            | 404 { error }
 *   DELETE /:id                 → 200 { ok }                  | 404 { error }
 *   POST   /agent/create        → 201 { reminder }            (origin='agent', skill-callable)
 *   GET    /pending-deliveries  → { reminders: Reminder[] }   (status='fired' & channel='in-app' & not dismissed)
 *
 * The scheduler-tick (src/scheduler/job-runner.ts) fires reminders by
 * flipping status pending→fired and stamping firedAt; the FE polls
 * /pending-deliveries to show toast/list-items the user hasn't
 * dismissed yet.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import {
  lokyyDb,
  type LokyyReminderRow,
  type ReminderChannel,
} from "../db/lokyy-db.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

// Separate router that does NOT require human auth — used by the Hermes
// agent-skill via internal lokyy-net. Guarded by LOKYY_SYSTEM_SECRET.
const requireSystemBearer: MiddlewareHandler = async (c, next) => {
  const expected = process.env.LOKYY_SYSTEM_SECRET ?? "";
  const got = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || got !== expected) {
    return c.json({ error: "system-bearer required" }, 401);
  }
  await next();
};

// Top-level router. The /agent/* subtree is mounted FIRST so its
// system-bearer middleware shadows the user-session middleware that
// covers everything else. (Hono matches routes in registration order;
// a wildcard middleware on '/' would otherwise catch /agent/* too.)
export const reminders = new Hono();

const VALID_CHANNELS: ReminderChannel[] = ["in-app", "telegram", "email", "calendar"];

type Reminder = {
  id: string;
  text: string;
  scheduledAt: string; // ISO
  channel: ReminderChannel;
  status: "pending" | "fired" | "dismissed" | "failed";
  createdAt: string; // ISO
  firedAt?: string;
  deliveryError?: string;
  origin: "user" | "agent";
};

function rowToReminder(r: LokyyReminderRow): Reminder {
  return {
    id: r.id,
    text: r.text,
    scheduledAt: new Date(r.scheduledAt).toISOString(),
    channel: r.channel,
    status: r.status,
    createdAt: new Date(r.createdAt).toISOString(),
    firedAt: r.firedAt ? new Date(r.firedAt).toISOString() : undefined,
    deliveryError: r.deliveryError ?? undefined,
    origin: r.origin,
  };
}

function parseScheduledAt(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return null;
  return t;
}

function normalizeChannel(input: unknown): ReminderChannel {
  if (typeof input === "string" && (VALID_CHANNELS as string[]).includes(input)) {
    return input as ReminderChannel;
  }
  return "in-app";
}

function insertReminder(
  text: string,
  scheduledAt: number,
  channel: ReminderChannel,
  origin: "user" | "agent",
): Reminder {
  const id = `rem_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  lokyyDb
    .query(
      `INSERT INTO lokyy_reminder
         (id, text, scheduledAt, channel, status, createdAt, firedAt, deliveryError, origin)
       VALUES (?, ?, ?, ?, 'pending', ?, NULL, NULL, ?)`,
    )
    .run(id, text, scheduledAt, channel, now, origin);
  const row = lokyyDb
    .query<LokyyReminderRow, [string]>(
      "SELECT * FROM lokyy_reminder WHERE id = ?",
    )
    .get(id);
  if (!row) throw new Error("insert failed");
  return rowToReminder(row);
}

// ── System-auth routes (must be registered FIRST so they shadow the
// wildcard-middleware on the human router below) ──────────────────────────
const agent = new Hono();
agent.use("*", requireSystemBearer);

agent.post("/create", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    text?: unknown;
    scheduledAt?: unknown;
    channel?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return c.json({ error: "text is required" }, 400);
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  if (scheduledAt === null) {
    return c.json({ error: "scheduledAt (ISO timestamp) is required" }, 400);
  }
  const channel = normalizeChannel(body.channel);
  return c.json(
    { reminder: insertReminder(text, scheduledAt, channel, "agent") },
    201,
  );
});

reminders.route("/agent", agent);

// ── Human-auth routes ──────────────────────────────────────────────────────
const human = new Hono();
human.use("*", requireAuth);

human.get("/", (c) => {
  const rows = lokyyDb
    .query<LokyyReminderRow, []>(
      "SELECT * FROM lokyy_reminder ORDER BY scheduledAt ASC",
    )
    .all();
  return c.json({ reminders: rows.map(rowToReminder) });
});

human.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    text?: unknown;
    scheduledAt?: unknown;
    channel?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return c.json({ error: "text is required" }, 400);
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  if (scheduledAt === null) {
    return c.json({ error: "scheduledAt (ISO timestamp) is required" }, 400);
  }
  const channel = normalizeChannel(body.channel);
  return c.json({ reminder: insertReminder(text, scheduledAt, channel, "user") }, 201);
});

human.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = lokyyDb
    .query<LokyyReminderRow, [string]>("SELECT * FROM lokyy_reminder WHERE id = ?")
    .get(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const patch = (await c.req.json().catch(() => ({}))) as {
    text?: unknown;
    scheduledAt?: unknown;
    channel?: unknown;
    status?: unknown;
  };
  const nextText =
    typeof patch.text === "string" && patch.text.trim().length > 0
      ? patch.text.trim()
      : existing.text;
  const nextScheduled =
    patch.scheduledAt !== undefined
      ? parseScheduledAt(patch.scheduledAt) ?? existing.scheduledAt
      : existing.scheduledAt;
  const nextChannel =
    patch.channel !== undefined ? normalizeChannel(patch.channel) : existing.channel;
  // The user can only flip status between pending and dismissed; the
  // scheduler owns the pending→fired transition.
  const nextStatus =
    patch.status === "dismissed" || patch.status === "pending"
      ? patch.status
      : existing.status;
  lokyyDb
    .query(
      `UPDATE lokyy_reminder SET text = ?, scheduledAt = ?, channel = ?, status = ?
       WHERE id = ?`,
    )
    .run(nextText, nextScheduled, nextChannel, nextStatus, id);
  const row = lokyyDb
    .query<LokyyReminderRow, [string]>("SELECT * FROM lokyy_reminder WHERE id = ?")
    .get(id);
  return c.json({ reminder: rowToReminder(row!) });
});

human.delete("/:id", (c) => {
  const id = c.req.param("id");
  const result = lokyyDb.query("DELETE FROM lokyy_reminder WHERE id = ?").run(id);
  const changes = (result as { changes: number }).changes;
  if (changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

// Returns reminders that have FIRED but not yet been dismissed/acknowledged
// by the user. The FE dashboard polls this and shows toast / banner.
human.get("/pending-deliveries", (c) => {
  const rows = lokyyDb
    .query<LokyyReminderRow, []>(
      `SELECT * FROM lokyy_reminder
       WHERE status = 'fired' AND channel = 'in-app'
       ORDER BY firedAt DESC LIMIT 50`,
    )
    .all();
  return c.json({ reminders: rows.map(rowToReminder) });
});

reminders.route("/", human);
