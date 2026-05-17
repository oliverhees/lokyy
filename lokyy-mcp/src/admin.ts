/**
 * Admin surface — Capability-Token management for System Skills (and
 * for verify-scripts that need to mint test tokens). All routes require
 * the System bearer; Capability tokens themselves CANNOT issue or revoke
 * other capabilities.
 */
import { Hono } from "hono";
import { requireSystem } from "./auth.ts";
import {
  issueCapability,
  listCapabilities,
  revokeCapability,
  type CapabilityScope,
} from "./capabilities.ts";
import { invokeTool } from "./tool-registry.ts";

const ALLOWED_SCOPES: CapabilityScope[] = ["lokyy.dashboards.save_data"];

export const admin = new Hono();
admin.use("*", requireSystem);

admin.get("/capabilities", (c) => {
  // Hide the actual bearer string from list responses — System Skills
  // that issue capabilities get the bearer back at mint-time and pass
  // it on to the User-Skill; nobody needs to look it up later.
  const list = listCapabilities().map((r) => ({
    tokenId: r.tokenId,
    scope: r.scope,
    target: r.target,
    issuedBy: r.issuedBy,
    issuedAt: r.issuedAt,
    revokedAt: r.revokedAt,
    lastUsedAt: r.lastUsedAt,
    useCount: r.useCount,
  }));
  return c.json({ capabilities: list, total: list.length });
});

admin.post("/capabilities", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    scope?: string;
    target?: string;
    issuedBy?: string;
  };
  if (!body.scope || !ALLOWED_SCOPES.includes(body.scope as CapabilityScope)) {
    return c.json(
      {
        error: "invalid_scope",
        allowed: ALLOWED_SCOPES,
        got: body.scope ?? null,
      },
      400
    );
  }
  if (!body.issuedBy || typeof body.issuedBy !== "string") {
    return c.json({ error: "issuedBy required" }, 400);
  }
  const record = issueCapability({
    scope: body.scope as CapabilityScope,
    target: body.target,
    issuedBy: body.issuedBy,
  });
  // Bearer is returned ONCE — the caller is responsible for handing it
  // off securely (typically as an env-var into the consumer skill).
  return c.json(
    {
      tokenId: record.tokenId,
      bearer: record.bearer,
      scope: record.scope,
      target: record.target,
      issuedAt: record.issuedAt,
    },
    201
  );
});

admin.delete("/capabilities/:tokenId", (c) => {
  const tokenId = c.req.param("tokenId");
  const ok = revokeCapability(tokenId, "admin-api");
  if (!ok) return c.json({ error: "not_found_or_already_revoked" }, 404);
  return c.json({ ok: true });
});

// Direct tool invocation — system-bearer only. Used by ops + verify
// scripts. Hermes-side LLM clients invoke via real MCP (SSE → tools/call).
admin.post("/tools/:name/invoke", async (c) => {
  const name = c.req.param("name");
  const args = (await c.req.json().catch(() => ({}))) as unknown;
  try {
    const result = await invokeTool(name, args, {
      kind: "system",
      label: "system",
    });
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});
