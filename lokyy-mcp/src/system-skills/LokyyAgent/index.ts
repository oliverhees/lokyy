/**
 * Lokyy Agents — user-creatable agents with their own system-prompt,
 * model choice, and a curated skills + MCPs list (Phase-5.5, ADR-009).
 *
 * Distinct from Hermes-Profiles which are CLI-created and live in
 * Hermes' own config. A Lokyy-Agent is a thin Lokyy-managed wrapper
 * that — at run-time — translates to a /v1/chat/completions call with
 * the agent's curated skill-list injected as context in the system
 * prompt (the 'lightweight' mechanic chosen in Oliver's brainstorm
 * 2026-05-18).
 *
 * Storage: /app/data/agents/{id}.json (mirror of dashboards/workflows
 * pattern). Phase-3 swap-target: lokyy-brain.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";

const AGENTS_ROOT = process.env.LOKYY_AGENTS_ROOT ?? "/app/data/agents";

export type LokyyAgent = {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  /** Hermes profile name to use as the underlying model (e.g. "default"). */
  model: string;
  /** Hermes-Skill names the agent should have access to. Injected as
   *  context in the system prompt at run-time. */
  skills: string[];
  /** MCP server names. v1: visual-only; v2 will wire through to Hermes. */
  mcps: string[];
  createdAt: string;
  updatedAt: string;
};

function safeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(id);
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function pathFor(id: string): string {
  return join(AGENTS_ROOT, `${id}.json`);
}

export function listAgentIds(): string[] {
  if (!existsSync(AGENTS_ROOT)) return [];
  return readdirSync(AGENTS_ROOT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .filter(safeId);
}

export function readAgent(id: string): LokyyAgent | null {
  if (!safeId(id)) return null;
  const p = pathFor(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as LokyyAgent;
  } catch {
    return null;
  }
}

export function writeAgent(agent: LokyyAgent): void {
  if (!safeId(agent.id)) throw new Error("invalid agent id");
  ensureDir(dirname(pathFor(agent.id)));
  writeFileSync(pathFor(agent.id), JSON.stringify(agent, null, 2));
}

export function deleteAgentFile(id: string): boolean {
  if (!safeId(id)) return false;
  const p = pathFor(id);
  if (!existsSync(p)) return false;
  rmSync(p);
  return true;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildAgentFromInput(input: unknown, existing?: LokyyAgent): LokyyAgent {
  if (!input || typeof input !== "object") throw new Error("agent object required");
  const a = input as Record<string, unknown>;
  const id = typeof a.id === "string" ? a.id.trim() : existing?.id;
  if (!id || !safeId(id)) throw new Error("agent.id must be slug (3-64 chars)");
  if (typeof a.name !== "string" || a.name.trim().length < 1) {
    throw new Error("agent.name required");
  }
  if (typeof a.systemPrompt !== "string") {
    throw new Error("agent.systemPrompt required (can be empty)");
  }
  if (typeof a.model !== "string" || a.model.length < 1) {
    throw new Error("agent.model required (e.g. 'default')");
  }
  return {
    id,
    name: a.name.trim(),
    description: typeof a.description === "string" ? a.description.trim() : undefined,
    systemPrompt: a.systemPrompt,
    model: a.model.trim(),
    skills: Array.isArray(a.skills)
      ? a.skills.filter((s): s is string => typeof s === "string")
      : [],
    mcps: Array.isArray(a.mcps)
      ? a.mcps.filter((s): s is string => typeof s === "string")
      : [],
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

// ─── Tools ─────────────────────────────────────────────────────────────────

export const listTool: Tool = {
  name: "lokyy.agents.list",
  description: "List all Lokyy-Agents (user-created). System Hermes-profiles are NOT included — use lokyy.agents.list_system_profiles for those.",
  inputSchema: { type: "object", properties: {} } as Tool["inputSchema"],
};

async function listHandle() {
  const items = listAgentIds()
    .map((id) => readAgent(id))
    .filter((x): x is LokyyAgent => x !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { agents: items };
}

export const getTool: Tool = {
  name: "lokyy.agents.get",
  description: "Read a Lokyy-Agent by id.",
  inputSchema: {
    type: "object",
    properties: { agentId: { type: "string" } },
    required: ["agentId"],
  } as Tool["inputSchema"],
};

async function getHandle(rawArgs: unknown) {
  const a = rawArgs as { agentId?: string };
  if (!a.agentId) throw new Error("agentId required");
  const agent = readAgent(a.agentId);
  if (!agent) throw new Error(`agent '${a.agentId}' not found`);
  return { agent };
}

export const createTool: Tool = {
  name: "lokyy.agents.create",
  description: "Create a new Lokyy-Agent.",
  inputSchema: {
    type: "object",
    properties: { agent: { type: "object" } },
    required: ["agent"],
  } as Tool["inputSchema"],
};

async function createHandle(rawArgs: unknown) {
  const a = rawArgs as { agent?: unknown };
  const agent = buildAgentFromInput(a.agent);
  if (readAgent(agent.id)) throw new Error(`agent '${agent.id}' already exists`);
  writeAgent(agent);
  return { agent };
}

export const updateTool: Tool = {
  name: "lokyy.agents.update",
  description: "Replace a Lokyy-Agent. Id is preserved.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string" },
      agent: { type: "object" },
    },
    required: ["agentId", "agent"],
  } as Tool["inputSchema"],
};

async function updateHandle(rawArgs: unknown) {
  const a = rawArgs as { agentId?: string; agent?: unknown };
  if (!a.agentId) throw new Error("agentId required");
  const existing = readAgent(a.agentId);
  if (!existing) throw new Error(`agent '${a.agentId}' not found`);
  const merged = { ...(a.agent as Record<string, unknown>), id: a.agentId };
  const agent = buildAgentFromInput(merged, existing);
  writeAgent(agent);
  return { agent };
}

export const deleteTool: Tool = {
  name: "lokyy.agents.delete",
  description: "Delete a Lokyy-Agent.",
  inputSchema: {
    type: "object",
    properties: { agentId: { type: "string" } },
    required: ["agentId"],
  } as Tool["inputSchema"],
};

async function deleteHandle(rawArgs: unknown) {
  const a = rawArgs as { agentId?: string };
  if (!a.agentId) throw new Error("agentId required");
  const ok = deleteAgentFile(a.agentId);
  if (!ok) throw new Error(`agent '${a.agentId}' not found`);
  return { ok: true };
}

export const tools = {
  list: { tool: listTool, handle: listHandle },
  get: { tool: getTool, handle: getHandle },
  create: { tool: createTool, handle: createHandle },
  update: { tool: updateTool, handle: updateHandle },
  remove: { tool: deleteTool, handle: deleteHandle },
};
