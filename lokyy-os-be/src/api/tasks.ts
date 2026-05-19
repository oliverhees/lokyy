/**
 * Tasks (Kanban) router — proxies the lokyy-app frontend's
 * `/api/lokyy/tasks` calls to the hermes-dashboard kanban plugin.
 *
 * Background — see GitHub Issue #113
 * --------------------------------
 * The `/tasks` route used to show
 *   "Hermes-Kanban nicht initialisiert. Init via `hermes kanban init`."
 *
 * That was a stale Phase-1d stub. The hermes-dashboard's kanban plugin
 * is in fact already initialized (kanban.db lives on the
 * `lokyy-hermes-data` Docker volume at `/opt/data/kanban.db` and is
 * created the first time the dashboard boots). No `hermes kanban init`
 * call is needed; the FE just had nothing real to render.
 *
 * Endpoints used upstream (hermes-dashboard, port 9119):
 *   GET  /api/plugins/kanban/board  → returns {columns[{name,tasks[]}], ...}
 *   POST /api/plugins/kanban/tasks  → create a new task
 *
 * Auth: every dashFetch call carries a per-process session bearer token
 * scraped from the dashboard's index HTML — see hermes-dashboard-client.ts.
 *
 * Status mapping — the kanban plugin exposes 6 lifecycle statuses
 * (triage, todo, ready, running, blocked, done). The lokyy-app FE only
 * renders 4 columns (todo, claimed, blocked, done). We project here:
 *   triage, todo            → todo
 *   ready, running          → claimed   (i.e. "In Progress")
 *   blocked                 → blocked
 *   done                    → done
 *
 * If the FE adds dedicated triage/ready/running columns later we drop the
 * projection and surface the upstream status verbatim.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";
import { dashGet, dashPost } from "./hermes-dashboard-client.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  await next();
};

export const tasks = new Hono();
tasks.use("*", requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Upstream payload shape (subset we read)
// ─────────────────────────────────────────────────────────────────────────────

type HermesKanbanTask = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  priority: number;
  assignee: string | null;
  created_by: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  workspace_kind: string | null;
  workspace_path: string | null;
};

type HermesKanbanBoard = {
  columns: Array<{ name: string; tasks: HermesKanbanTask[] }>;
  latest_event_id?: number;
  now?: number;
};

// Shape returned to lokyy-app (matches lokyy-kanban.ts `KanbanTask` /
// `KanbanResponse`).
type LokyyTask = {
  id: string;
  title: string;
  body: string;
  status: string; // mapped — see UPSTREAM_TO_FE_STATUS
  priority: number;
  assignee: string | null;
  createdBy: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  workspaceKind: string | null;
  workspacePath: string | null;
};

const UPSTREAM_TO_FE_STATUS: Record<string, string> = {
  triage: "todo",
  todo: "todo",
  ready: "claimed",
  running: "claimed",
  blocked: "blocked",
  done: "done",
};

function mapTask(t: HermesKanbanTask): LokyyTask {
  return {
    id: t.id,
    title: t.title,
    body: t.body ?? "",
    status: UPSTREAM_TO_FE_STATUS[t.status] ?? t.status,
    priority: t.priority,
    assignee: t.assignee,
    createdBy: t.created_by,
    createdAt: t.created_at,
    startedAt: t.started_at,
    completedAt: t.completed_at,
    workspaceKind: t.workspace_kind,
    workspacePath: t.workspace_path,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET / — list tasks for the active board
// ─────────────────────────────────────────────────────────────────────────────

tasks.get("/", async (c) => {
  try {
    const board = await dashGet<HermesKanbanBoard>("/api/plugins/kanban/board");
    const flat: LokyyTask[] = [];
    const statusSet = new Set<string>();
    for (const col of board.columns ?? []) {
      for (const t of col.tasks ?? []) {
        flat.push(mapTask(t));
        statusSet.add(t.status);
      }
    }
    return c.json({
      available: true,
      tasks: flat,
      statuses: [...statusSet],
    });
  } catch (err) {
    // Dashboard unreachable / kanban plugin missing — surface a real error
    // to the FE so it can render an outage card (NOT the "init via CLI"
    // fiction that lived in the old stub).
    return c.json({
      available: false,
      tasks: [],
      statuses: [],
      error: (err as Error).message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST / — create a task on the active board
// Accepts { title, body?, priority?, status? } from the FE.
// Forwards to hermes-dashboard which writes via the shared kanban_db code
// path used by the CLI and gateway, so the three surfaces stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

tasks.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: unknown;
    body?: unknown;
    priority?: unknown;
    status?: unknown;
  };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return c.json({ error: "title is required" }, 400);
  }
  const taskBody = typeof body.body === "string" ? body.body : "";
  const priority =
    typeof body.priority === "number" && Number.isFinite(body.priority)
      ? Math.max(0, Math.min(100, Math.floor(body.priority)))
      : 5;
  const requestedStatus =
    typeof body.status === "string" && body.status ? body.status : "todo";

  try {
    const created = await dashPost<{ task: HermesKanbanTask }>(
      "/api/plugins/kanban/tasks",
      {
        title,
        body: taskBody,
        priority,
        status: requestedStatus,
      }
    );
    return c.json({ task: mapTask(created.task) }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});
