/**
 * Tool registry — single source of truth for which System Skills are
 * exposed via MCP. Shared between the MCP server (tools/list +
 * tools/call routing) and the admin invoke-shortcut.
 *
 * Adding a new System Skill = one entry here. Per-tool privilege is
 * declared via `minPrincipal`; capability tokens additionally get a
 * scope-check inside the tool's own handler.
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "./auth.ts";
import { recordUse } from "./capabilities.ts";
import * as DashboardBuilder from "./system-skills/DashboardBuilder/index.ts";
import * as SaveDashboardData from "./system-skills/DashboardBuilder/save-data.ts";
import * as Producer from "./system-skills/Producer/index.ts";

export type ToolEntry = {
  tool: Tool;
  /** Min privilege to invoke. 'system' = only LOKYY_SYSTEM_SECRET passes;
   *  'capability' = any non-revoked capability token also passes (the
   *  tool's handler does the scope+target check itself). */
  minPrincipal: "system" | "capability";
  handle: (args: unknown, principal: Principal) => Promise<unknown>;
};

export const TOOL_REGISTRY: Record<string, ToolEntry> = {
  [DashboardBuilder.tool.name]: {
    tool: DashboardBuilder.tool,
    minPrincipal: "system",
    handle: DashboardBuilder.handle,
  },
  [SaveDashboardData.tool.name]: {
    tool: SaveDashboardData.tool,
    // Producers (User-Skills with a capability) are the typical caller.
    // System bearer also passes — useful for ops/verify scripts.
    minPrincipal: "capability",
    handle: SaveDashboardData.handle,
  },
  [Producer.tool.name]: {
    tool: Producer.tool,
    // Run-now is privileged: it executes producer logic and can hit
    // external APIs. System-only until we have per-user policy.
    minPrincipal: "system",
    handle: Producer.handle,
  },
};

export function principalAllowed(
  p: Principal,
  min: ToolEntry["minPrincipal"]
): boolean {
  if (min === "capability") return true;
  return p.kind === "system";
}

export function listToolsFor(principal: Principal): Tool[] {
  return Object.values(TOOL_REGISTRY)
    .filter((e) => principalAllowed(principal, e.minPrincipal))
    .map((e) => e.tool);
}

/** Direct invocation used by the admin shortcut. The MCP handler path
 *  uses the same registry but wraps the result in MCP content shape. */
export async function invokeTool(
  name: string,
  args: unknown,
  principal: Principal
): Promise<unknown> {
  const entry = TOOL_REGISTRY[name];
  if (!entry) throw new Error(`tool '${name}' not found`);
  if (!principalAllowed(principal, entry.minPrincipal)) {
    if (principal.kind === "capability") {
      recordUse(principal.record.tokenId, name, "deny");
    }
    throw new Error(
      `tool '${name}' requires '${entry.minPrincipal}' privilege; current is '${principal.kind}'`
    );
  }
  const result = await entry.handle(args, principal);
  if (principal.kind === "capability") {
    recordUse(principal.record.tokenId, name, "allow");
  }
  return result;
}
