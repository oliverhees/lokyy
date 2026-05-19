/**
 * Teams router — sqlite-backed CRUD für Multi-Agent-Teams auf
 * /api/lokyy/teams. Issue #139 (audit-2026-05-19 P2 final slice).
 *
 * FE-Shape (lokyy-app/src/lib/lokyy-teams.ts):
 *   Team = { id, name, description, memberAgentIds: string[], createdAt, updatedAt }
 *   GET    /              → { teams: Team[] }
 *   POST   /              → 201 { team } | 400 { error }
 *   PATCH  /:id           → 200 { team } | 404 { error }
 *   DELETE /:id           → 200 { ok }   | 404 { error }
 *
 * memberAgentIds lebt als JSON-Array-String in der DB. Wir validieren
 * die ids NICHT gegen /agents — agent-ids kommen heute aus Hermes-
 * Profilen und wechseln je nach Deployment; ein Team mit veralteten
 * ids ist eine soft inconsistency, nicht ein hard error.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import { lokyyDb, type LokyyTeamRow } from "../db/lokyy-db.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

export const teams = new Hono();
teams.use("*", requireAuth);

type Team = {
  id: string;
  name: string;
  description: string;
  memberAgentIds: string[];
  createdAt: string;
  updatedAt: string;
};

function parseIds(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].slice(0, 64);
}

function rowToTeam(r: LokyyTeamRow): Team {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    memberAgentIds: parseIds(r.memberAgentIds),
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

teams.get("/", (c) => {
  const rows = lokyyDb
    .query<LokyyTeamRow, []>(
      "SELECT id, name, description, memberAgentIds, createdAt, updatedAt FROM lokyy_team ORDER BY updatedAt DESC",
    )
    .all();
  return c.json({ teams: rows.map(rowToTeam) });
});

teams.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    memberAgentIds?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const memberAgentIds = normalizeIds(body.memberAgentIds);

  const id = `team_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  lokyyDb
    .query(
      `INSERT INTO lokyy_team (id, name, description, memberAgentIds, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, name, description, JSON.stringify(memberAgentIds), now, now);

  const row = lokyyDb
    .query<LokyyTeamRow, [string]>(
      "SELECT id, name, description, memberAgentIds, createdAt, updatedAt FROM lokyy_team WHERE id = ?",
    )
    .get(id);
  if (!row) return c.json({ error: "insert failed" }, 500);
  return c.json({ team: rowToTeam(row) }, 201);
});

teams.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = lokyyDb
    .query<LokyyTeamRow, [string]>(
      "SELECT id, name, description, memberAgentIds, createdAt, updatedAt FROM lokyy_team WHERE id = ?",
    )
    .get(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const patch = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    memberAgentIds?: unknown;
  };
  const nextName =
    typeof patch.name === "string" && patch.name.trim().length > 0
      ? patch.name.trim()
      : existing.name;
  const nextDescription =
    typeof patch.description === "string"
      ? patch.description.trim()
      : existing.description;
  const nextIds =
    patch.memberAgentIds !== undefined
      ? normalizeIds(patch.memberAgentIds)
      : parseIds(existing.memberAgentIds);
  const now = Date.now();
  lokyyDb
    .query(
      `UPDATE lokyy_team SET name = ?, description = ?, memberAgentIds = ?, updatedAt = ? WHERE id = ?`,
    )
    .run(nextName, nextDescription, JSON.stringify(nextIds), now, id);

  const row = lokyyDb
    .query<LokyyTeamRow, [string]>(
      "SELECT id, name, description, memberAgentIds, createdAt, updatedAt FROM lokyy_team WHERE id = ?",
    )
    .get(id);
  return c.json({ team: rowToTeam(row!) });
});

teams.delete("/:id", (c) => {
  const id = c.req.param("id");
  const result = lokyyDb.query("DELETE FROM lokyy_team WHERE id = ?").run(id);
  const changes = (result as { changes: number }).changes;
  if (changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
