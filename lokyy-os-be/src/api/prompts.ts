/**
 * Prompts router — sqlite-backed CRUD für die Prompt-Library auf
 * /api/lokyy/prompts. Issue #137 (audit-2026-05-19 P2).
 *
 * FE-Shape (lokyy-app/src/lib/lokyy-prompts.ts):
 *   Prompt = { id, title, body, tags: string[], createdAt, updatedAt }
 *   GET    /              → { prompts: Prompt[] }
 *   POST   /              → 201 { prompt } | 400 { error }
 *   PATCH  /:id           → 200 { prompt } | 404 { error }
 *   DELETE /:id           → 200 { ok }     | 404 { error }
 *
 * `tags` lebt als JSON-string in der DB — am API-Boundary serialisieren
 * wir hin und her. Kleine Liste, kein eigenes JOIN-Schema nötig.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import { lokyyDb, type LokyyPromptRow } from "../db/lokyy-db.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

export const prompts = new Hono();
prompts.use("*", requireAuth);

type Prompt = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

function parseTags(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 32);
}

function rowToPrompt(r: LokyyPromptRow): Prompt {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    tags: parseTags(r.tags),
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

prompts.get("/", (c) => {
  const rows = lokyyDb
    .query<LokyyPromptRow, []>(
      "SELECT id, title, body, tags, createdAt, updatedAt FROM lokyy_prompt ORDER BY updatedAt DESC",
    )
    .all();
  return c.json({ prompts: rows.map(rowToPrompt) });
});

prompts.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: unknown;
    body?: unknown;
    tags?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const promptBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!title) return c.json({ error: "title is required" }, 400);
  if (!promptBody) return c.json({ error: "body is required" }, 400);

  const id = `prompt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  const tags = normalizeTags(body.tags);
  lokyyDb
    .query(
      `INSERT INTO lokyy_prompt (id, title, body, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, title, promptBody, JSON.stringify(tags), now, now);

  const row = lokyyDb
    .query<LokyyPromptRow, [string]>(
      "SELECT id, title, body, tags, createdAt, updatedAt FROM lokyy_prompt WHERE id = ?",
    )
    .get(id);
  if (!row) return c.json({ error: "insert failed" }, 500);
  return c.json(rowToPrompt(row), 201);
});

prompts.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = lokyyDb
    .query<LokyyPromptRow, [string]>(
      "SELECT id, title, body, tags, createdAt, updatedAt FROM lokyy_prompt WHERE id = ?",
    )
    .get(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const patch = (await c.req.json().catch(() => ({}))) as {
    title?: unknown;
    body?: unknown;
    tags?: unknown;
  };
  const nextTitle =
    typeof patch.title === "string" && patch.title.trim().length > 0
      ? patch.title.trim()
      : existing.title;
  const nextBody =
    typeof patch.body === "string" && patch.body.trim().length > 0
      ? patch.body.trim()
      : existing.body;
  const nextTags =
    patch.tags !== undefined ? normalizeTags(patch.tags) : parseTags(existing.tags);
  const now = Date.now();
  lokyyDb
    .query(
      `UPDATE lokyy_prompt SET title = ?, body = ?, tags = ?, updatedAt = ? WHERE id = ?`,
    )
    .run(nextTitle, nextBody, JSON.stringify(nextTags), now, id);

  const row = lokyyDb
    .query<LokyyPromptRow, [string]>(
      "SELECT id, title, body, tags, createdAt, updatedAt FROM lokyy_prompt WHERE id = ?",
    )
    .get(id);
  return c.json(rowToPrompt(row!));
});

prompts.delete("/:id", (c) => {
  const id = c.req.param("id");
  const result = lokyyDb.query("DELETE FROM lokyy_prompt WHERE id = ?").run(id);
  const changes = (result as { changes: number }).changes;
  if (changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
