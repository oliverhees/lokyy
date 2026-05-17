/**
 * HTTP one-shot tool invocation surface — `POST /tools/:name/invoke`.
 *
 * Stateless alternative to the MCP-SSE path. Same registry, same
 * privilege checks (handled inside invokeTool by the per-tool
 * minPrincipal + each tool's own scope-check). Useful for:
 *
 *   - Verify scripts that can't easily speak MCP's initialize handshake
 *   - Producer-Skills running outside Hermes (e.g. cron job in a
 *     separate container, webhook caller) that want HTTP simplicity
 *
 * Bearer types accepted:
 *   - LOKYY_SYSTEM_SECRET (system principal)
 *   - Capability-<id>-<secret> (capability principal — scope+target
 *     checked by the called tool)
 *
 * Anything without a bearer or with an unknown one → 401.
 */
import { Hono } from "hono";
import { requireBearer, getPrincipal } from "./auth.ts";
import { invokeTool } from "./tool-registry.ts";

export const toolsHttp = new Hono();
toolsHttp.use("*", requireBearer);

toolsHttp.post("/:name/invoke", async (c) => {
  const principal = getPrincipal(c);
  if (!principal) return c.json({ error: "unauthenticated" }, 401);

  const name = c.req.param("name");
  const args = (await c.req.json().catch(() => ({}))) as unknown;
  try {
    const result = await invokeTool(name, args, principal);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 400);
  }
});
