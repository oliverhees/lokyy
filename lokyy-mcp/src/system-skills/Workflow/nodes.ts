/**
 * Node-type registry + executors (Phase-5.0).
 *
 * NOTE on import: we pull invokeTool from the tool-registry to power
 * the 'dashboard.save_data' node. That creates a cycle
 * (tool-registry ← Workflow/index ← executor ← nodes ← tool-registry),
 * but since invokeTool is only called at run-time (not module-eval), the
 * cycle is harmless in Bun + ESM.
 *
 * Each node-type has an `execute(config, inputs, ctx)` function that:
 *   - reads its config (declarative, set in spec.json)
 *   - reads inputs (outputs of upstream nodes)
 *   - returns its output (Record<string, unknown>)
 *
 * Inputs are merged from all incoming edges as `{ [upstreamNodeId]: output }`.
 * The first node-type that "starts" a workflow (e.g. manual-trigger) has
 * an external input passed in by the runtime.
 *
 * Phase-5.0 ships 3 minimal node-types: manual-trigger, value, http-fetch.
 * llm-call, dashboard.save_data, branch come in Phase-5.1+.
 */

export type NodeContext = {
  workflowId: string;
  runId: string;
  externalInput?: unknown; // payload from the trigger
};

export type NodeInputs = Record<string, unknown>;
export type NodeOutput = unknown;

export type NodeExecutor = (
  config: Record<string, unknown>,
  inputs: NodeInputs,
  ctx: NodeContext
) => Promise<NodeOutput>;

// ─── manual-trigger ────────────────────────────────────────────────────────
// Pass-through of the external trigger payload. Always the "entry" node.
const manualTrigger: NodeExecutor = async (_config, _inputs, ctx) => {
  return ctx.externalInput ?? null;
};

// ─── value ─────────────────────────────────────────────────────────────────
// Emits a static value from config.value. Useful for tests and constants.
const value: NodeExecutor = async (config) => {
  return config.value ?? null;
};

// ─── http-fetch ────────────────────────────────────────────────────────────
// Generic HTTP request. Config:
//   - url:    string (required)
//   - method: GET | POST | PUT | DELETE (default GET)
//   - headers: Record<string,string>
//   - body:   unknown (will be JSON.stringified for POST/PUT)
//   - jsonResponse: boolean — default true; if false returns text
const httpFetch: NodeExecutor = async (config) => {
  const url = config.url;
  if (typeof url !== "string") throw new Error("http-fetch: config.url (string) required");
  const method = (typeof config.method === "string" ? config.method : "GET").toUpperCase();
  const headers = (config.headers as Record<string, string>) ?? {};
  const init: RequestInit = { method, headers };
  if ("body" in config && (method === "POST" || method === "PUT" || method === "PATCH")) {
    init.body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
    if (!headers["Content-Type"] && typeof config.body !== "string") {
      headers["Content-Type"] = "application/json";
      init.headers = headers;
    }
  }
  const r = await fetch(url, init);
  const wantsJson = config.jsonResponse !== false;
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`http-fetch: HTTP ${r.status} ${r.statusText} :: ${text.slice(0, 200)}`);
  }
  if (wantsJson) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
};

// ─── llm-call ──────────────────────────────────────────────────────────────
// Calls Hermes /v1/chat/completions. Config:
//   - systemPrompt:  string (optional)
//   - userPrompt:    string (required) — supports {{nodeId.field}} placeholders
//                    expanded from upstream node outputs
//   - model:         override (default HERMES_CHAT_MODEL env or 'hermes-agent')
//   - temperature:   default 0.4
// Returns: { content, raw }
const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? "";
const DEFAULT_MODEL = process.env.HERMES_CHAT_MODEL ?? "hermes-agent";

function interpolate(template: string, inputs: NodeInputs): string {
  return template.replace(/\{\{\s*([a-z0-9_.\-]+)\s*\}\}/gi, (_m, path: string) => {
    const parts = path.split(".");
    let cur: unknown = inputs;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return "";
      }
    }
    if (cur === null || cur === undefined) return "";
    if (typeof cur === "object") return JSON.stringify(cur);
    return String(cur);
  });
}

