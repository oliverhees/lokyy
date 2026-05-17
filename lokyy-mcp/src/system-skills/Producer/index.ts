/**
 * Producer — runs a Dashboard's data-collection logic and saves the
 * result via save_data. The "Jetzt laufen" button in the UI flows here.
 *
 * For now, producers are built-in TypeScript per template-key. The
 * generated `producer.skill.md` is documentation for a future Hermes-
 * skill-loader; until that lands, this module IS the producer runtime.
 *
 * Templates supported:
 *   - ki-news       → HackerNews top stories filtered by AI/ML keywords
 *   - email-digest  → mock empty response (needs Gmail auth — future)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";

const DASHBOARDS_ROOT =
  process.env.LOKYY_DASHBOARDS_ROOT ?? "/app/data/dashboards";

const KI_KEYWORDS = [
  "ai", "ml", "llm", "gpt", "claude", "anthropic", "openai",
  "machine learning", "neural", "transformer", "diffusion",
  "agent", "embedding", "vector", "rag", "prompt engineering",
  "gemini", "deepmind", "mistral", "llama", "huggingface",
];

export const tool: Tool = {
  name: "lokyy.dashboards.run_now",
  description:
    "Run a Dashboard's Producer-Skill immediately and save the result. Returns the run-date + payload size. Idempotent for the same day — calling twice overwrites today's run-file.",
  inputSchema: {
    type: "object",
    properties: {
      dashboardId: { type: "string", minLength: 3 },
    },
    required: ["dashboardId"],
  } as Tool["inputSchema"],
};

type ToolInput = { dashboardId: string };
type ToolResult = {
  ok: true;
  dashboardId: string;
  template: string;
  runDate: string;
  itemCount: number;
  path: string;
};

function parseInput(args: unknown): ToolInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  if (typeof a.dashboardId !== "string" || a.dashboardId.trim().length < 3) {
    throw new Error("dashboardId required");
  }
  return { dashboardId: a.dashboardId.trim() };
}

function readProducer(id: string): { template: string } {
  const p = join(DASHBOARDS_ROOT, id, "producer.json");
  if (!existsSync(p)) throw new Error(`dashboard '${id}' not found`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function writeRun(id: string, payload: unknown): { path: string; runDate: string } {
  const runDate = new Date().toISOString().slice(0, 10);
  const runDir = join(DASHBOARDS_ROOT, id, "runs");
  if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });
  const runPath = join(runDir, `${runDate}.json`);
  writeFileSync(
    runPath,
    JSON.stringify({ runAt: new Date().toISOString(), payload }, null, 2)
  );
  return { path: runPath, runDate };
}

// ─── Producers ──────────────────────────────────────────────────────────────

type HnStory = {
  id: number;
  title: string;
  url?: string;
  score?: number;
  by?: string;
  time?: number;
  descendants?: number;
  type?: string;
  text?: string;
};

async function fetchHnTopIds(limit = 80): Promise<number[]> {
  const r = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  if (!r.ok) throw new Error(`HN topstories: HTTP ${r.status}`);
  const all = (await r.json()) as number[];
  return all.slice(0, limit);
}

async function fetchHnStory(id: number): Promise<HnStory | null> {
  const r = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  if (!r.ok) return null;
  return (await r.json()) as HnStory;
}

function isAiRelated(title: string): boolean {
  const t = title.toLowerCase();
  return KI_KEYWORDS.some((k) =>
    // Whole-word match for the 2-3-letter keywords so "ai" doesn't match "rain"
    k.length <= 3
      ? new RegExp(`\\b${k}\\b`).test(t)
      : t.includes(k)
  );
}

async function runKiNewsProducer(): Promise<{ runAt: string; items: unknown[] }> {
  const ids = await fetchHnTopIds(80);
  // Fetch in parallel; some will fail/be deleted — tolerate nulls
  const stories = (
    await Promise.all(ids.map(fetchHnStory))
  ).filter((s): s is HnStory => s !== null && s.type === "story");
  const ai = stories.filter((s) => s.title && isAiRelated(s.title));
  const top = ai.slice(0, 10);
  return {
    runAt: new Date().toISOString(),
    items: top.map((s) => ({
      title: s.title,
      summary: s.text
        ? stripHtml(s.text).slice(0, 220)
        : `${s.score ?? 0} points · ${s.descendants ?? 0} comments`,
      source: "Hacker News",
      url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
    })),
  };
}

function runEmailDigestProducer(): { runAt: string; groups: unknown[] } {
  // Real producer would need Gmail OAuth — placeholder until that wires in.
  return {
    runAt: new Date().toISOString(),
    groups: [
      {
        name: "(Demo) Newsletter",
        mails: [
          {
            subject: "Email-Digest Producer not configured yet",
            snippet:
              "Connect Gmail in Settings → Integrations to populate this dashboard with real data.",
            actionable: false,
          },
        ],
      },
    ],
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ─── Tool handler ───────────────────────────────────────────────────────────

export async function handle(
  rawArgs: unknown,
  _principal: Principal
): Promise<ToolResult> {
  const { dashboardId } = parseInput(rawArgs);
  if (dashboardId.includes("/") || dashboardId.includes("..")) {
    throw new Error("invalid dashboardId");
  }
  const { template } = readProducer(dashboardId);

  let payload: { runAt: string; items?: unknown[]; groups?: unknown[] };
  if (template === "ki-news") {
    payload = await runKiNewsProducer();
  } else if (template === "email-digest") {
    payload = runEmailDigestProducer();
  } else {
    throw new Error(`no producer for template '${template}'`);
  }

  const { path, runDate } = writeRun(dashboardId, payload);
  const itemCount = payload.items?.length ?? payload.groups?.length ?? 0;
  return {
    ok: true,
    dashboardId,
    template,
    runDate,
    itemCount,
    path,
  };
}
