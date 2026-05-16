/**
 * Phase-1d API stubs for /api/lokyy/* endpoints.
 *
 * The lokyy-app frontend has 22 sidebar routes that fire `beforeLoad` or
 * mount-time fetches against these paths. Without stubs every route would
 * 404 → TanStack-Router error boundary or hard crashes.
 *
 * Stub philosophy:
 *   - GET endpoints return empty arrays / sensible default objects
 *   - POST / PUT endpoints accept the body, return 200 OK with the echoed
 *     resource, no persistence (intentional — real persistence lands in
 *     Phase-2 with Hermes and Phase-3 with lokyy-brain)
 *   - All endpoints are auth-guarded via the requireAuth middleware
 *
 * Future: replace each block with real logic backed by Hermes / lokyy-brain.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  c.set("userId" as never, session.user.id as never);
  await next();
};

export const lokyyStubs = new Hono();

lokyyStubs.use("*", requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Agents
// ─────────────────────────────────────────────────────────────────────────────

lokyyStubs.get("/agents", (c) =>
  c.json({
    agents: [],
    note: "Phase-1d stub. Real agent list arrives in Phase-2 with Hermes.",
  })
);

lokyyStubs.get("/agents/:agentId/skills", (c) =>
  c.json({ skills: [] })
);

lokyyStubs.get("/agents/:agentId/mcps", (c) =>
  c.json({ mcps: [], presets: [] })
);

lokyyStubs.post("/agents/:agentId/skills/:skillId/toggle", (c) =>
  c.json({ nowEnabled: true })
);

lokyyStubs.post("/agents/:agentId/mcps/:mcpId/toggle", (c) =>
  c.json({ nowEnabled: true })
);

// ─────────────────────────────────────────────────────────────────────────────
// Tasks / Jobs / Sessions
// ─────────────────────────────────────────────────────────────────────────────

lokyyStubs.get("/tasks", (c) =>
  c.json({ tasks: [], columns: ["todo", "in_progress", "done"] })
);

lokyyStubs.get("/jobs", (c) =>
  c.json({ jobs: [] })
);

lokyyStubs.post("/jobs", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({
    job: { id: crypto.randomUUID(), status: "queued", ...body },
    note: "stub — job not actually scheduled until Phase-2",
  }, 202);
});

lokyyStubs.get("/sessions", (c) =>
  c.json({ sessions: [] })
);

lokyyStubs.get("/conversations", (c) =>
  c.json({ conversations: [] })
);

lokyyStubs.get("/conversations/:id", (c) =>
  c.json({ id: c.req.param("id"), messages: [], title: "(stub)" })
);

// ─────────────────────────────────────────────────────────────────────────────
// Prompts / Teams / Workflows / Integrations
// ─────────────────────────────────────────────────────────────────────────────

lokyyStubs.get("/prompts", (c) =>
  c.json({ prompts: [] })
);

lokyyStubs.get("/teams", (c) =>
  c.json({ teams: [] })
);

lokyyStubs.get("/workflows", (c) =>
  c.json({ workflows: [] })
);

lokyyStubs.get("/integrations", (c) =>
  c.json({ integrations: [], available: [] })
);

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  general: {
    theme: "dark" as const,
    language: "de" as const,
  },
  notifications: {
    desktop: false,
    sounds: false,
  },
  phase: "Phase-1d",
};

lokyyStubs.get("/settings", (c) => c.json(DEFAULT_SETTINGS));

lokyyStubs.post("/settings", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ ...DEFAULT_SETTINGS, ...body, _saved: false, _note: "stub — settings echo back, not persisted yet" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vault — Phase-3 will route through lokyy-brain. Phase-1d returns empty.
// ─────────────────────────────────────────────────────────────────────────────

// Vault — matches VaultListResponse / VaultReadResponse shapes from lokyy-vault.ts
lokyyStubs.get("/vault", (c) => {
  const action = c.req.query("action");
  const path = c.req.query("path") ?? "";
  if (action === "read") {
    return c.json({
      configured: false,
      root: null,
      content: "",
      path,
    });
  }
  return c.json({
    configured: false,
    root: null,
    entries: [],
    path,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hermes-* — sub-routes used by `lokyy-hermes.ts` library on the FE.
// Each route reads a different facet of the Hermes runtime; until Hermes is
// deployed (Phase-2) we ship realistic empty/default responses so routes
// render cleanly instead of error-cards.
// ─────────────────────────────────────────────────────────────────────────────

const HERMES_NOT_RUNNING_RAW =
  "[lokyy] Hermes Agent is not deployed yet. This panel goes live in Phase-2 of the Lokyy roadmap.";

// Matches MemoryStatus shape in lokyy-hermes.ts:
//   { builtinActive, activeProvider, installedProviders[], raw }
lokyyStubs.get("/hermes-memory", (c) =>
  c.json({
    builtinActive: true,
    activeProvider: null,
    installedProviders: [],
    raw: HERMES_NOT_RUNNING_RAW,
  })
);

lokyyStubs.get("/hermes-channels", (c) =>
  c.json([])
);

lokyyStubs.get("/hermes-tools", (c) =>
  c.json({ tools: [], raw: HERMES_NOT_RUNNING_RAW })
);

lokyyStubs.get("/hermes-plugins", (c) =>
  c.json({ plugins: [], raw: HERMES_NOT_RUNNING_RAW })
);

lokyyStubs.get("/hermes-webhooks", (c) =>
  c.json({ enabled: false, webhooks: [], raw: HERMES_NOT_RUNNING_RAW })
);

// Matches InsightsData shape in lokyy-hermes.ts:
//   { raw, summary: { sessions?, messages?, toolCalls?, totalTokens?, activeTime? } }
lokyyStubs.get("/hermes-insights", (c) =>
  c.json({
    raw: HERMES_NOT_RUNNING_RAW,
    summary: {
      sessions: 0,
      messages: 0,
      toolCalls: 0,
      totalTokens: 0,
      activeTime: "0m",
    },
  })
);

lokyyStubs.get("/hermes-logs", (c) =>
  c.json({ raw: HERMES_NOT_RUNNING_RAW, ok: false, error: "Hermes not deployed (Phase-2)" })
);

lokyyStubs.get("/hermes-curator", (c) =>
  c.json({
    enabled: false,
    runs: 0,
    lastRun: "",
    lastSummary: "",
    interval: "",
    raw: HERMES_NOT_RUNNING_RAW,
  })
);

lokyyStubs.get("/hermes-doctor", (c) =>
  c.json({ raw: HERMES_NOT_RUNNING_RAW, ok: false })
);

lokyyStubs.get("/hermes-backup", (c) =>
  c.json({ ok: false, output: HERMES_NOT_RUNNING_RAW, path: null })
);