const llmCall: NodeExecutor = async (config, inputs) => {
  const userPrompt = config.userPrompt;
  if (typeof userPrompt !== "string" || userPrompt.length < 1) {
    throw new Error("llm-call: config.userPrompt (string) required");
  }
  const systemPrompt = typeof config.systemPrompt === "string" ? config.systemPrompt : undefined;
  const model = typeof config.model === "string" ? config.model : DEFAULT_MODEL;
  const temperature = typeof config.temperature === "number" ? config.temperature : 0.4;

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: interpolate(systemPrompt, inputs) }] : []),
    { role: "user", content: interpolate(userPrompt, inputs) },
  ];
  const r = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: false, temperature }),
  });
  if (!r.ok) throw new Error(`llm-call: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, raw: data };
};

// ─── dashboard.save_data ───────────────────────────────────────────────────
// Writes a dashboard run via the existing save_data tool surface.
// Config:
//   - dashboardId: string (required) — which dashboard to write into
//   - payload:     unknown (required) — payload OR template-string that
//                  interpolates upstream outputs (use {{nodeId.field}})
// System-bearer-only execution (the system principal is implicit when
// invoked from the workflow runtime). Returns the save_data result.
import { invokeTool } from "../../tool-registry.ts";

const dashboardSaveData: NodeExecutor = async (config, inputs, _ctx) => {
  const dashboardId = config.dashboardId;
  if (typeof dashboardId !== "string" || dashboardId.length < 3) {
    throw new Error("dashboard.save_data: config.dashboardId (string) required");
  }
  let payload: unknown = config.payload;
  // Allow a string with {{...}} placeholders that resolve to JSON-able value
  if (typeof payload === "string") {
    const interpolated = interpolate(payload, inputs);
    try {
      payload = JSON.parse(interpolated);
    } catch {
      // Not JSON — pass as raw string
      payload = interpolated;
    }
  }
  // If payload is unset but there's exactly one upstream output, use it.
  if (payload === undefined) {
    const upstream = Object.values(inputs);
    if (upstream.length === 1) payload = upstream[0];
    else throw new Error("dashboard.save_data: config.payload required (or exactly one upstream node)");
  }
  return await invokeTool(
    "lokyy.dashboards.save_data",
    { dashboardId, payload },
    { kind: "system", label: "system" }
  );
};

// ─── hermes-agent ──────────────────────────────────────────────────────────
// Calls a specific Hermes-Profile (with its skills + MCPs already attached
// in the Hermes config). Profile picker in the FE pulls this list from
// /api/lokyy/agents — here we just route to Hermes /v1/chat/completions
// with the profile-name as the model field.
//
// Config:
//   - profile:      string (required) — profile name like 'default'
//   - userPrompt:   string (required)  — supports {{nodeId}} placeholders
//   - systemPrompt: string (optional)  — override profile default
//   - temperature:  number (optional, default 0.4)
// Returns: { content, raw }
const hermesAgent: NodeExecutor = async (config, inputs) => {
  const profile = config.profile;
  const userPrompt = config.userPrompt;
  if (typeof profile !== "string" || profile.length < 1) {
    throw new Error("hermes-agent: config.profile (string) required");
  }
  if (typeof userPrompt !== "string" || userPrompt.length < 1) {
    throw new Error("hermes-agent: config.userPrompt (string) required");
  }
  const systemPrompt = typeof config.systemPrompt === "string" ? config.systemPrompt : undefined;
  const temperature = typeof config.temperature === "number" ? config.temperature : 0.4;
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: interpolate(systemPrompt, inputs) }] : []),
    { role: "user", content: interpolate(userPrompt, inputs) },
  ];
  const r = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: profile,
      messages,
      stream: false,
      temperature,
    }),
  });
  if (!r.ok) throw new Error(`hermes-agent: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, profile, raw: data };
};

