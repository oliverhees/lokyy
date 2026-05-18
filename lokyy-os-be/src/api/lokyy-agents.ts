/**
 * /api/lokyy/lokyy-agents — FE-facing CRUD for user-created Lokyy-Agents
 * (Phase-5.5). Distinct from the existing /api/lokyy/agents which
 * surfaces Hermes-Profiles read-only.
 *
 * Proxies to lokyy-mcp's lokyy.agents.* tools with the system bearer.
 */
import { Hono } from "hono";

const MCP_URL = process.env.LOKYY_MCP_URL ?? "http://lokyy-mcp:7878";
const SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

async function callMcp<T>(tool: string, args: unknown): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  if (!SYSTEM_SECRET) {
    return { ok: false, error: "LOKYY_SYSTEM_SECRET not configured" };
  }
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

export const lokyyAgents = new Hono();

lokyyAgents.get("/", async (c) => {
  const r = await callMcp("lokyy.agents.list", {});
  if (!r.ok) return c.json({ error: r.error }, 502);
  return c.json(r.result);
});

lokyyAgents.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: unknown };
  const r = await callMcp("lokyy.agents.create", { agent: body.agent });
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json(r.result, 201);
});

lokyyAgents.get("/:id", async (c) => {
  const r = await callMcp("lokyy.agents.get", { agentId: c.req.param("id") });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});

lokyyAgents.put("/:id", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: unknown };
  const r = await callMcp("lokyy.agents.update", {
    agentId: c.req.param("id"),
    agent: body.agent,
  });
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json(r.result);
});

lokyyAgents.delete("/:id", async (c) => {
  const r = await callMcp("lokyy.agents.delete", { agentId: c.req.param("id") });
  if (!r.ok) return c.json({ error: r.error }, 404);
  return c.json(r.result);
});
