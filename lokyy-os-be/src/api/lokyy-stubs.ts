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
import { dashGet } from "./hermes-dashboard-client.ts";
import { runHermesCli } from "./hermes-cli-client.ts";

/** Wrap a dashGet call: return the JSON on success, friendly empty + warning on failure. */
async function safeDash<T>(path: string, emptyFallback: T): Promise<{ data: T; live: boolean; error?: string }> {
  try {
    const data = await dashGet<T>(path);
    return { data, live: true };
  } catch (err) {
    return { data: emptyFallback, live: false, error: (err as Error).message };
  }
}

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

// Wired to hermes-dashboard /api/profiles — translate Hermes shape →
// lokyy-app's Agent type (camelCase, derived id, defaulted optional fields).
type HermesProfile = {
  name: string;
  path?: string;
  is_default?: boolean;
  model?: string;
  provider?: string;
  has_env?: boolean;
  skill_count?: number;
  mcp_count?: number;
  has_soul?: boolean;
  description?: string;
};
lokyyStubs.get("/agents", async (c) => {
  const r = await safeDash<{ profiles?: HermesProfile[] }>("/api/profiles", { profiles: [] });
  const agents = (r.data.profiles ?? []).map((p) => ({
    id: p.name,
    name: p.name,
    model: p.model ?? "—",
    provider: p.provider ?? "—",
    skillCount: p.skill_count ?? 0,
    mcpCount: p.mcp_count ?? 0,
    hasSoul: p.has_soul ?? false,
    description: p.description ?? (p.is_default ? "Default agent profile." : ""),
    isDefault: p.is_default ?? false,
    configPath: p.path ?? "",
  }));
  return c.json({ agents, live: r.live, error: r.error });
});

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
//
// NOTE: /tasks moved to a dedicated router (src/api/tasks.ts) that proxies
// hermes-dashboard /api/plugins/kanban/board. The Phase-1d "Hermes-Kanban
// nicht initialisiert" stub was a bug — see Issue #113.

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

// Wired to hermes-dashboard /api/sessions
lokyyStubs.get("/sessions", async (c) => {
  const r = await safeDash<{ sessions?: unknown[] }>("/api/sessions", { sessions: [] });
  return c.json({ sessions: r.data.sessions ?? [], live: r.live, error: r.error });
});

// /conversations/* moved to its own router in src/api/conversations.ts
// (mounted directly in index.ts so it takes precedence over this sub-app).

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

// Integrations = OAuth-backed third-party providers (calendar, email,
// docs, dev, CRM, comms). The FE already has icons + categories for 6
// well-known providers; we surface those as the curated list.
//
// connect/disconnect remain unimplemented — OAuth flows are tracked
// under the Phase-6 producer-wiring milestone. Until then the POST
// endpoints below return 501 with a deterministic note so the UI can
// show a clear "not yet supported" message instead of a silent fail.
type IntegrationProvider = {
  id: string;
  name: string;
  description: string;
  category: "calendar" | "email" | "crm" | "docs" | "comms" | "dev";
  homepage: string;
  status: "connected" | "disconnected";
  connectedAt?: string;
};
const SUPPORTED_INTEGRATIONS: IntegrationProvider[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Lokyy liest und plant Events in deinem Google Kalender.",
    category: "calendar",
    homepage: "https://calendar.google.com",
    status: "disconnected",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Lese und sende E-Mails per Lokyy-Agent via Gmail API.",
    category: "email",
    homepage: "https://mail.google.com",
    status: "disconnected",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Workspace-Seiten lesen, schreiben und durchsuchen.",
    category: "docs",
    homepage: "https://notion.so",
    status: "disconnected",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues anlegen, kommentieren und Status ändern.",
    category: "crm",
    homepage: "https://linear.app",
    status: "disconnected",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Lokyy-Agent postet in Channels und beantwortet DMs.",
    category: "comms",
    homepage: "https://slack.com",
    status: "disconnected",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repos, Issues und PRs lesen + bearbeiten.",
    category: "dev",
    homepage: "https://github.com",
    status: "disconnected",
  },
];

