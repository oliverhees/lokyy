/**
 * Lokyy chat-conversations API.
 *
 * Hermes has no conversation/thread REST surface — `/api/conversations`
 * on the dashboard returns the SPA HTML, and Hermes sessions track
 * tool-call/agent state, not user-facing chat threads. So conversation
 * persistence sits in the Lokyy layer.
 *
 * Storage: JSON file under /app/data (mounted on the lokyy-os-db volume,
 * survives container restarts). Phase-3 swaps this for a lokyy-brain
 * backed store — interface stays the same.
 *
 * Endpoints (all under /api/lokyy/conversations, auth-guarded):
 *   GET    /                     → { conversations: [] }      (newest first)
 *   POST   /                     → { conversation }
 *   GET    /:id                  → { id, title, messages, … }
 *   PUT    /:id                  → { conversation }            (partial patch)
 *   DELETE /:id                  → { ok: true }
 *   POST   /:id/append           → { conversation }            (append a message)
 *
 * Frontend contract: matches src/lib/lokyy-conversations.ts in lokyy-app.
 */
import { Hono } from "hono";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type ConvMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  at: string;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  agentId: string | null;
  messages: ConvMessage[];
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH =
  process.env.LOKYY_CONVERSATIONS_FILE ?? "/app/data/conversations.json";

function ensureDir() {
  const dir = dirname(resolve(STORE_PATH));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readStore(): { conversations: Conversation[] } {
  if (!existsSync(STORE_PATH)) return { conversations: [] };
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { conversations: [] };
  }
}

function writeStore(store: { conversations: Conversation[] }) {
  ensureDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export const conversations = new Hono();

conversations.get("/", (c) => {
  const list = readStore().conversations.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );
  return c.json({ conversations: list });
});

conversations.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    model?: string;
    agentId?: string | null;
  };
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: randomUUID(),
    title: body.title?.trim() || "Neuer Chat",
    model: body.model ?? "hermes-agent",
    agentId: body.agentId ?? null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const store = readStore();
  store.conversations.push(conv);
  writeStore(store);
  return c.json({ conversation: conv }, 201);
});

conversations.get("/:id", (c) => {
  const conv = readStore().conversations.find((x) => x.id === c.req.param("id"));
  if (!conv) return c.json({ error: "not_found" }, 404);
  return c.json(conv);
});

conversations.put("/:id", async (c) => {
  const patch = (await c.req.json().catch(() => ({}))) as Partial<
    Pick<Conversation, "title" | "messages" | "model" | "agentId">
  >;
  const store = readStore();
  const idx = store.conversations.findIndex((x) => x.id === c.req.param("id"));
  if (idx < 0) return c.json({ error: "not_found" }, 404);
  const next: Conversation = {
    ...store.conversations[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.conversations[idx] = next;
  writeStore(store);
  return c.json({ conversation: next });
});

conversations.delete("/:id", (c) => {
  const store = readStore();
  const before = store.conversations.length;
  store.conversations = store.conversations.filter(
    (x) => x.id !== c.req.param("id")
  );
  if (store.conversations.length === before)
    return c.json({ error: "not_found" }, 404);
  writeStore(store);
  return c.json({ ok: true });
});

conversations.post("/:id/append", async (c) => {
  const msg = (await c.req.json()) as ConvMessage;
  const store = readStore();
  const idx = store.conversations.findIndex((x) => x.id === c.req.param("id"));
  if (idx < 0) return c.json({ conversation: null, error: "not_found" }, 404);
  store.conversations[idx]!.messages.push(msg);
  store.conversations[idx]!.updatedAt = new Date().toISOString();
  if (
    store.conversations[idx]!.title === "Neuer Chat" &&
    msg.role === "user"
  ) {
    store.conversations[idx]!.title = msg.content.slice(0, 60);
  }
  writeStore(store);
  return c.json({ conversation: store.conversations[idx] });
});