// ─── lokyy-agent ───────────────────────────────────────────────────────────
// Runs a user-created Lokyy-Agent. The agent's curated skills are
// injected into the system-prompt as context so the underlying Hermes
// run knows what behaviors are expected of it.
//
// Config:
//   - agentId:    string (required) — Lokyy-Agent id
//   - userPrompt: string (required) — supports {{nodeId}} placeholders
// Returns: { content, agentId, raw }
import { readAgent } from "../LokyyAgent/index.ts";

const HERMES_DASHBOARD_URL =
  process.env.HERMES_DASHBOARD_URL ?? "http://hermes-dashboard:9119";

/** Fetch a single Hermes-Skill's metadata. Used to enrich the system
 *  prompt with descriptions of the skills the agent has access to.
 *  Skill markdown content is intentionally NOT fetched (would balloon
 *  tokens) — descriptions are enough for the LLM to behave. */
async function fetchSkillDescriptions(
  skillNames: string[]
): Promise<Array<{ name: string; description: string }>> {
  if (skillNames.length === 0) return [];
  try {
    // hermes-dashboard /api/skills returns the full list — filter locally
    const r = await fetch(`${HERMES_DASHBOARD_URL}/api/skills`);
    if (!r.ok) return skillNames.map((n) => ({ name: n, description: "" }));
    const all = (await r.json()) as Array<{ name: string; description?: string }>;
    const byName = new Map(all.map((s) => [s.name, s.description ?? ""]));
    return skillNames.map((n) => ({ name: n, description: byName.get(n) ?? "" }));
  } catch {
    return skillNames.map((n) => ({ name: n, description: "" }));
  }
}

const lokyyAgent: NodeExecutor = async (config, inputs) => {
  const agentId = config.agentId;
  const userPrompt = config.userPrompt;
  if (typeof agentId !== "string" || agentId.length < 1) {
    throw new Error("lokyy-agent: config.agentId required");
  }
  if (typeof userPrompt !== "string" || userPrompt.length < 1) {
    throw new Error("lokyy-agent: config.userPrompt required");
  }
  const agent = readAgent(agentId);
  if (!agent) throw new Error(`lokyy-agent: agent '${agentId}' not found`);

  // Build the enriched system prompt: agent's own prompt + skill context.
  const skillDescriptions = await fetchSkillDescriptions(agent.skills);
  const skillSection =
    skillDescriptions.length > 0
      ? "\n\n# Verfügbare Skills (verhalte dich entsprechend):\n" +
        skillDescriptions
          .map((s) => `- **${s.name}**${s.description ? `: ${s.description}` : ""}`)
          .join("\n")
      : "";
  const mcpHint =
    agent.mcps.length > 0
      ? "\n\n# MCPs zugeordnet (v1 informational): " + agent.mcps.join(", ")
      : "";
  const systemPrompt = (agent.systemPrompt || "") + skillSection + mcpHint;

  const messages = [
    ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: interpolate(userPrompt, inputs) },
  ];

  const r = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: agent.model,
      messages,
      stream: false,
      temperature: 0.4,
    }),
  });
  if (!r.ok) {
    throw new Error(`lokyy-agent: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    content,
    agentId,
    agentName: agent.name,
    skillsUsed: agent.skills,
    raw: data,
  };
};

// ─── Registry ──────────────────────────────────────────────────────────────

export const NODE_EXECUTORS: Record<string, NodeExecutor> = {
  "manual-trigger": manualTrigger,
  value,
  "http-fetch": httpFetch,
  "llm-call": llmCall,
  "hermes-agent": hermesAgent,
  "lokyy-agent": lokyyAgent,
  "dashboard.save_data": dashboardSaveData,
  // Phase-5.x adds: 'branch' (true/false handles), 'lokyy-skill', 'json-extract'
};

export function isKnownNodeType(t: string): boolean {
  return t in NODE_EXECUTORS;
}
