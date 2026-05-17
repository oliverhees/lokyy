/**
 * lokyy.dashboards.save_data — the Producer-counterpart to
 * create_via_builder (ISC-92).
 *
 * A Producer-Skill (User-Skill in Hermes) runs on a cron, gathers data
 * for "its" dashboard, and calls this tool to persist the result. The
 * capability token injected into the Producer's environment is
 * scope='lokyy.dashboards.save_data' + target=<dashboardId>, so a
 * compromised Producer can ONLY write to its own dashboard's runs
 * directory.
 *
 * Storage: /app/data/dashboards/{id}/runs/YYYY-MM-DD.json (one file
 * per day; calling twice overwrites the same day's run).
 */
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { authorize, recordUse } from "../../capabilities.ts";
import type { Principal } from "../../auth.ts";

const DASHBOARDS_ROOT =
  process.env.LOKYY_DASHBOARDS_ROOT ?? "/app/data/dashboards";

export const tool: Tool = {
  name: "lokyy.dashboards.save_data",
  description:
    "Save a Producer-Skill's run output for a specific Lokyy Dashboard. Capability-scoped: the caller's token must have scope='lokyy.dashboards.save_data' and target matching the dashboardId.",
  inputSchema: {
    type: "object",
    properties: {
      dashboardId: {
        type: "string",
        minLength: 3,
        description: "The dashboard whose data to save. Must match the capability's target.",
      },
      payload: {
        type: "object",
        description:
          "The data the View will render. Shape is dashboard-specific (e.g. { items: [...] } for ki-news, { groups: [...] } for email-digest).",
      },
    },
    required: ["dashboardId", "payload"],
  } as Tool["inputSchema"],
};

type ToolInput = { dashboardId: string; payload: unknown };
type ToolResult = {
  ok: true;
  dashboardId: string;
  runDate: string;
  path: string;
};

function parseInput(args: unknown): ToolInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  if (typeof a.dashboardId !== "string" || a.dashboardId.trim().length < 3) {
    throw new Error("dashboardId required (string, >=3 chars)");
  }
  if (a.payload === undefined || a.payload === null) {
    throw new Error("payload required");
  }
  // Loose validation — each template defines its own shape. We just ensure
  // it's serializable.
  try {
    JSON.stringify(a.payload);
  } catch {
    throw new Error("payload must be JSON-serializable");
  }
  return { dashboardId: a.dashboardId.trim(), payload: a.payload };
}

function ensureDashboardExists(dashboardId: string) {
  // The dashboard must have been created via DashboardBuilder first —
  // producer.json proves it. Prevents path-traversal arbitrary-write.
  if (dashboardId.includes("/") || dashboardId.includes("..")) {
    throw new Error("invalid dashboardId");
  }
  const producerJson = join(DASHBOARDS_ROOT, dashboardId, "producer.json");
  if (!existsSync(producerJson)) {
    throw new Error(`dashboard '${dashboardId}' not found`);
  }
}

export async function handle(
  rawArgs: unknown,
  principal: Principal
): Promise<ToolResult> {
  const { dashboardId, payload } = parseInput(rawArgs);

  // Scope-check FIRST for capability principals — don't leak existence
  // of other dashboards via timing/error-message difference. System
  // principals bypass (they may write to any dashboard — ops + verify).
  if (principal.kind === "capability") {
    const auth = authorize(principal.record, {
      scope: "lokyy.dashboards.save_data",
      target: dashboardId,
    });
    if (!auth.ok) {
      recordUse(principal.record.tokenId, tool.name, "deny");
      throw new Error(`capability ${auth.reason}: token cannot write to '${dashboardId}'`);
    }
  }

  ensureDashboardExists(dashboardId);

  const runDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const runDir = join(DASHBOARDS_ROOT, dashboardId, "runs");
  if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });

  const runPath = join(runDir, `${runDate}.json`);
  const record = {
    runAt: new Date().toISOString(),
    payload,
  };
  writeFileSync(runPath, JSON.stringify(record, null, 2));

  return {
    ok: true,
    dashboardId,
    runDate,
    path: runPath,
  };
}