lokyyStubs.get("/integrations", (c) =>
  c.json({ integrations: SUPPORTED_INTEGRATIONS, available: [] })
);

// connect / disconnect — placeholder until Phase-6 OAuth wiring lands.
// Returning a 501 (with a body the FE can read) is intentional so the
// button surfaces a real "not yet supported" toast instead of a fake
// success that would leave the user expecting an OAuth popup.
lokyyStubs.post("/integrations/:id/connect", (c) => {
  const id = c.req.param("id");
  return c.json(
    {
      error: "not_implemented",
      provider: id,
      message:
        "OAuth-Flow für diesen Provider ist noch nicht verdrahtet. Phase-6 (Producer-Wiring) bringt echtes Connect/Disconnect.",
    },
    501,
  );
});

lokyyStubs.post("/integrations/:id/disconnect", (c) => {
  const id = c.req.param("id");
  return c.json(
    {
      error: "not_implemented",
      provider: id,
      message:
        "Disconnect-Flow ist mit Connect gekoppelt und landet zusammen in Phase-6.",
    },
    501,
  );
});

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

// Wired to hermes-dashboard /api/config plus lokyy-specific local prefs.
lokyyStubs.get("/settings", async (c) => {
  const r = await safeDash<Record<string, unknown>>("/api/config", {});
  return c.json({
    ...DEFAULT_SETTINGS,
    hermes: r.live ? r.data : null,
    hermesLive: r.live,
    hermesError: r.error,
  });
});

lokyyStubs.post("/settings", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ ...DEFAULT_SETTINGS, ...body, _saved: false, _note: "stub — settings echo back, not persisted yet" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vault — read-only filesystem listing rooted at LOKYY_VAULT_PATH.
// (Phase-3 will route writes through lokyy-brain; today is reads only.)
//
// Security: every request resolves `path` strictly relative to the
// vault root, then asserts that the resolved absolute path is still
// underneath the root via fs.realpath() comparison. This blocks both
// `..` traversal and symlink-escape. Files > VAULT_READ_MAX_BYTES
// return truncated content with a header so the FE can show a clear
// "file truncated" hint.
// ─────────────────────────────────────────────────────────────────────────────
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

const VAULT_ROOT_RAW = process.env.LOKYY_VAULT_PATH ?? "";
const VAULT_READ_MAX_BYTES = 256 * 1024; // 256 KiB cap on file reads

async function resolveVaultRoot(): Promise<string | null> {
  if (!VAULT_ROOT_RAW) return null;
  try {
    return await realpath(VAULT_ROOT_RAW);
  } catch {
    return null;
  }
}

async function safeResolve(
  root: string,
  rel: string,
): Promise<{ ok: true; absolute: string } | { ok: false; error: string }> {
  // Normalize, drop leading slashes, then resolve relative to root.
  // Any `..` that escapes the root is rejected by the realpath-prefix check.
  const cleaned = normalize(rel || ".").replace(/^[/\\]+/, "");
  const joined = join(root, cleaned);
  let absolute: string;
  try {
    absolute = await realpath(joined);
  } catch {
    return { ok: false, error: "path not found" };
  }
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    return { ok: false, error: "path escapes vault root" };
  }
  return { ok: true, absolute };
}

type VaultEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  modified?: string;
};

