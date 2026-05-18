/**
 * /api/lokyy/workflows — FE-facing CRUD + run-trigger for workflows.
 *
 * All mutations proxy to lokyy-mcp's lokyy.workflows.* tools with the
 * System bearer. The browser never sees the bearer; lokyy-os-be is the
 * trust-bridge (same pattern as /api/lokyy/dashboards).
 */
import { Hono } from "hono";

const MCP_URL = process.env.LOKYY_MCP_URL ?? "http://lokyy-mcp:7878";
const SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

function ensureSecret(): void {
  if (!SYSTEM_SECRET) {
    throw new Error(
      "LOKYY_SYSTEM_SECRET not configured on lokyy-os-be — workflow calls cannot proceed"
    );
  }
}

async function callMcp<T>(tool: string, args: unknown): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  ensureSecret();
  const r = await fetch(`${MCP_URL}/tools/${encodeURIComponent(tool)}/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SYSTEM_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return (await r.json()) as { ok: true; result: T } | { ok: false; error: string };
}

export const workflows = new Hono();

workflows.get("/", async (c) => {
  const r = await callMcp("lokyy.workflows.list", {});
  if (!r.ok) return c.json({ error: r.error }, 502);
  return c.json(r.result);
});

workflows.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const r = await callMcp<{ workflowId: string }>("lokyy.workflows.create", body);
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json(r.result, 201);
});

workflows.get("/:id", async (c) => {
  const id = c.req.param("id");
  const r = await callMcp("lokyy.workflows.get", { workflowId: id });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});

workflows.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { spec?: unknown };
  const r = await callMcp("lokyy.workflows.update", { workflowId: id, spec: body.spec });
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json(r.result);
});

workflows.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const r = await callMcp("lokyy.workflows.delete", { workflowId: id });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});

workflows.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { input?: unknown };
  const r = await callMcp("lokyy.workflows.run_now", {
    workflowId: id,
    input: body.input,
  });
  if (!r.ok) return c.json({ error: r.error }, 502);
  return c.json(r.result);
});

workflows.get("/:id/runs", async (c) => {
  const id = c.req.param("id");
  const r = await callMcp("lokyy.workflows.list_runs", { workflowId: id });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});

workflows.get("/:id/runs/:runId", async (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  const r = await callMcp("lokyy.workflows.get_run", {
    workflowId: id,
    runId,
  });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});
