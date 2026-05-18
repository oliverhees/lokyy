/**
 * Node-type registry + executors (Phase-5.0).
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

// ─── Registry ──────────────────────────────────────────────────────────────

export const NODE_EXECUTORS: Record<string, NodeExecutor> = {
  "manual-trigger": manualTrigger,
  value,
  "http-fetch": httpFetch,
  // Phase-5.1+ adds:
  //   'llm-call' (Hermes chat-completions),
  //   'dashboard.save_data' (writes a dashboard run),
  //   'branch' (true/false handles),
};

export function isKnownNodeType(t: string): boolean {
  return t in NODE_EXECUTORS;
}