lokyyStubs.get("/vault", async (c) => {
  const action = c.req.query("action");
  const reqPath = c.req.query("path") ?? "";

  const root = await resolveVaultRoot();
  if (!root) {
    // Same payload shape as before — FE already renders a clean "not
    // configured" card when configured:false comes back.
    return c.json(
      action === "read"
        ? { configured: false, root: null, content: "", path: reqPath }
        : { configured: false, root: null, entries: [], path: reqPath },
    );
  }

  const resolved = await safeResolve(root, reqPath);
  if (!resolved.ok) {
    return c.json(
      action === "read"
        ? { configured: true, root, content: "", path: reqPath, error: resolved.error }
        : { configured: true, root, entries: [], path: reqPath, error: resolved.error },
      400,
    );
  }

  if (action === "read") {
    try {
      const st = await stat(resolved.absolute);
      if (!st.isFile()) {
        return c.json(
          { configured: true, root, content: "", path: reqPath, error: "not a file" },
          400,
        );
      }
      // Read at most VAULT_READ_MAX_BYTES — Bun's readFile accepts the
      // standard fs options; we then truncate in-memory if oversized.
      const buf = await readFile(resolved.absolute);
      let content = buf.toString("utf8");
      let truncated = false;
      if (buf.byteLength > VAULT_READ_MAX_BYTES) {
        content = buf.subarray(0, VAULT_READ_MAX_BYTES).toString("utf8");
        truncated = true;
      }
      return c.json({
        configured: true,
        root,
        content,
        path: reqPath,
        truncated,
        size: st.size,
      });
    } catch (err) {
      return c.json(
        {
          configured: true,
          root,
          content: "",
          path: reqPath,
          error: (err as Error).message,
        },
        500,
      );
    }
  }

  // Directory listing. Hide dotfiles by default (Obsidian config etc.).
  try {
    const dirents = await readdir(resolved.absolute, { withFileTypes: true });
    const entries: VaultEntry[] = [];
    for (const d of dirents) {
      if (d.name.startsWith(".")) continue;
      const childAbs = join(resolved.absolute, d.name);
      const childRel = join(reqPath || "", d.name);
      let size: number | undefined;
      let modified: string | undefined;
      try {
        const st = await stat(childAbs);
        size = d.isFile() ? st.size : undefined;
        modified = st.mtime.toISOString();
      } catch {
        // best-effort metadata; skip silently
      }
      entries.push({
        name: d.name,
        path: childRel,
        type: d.isDirectory() ? "dir" : "file",
        size,
        modified,
      });
    }
    // Dirs first, then files; alpha within each group.
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return c.json({ configured: true, root, entries, path: reqPath });
  } catch (err) {
    return c.json(
      {
        configured: true,
        root,
        entries: [],
        path: reqPath,
        error: (err as Error).message,
      },
      500,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// hermes-* — sub-routes used by `lokyy-hermes.ts` library on the FE.
// Each route reads a different facet of the Hermes runtime; until Hermes is
// deployed (Phase-2) we ship realistic empty/default responses so routes
// render cleanly instead of error-cards.
// ─────────────────────────────────────────────────────────────────────────────

// Used by routes that proxy hermes-dashboard JSON endpoints as the
// raw-string fallback when the dashboard is unreachable. The old text
// claimed Hermes wasn't deployed (Phase-1d), which is no longer true.
const HERMES_BRIDGE_UNREACHABLE_RAW =
  "[lokyy] hermes-dashboard nicht erreichbar — die Bridge antwortet nicht. Containers prüfen: lokyy-hermes + lokyy-hermes-dashboard.";

// Real backing — `hermes memory status` exec'd via docker-socket-proxy.
// CLI prints "Provider:  <name>" or "Provider: (none — built-in only)"
// followed by a bullet list of installed providers, each tagged with a
// mode string in parentheses, e.g. "(requires API key)", "(local)".
const PROVIDER_ROW = /^\s*[•\-*]\s+(\S+)\s+\(([^)]+)\)/;
const ACTIVE_PROVIDER_RE = /^\s*Provider:\s*(.+?)\s*$/;
lokyyStubs.get("/hermes-memory", async (c) => {
  try {
    const r = await runHermesCli(["memory", "status"]);
    if (!r.ok) {
      return c.json({
        builtinActive: true,
        activeProvider: null,
        installedProviders: [],
        raw: `[lokyy] hermes memory status exit=${r.exitCode}\n${r.stdout.slice(0, 600)}`,
      });
    }
    const cleaned = r.stdout.replace(ANSI_RE, "");
    let activeProvider: string | null = null;
    type Provider = { name: string; requiresKey: boolean; mode: string };
    const providers: Provider[] = [];
    for (const line of cleaned.split(/\r?\n/)) {
      const p = ACTIVE_PROVIDER_RE.exec(line);
      if (p) {
        const v = p[1]!.trim();
        activeProvider = /^\(none/.test(v) ? null : v;
        continue;
      }
      const m = PROVIDER_ROW.exec(line);
      if (!m) continue;
      const mode = m[2]!.trim();
      providers.push({
        name: m[1]!,
        requiresKey: /requires api key/i.test(mode),
        mode,
      });
    }
    return c.json({
      builtinActive: true,
      activeProvider,
      installedProviders: providers,
      raw: `[lokyy] ${providers.length} memory providers parsed (${r.durationMs}ms)`,
    });
  } catch (err) {
    return c.json({
      builtinActive: true,
      activeProvider: null,
      installedProviders: [],
      raw: `[lokyy] memory-status exec failed: ${(err as Error).message}`,
    });
  }
});

// Channels = the messaging-platforms Hermes can be a bot in. The
// authoritative list is the Platform enum in /opt/hermes/gateway/config.py
// (22 members). We curate the 14 user-facing messaging platforms here;
// internal members (LOCAL, API_SERVER) are intentionally omitted.
//
// "configured" is read live from /api/config → platforms.<id>.enabled
// (Hermes only writes that subtree after `hermes gateway setup` ran).
type ChannelPlatform = { id: string; name: string; description: string; configured: boolean };
const SUPPORTED_PLATFORMS: Omit<ChannelPlatform, "configured">[] = [
  { id: "telegram", name: "Telegram", description: "Bot via Telegram Bot API" },
  { id: "discord", name: "Discord", description: "Bot in Discord servers (slash + DMs)" },
  { id: "whatsapp", name: "WhatsApp", description: "Business cloud API or local bridge" },
  { id: "slack", name: "Slack", description: "Slack-bot in workspace channels" },
  { id: "signal", name: "Signal", description: "Signal via signal-cli bridge" },
  { id: "matrix", name: "Matrix", description: "Matrix homeserver bot" },
  { id: "mattermost", name: "Mattermost", description: "Mattermost team chat bot" },
  { id: "email", name: "Email", description: "IMAP/SMTP — agent answers inbox threads" },
  { id: "sms", name: "SMS", description: "Twilio / similar SMS gateway" },
  { id: "webhook", name: "Webhook", description: "Generic HTTP event ingress" },
  { id: "weixin", name: "Weixin (WeChat)", description: "WeChat official account" },
  { id: "feishu", name: "Feishu / Lark", description: "Feishu mini-program + chatbot" },
  { id: "dingtalk", name: "DingTalk", description: "DingTalk enterprise IM bot" },
  { id: "homeassistant", name: "Home Assistant", description: "Smart-home conversation agent" },
];

type ConfigShape = { platforms?: Record<string, { enabled?: boolean }> };
lokyyStubs.get("/hermes-channels", async (c) => {
  const r = await safeDash<ConfigShape>("/api/config", {});
  const platforms = r.data.platforms ?? {};
  const out: ChannelPlatform[] = SUPPORTED_PLATFORMS.map((p) => ({
    ...p,
    configured: platforms[p.id]?.enabled === true,
  }));
  return c.json(out);
});

// Real backing — `hermes tools list` exec'd via docker-socket-proxy.
// The CLI prints a section header followed by lines shaped like
//   "  ✓ enabled  <name>  <emoji> <description>"
//   "  ✗ disabled <name>  <emoji> <description>"
// In TTY mode the output is wrapped in ANSI SGR escape codes that we
// strip before applying the row regex.
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI-strip is intentional
const ANSI_RE = /\[[\d;]*m/g;
const TOOLS_ROW = /^\s*(✓|✗)\s+(enabled|disabled)\s+(\S+)\s+(\S+)\s+(.+?)\s*$/u;
lokyyStubs.get("/hermes-tools", async (c) => {
  try {
    const r = await runHermesCli(["tools", "list"]);
    if (!r.ok) {
      return c.json({
        tools: [],
        raw: `[lokyy] hermes tools list exit=${r.exitCode}\n${r.stdout.slice(0, 600)}`,
      });
    }
    type Tool = { name: string; emoji: string; description: string; enabled: boolean };
    const tools: Tool[] = [];
    const cleaned = r.stdout.replace(ANSI_RE, "");
    for (const line of cleaned.split(/\r?\n/)) {
      const m = TOOLS_ROW.exec(line);
      if (!m) continue;
      tools.push({
        enabled: m[2] === "enabled",
        name: m[3]!,
        emoji: m[4]!,
        description: m[5]!,
      });
    }
    return c.json({
      tools,
      raw: `[lokyy] ${tools.length} toolsets loaded from hermes tools list (${r.durationMs}ms)`,
    });
  } catch (err) {
    return c.json({
      tools: [],
      raw: `[lokyy] tools-list exec failed: ${(err as Error).message}`,
    });
  }
});

// Wired to hermes-dashboard /api/skills — Lokyy maps skills → "plugins" in this panel
lokyyStubs.get("/hermes-plugins", async (c) => {
  type Skill = { name: string; description: string; category: string; enabled: boolean };
  const r = await safeDash<Skill[]>("/api/skills", []);
  const skills = Array.isArray(r.data) ? r.data : [];
  const plugins = skills.map((s) => ({
    name: s.name,
    status: s.enabled ? "enabled" : "disabled",
    version: "—",
    description: s.description,
    source: s.category,
  }));
  return c.json({
    plugins,
    raw: r.live ? `[lokyy] ${skills.length} skills loaded from Hermes` : HERMES_BRIDGE_UNREACHABLE_RAW,
  });
});

// Real backing — `hermes webhook list` exec'd via docker-socket-proxy.
// Two states matter to the FE:
//   1. platform disabled → "Webhook platform is not enabled. To set it up:"
//      We return enabled:false plus the setup instructions (so the UI can
//      surface a real CTA instead of the old "not deployed" lie).
//   2. platform enabled  → a list of subscriptions, one per line. Lines
//      like "  <name>  <route>  -> <skill>" — we capture them verbatim
//      and let the FE decide rendering, since we don't yet know the
//      stable column format and don't want to lock it in prematurely.
lokyyStubs.get("/hermes-webhooks", async (c) => {
  try {
    const r = await runHermesCli(["webhook", "list"]);
    const notEnabled = /webhook platform is not enabled/i.test(r.stdout);
    if (notEnabled) {
      return c.json({
        enabled: false,
        webhooks: [],
        raw: r.stdout.trim(),
      });
    }
    if (!r.ok) {
      return c.json({
        enabled: false,
        webhooks: [],
        raw: `[lokyy] hermes webhook list exit=${r.exitCode}\n${r.stdout.slice(0, 600)}`,
      });
    }
    // Platform is on — surface the raw listing for now. Parsing the table
    // can land when we wire the create/edit flows in a follow-up issue.
    return c.json({
      enabled: true,
      webhooks: [],
      raw: r.stdout.trim(),
    });
  } catch (err) {
    return c.json({
      enabled: false,
      webhooks: [],
      raw: `[lokyy] webhook-list exec failed: ${(err as Error).message}`,
    });
  }
});

// Matches InsightsData shape in lokyy-hermes.ts:
//   { raw, summary: { sessions?, messages?, toolCalls?, totalTokens?, activeTime? } }
//
// Insights are *derived* — hermes-dashboard does not expose a JSON
// /api/insights endpoint (that path falls through to the SPA shell).
// We aggregate /api/sessions instead. The ?days=N query (default 30)
// is honored by filtering sessions whose started_at falls inside the
// window. Tokens are summed across the 5 token-type buckets that
// Hermes records per session.
type HermesSession = {
  id: string;
  started_at?: number | null;
  ended_at?: number | null;
  last_active?: number | null;
  is_active?: boolean | null;
  message_count?: number | null;
  tool_call_count?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
  reasoning_tokens?: number | null;
};

function formatActiveTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

lokyyStubs.get("/hermes-insights", async (c) => {
  const days = Number.parseInt(c.req.query("days") ?? "30", 10);
  const windowSeconds = Number.isFinite(days) && days > 0 ? days * 86_400 : 30 * 86_400;
  const nowSec = Date.now() / 1000;
  const cutoff = nowSec - windowSeconds;

  const r = await safeDash<{ sessions?: HermesSession[] }>("/api/sessions", { sessions: [] });
  if (!r.live) {
    return c.json({
      raw: r.error ?? HERMES_BRIDGE_UNREACHABLE_RAW,
      summary: { sessions: 0, messages: 0, toolCalls: 0, totalTokens: 0, activeTime: "0m" },
    });
  }
  const all = r.data.sessions ?? [];
  const inWindow = all.filter((s) => (s.started_at ?? 0) >= cutoff);

  let messages = 0;
  let toolCalls = 0;
  let totalTokens = 0;
  let activeSeconds = 0;
  for (const s of inWindow) {
    messages += s.message_count ?? 0;
    toolCalls += s.tool_call_count ?? 0;
    totalTokens +=
      (s.input_tokens ?? 0) +
      (s.output_tokens ?? 0) +
      (s.cache_read_tokens ?? 0) +
      (s.cache_write_tokens ?? 0) +
      (s.reasoning_tokens ?? 0);
    const start = s.started_at ?? 0;
    const end = s.ended_at ?? (s.is_active ? nowSec : s.last_active ?? start);
    if (end > start) activeSeconds += end - start;
  }

  return c.json({
    raw: `[lokyy] derived from ${inWindow.length} / ${all.length} sessions in the last ${days}d window`,
    summary: {
      sessions: inWindow.length,
      messages,
      toolCalls,
      totalTokens,
      activeTime: formatActiveTime(activeSeconds),
    },
  });
});

// Wired to hermes-dashboard /api/logs — returns recent gateway log lines.
lokyyStubs.get("/hermes-logs", async (c) => {
  const r = await safeDash<{ file?: string; lines?: string[] }>("/api/logs", { lines: [] });
  if (!r.live) {
    return c.json({ raw: HERMES_BRIDGE_UNREACHABLE_RAW, ok: false, error: r.error ?? "unknown" });
  }
  return c.json({ raw: (r.data.lines ?? []).join(""), ok: true, error: "" });
});

// Curator + Doctor are user-triggered buttons in /settings — both run
// the corresponding read-only hermes CLI subcommand via docker-exec
// and surface the raw output. The FE only needs `raw` (Doctor) plus
// `enabled` + summary fields (Curator); we infer those from the text.
lokyyStubs.get("/hermes-curator", async (c) => {
  try {
    const r = await runHermesCli(["curator", "status"]);
    const cleaned = r.stdout.replace(ANSI_RE, "");
    // Heuristic: text says "running" / "paused" / "not yet run" — we
    // surface enabled = true when the curator is not paused/disabled.
    const enabled = !/paused|disabled|not configured/i.test(cleaned);
    return c.json({
      enabled,
      runs: 0,
      lastRun: "",
      lastSummary: "",
      interval: "",
      raw: r.ok ? cleaned.trim() : `[lokyy] curator status exit=${r.exitCode}\n${cleaned}`,
    });
  } catch (err) {
    return c.json({
      enabled: false,
      runs: 0,
      lastRun: "",
      lastSummary: "",
      interval: "",
      raw: `[lokyy] curator-status exec failed: ${(err as Error).message}`,
    });
  }
});

lokyyStubs.get("/hermes-doctor", async (c) => {
  try {
    const r = await runHermesCli(["doctor"]);
    const cleaned = r.stdout.replace(ANSI_RE, "");
    return c.json({ raw: cleaned.trim(), ok: r.ok });
  } catch (err) {
    return c.json({
      raw: `[lokyy] doctor exec failed: ${(err as Error).message}`,
      ok: false,
    });
  }
});

// Backup is state-changing (creates a zip on the host) and can take
// 5-60s — too risky to fire from a click without confirmation +
// progress UI. We surface an honest "not yet wired" message instead
// of pretending the click did something. Follow-up issue tracks the
// real backup flow.
lokyyStubs.get("/hermes-backup", (c) =>
  c.json({
    ok: false,
    output:
      "[lokyy] Backup-Flow ist noch nicht verdrahtet. `hermes backup` ist state-changing und braucht Confirmation + Progress-UI. Bis dahin manuell im Container ausführen: docker exec lokyy-hermes /opt/hermes/.venv/bin/hermes backup",
    path: null,
  })
);
