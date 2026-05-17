/**
 * DashboardBuilder — first System Skill (ISC-86–89).
 *
 * Tool: `lokyy.dashboards.create_via_builder({ intent })`
 *
 * Reads the user's free-text intent, picks a starter template (KI-News
 * or Email-Digest for now), writes the artifacts to
 * `/app/data/dashboards/{id}/`, mints a Capability-Token for the
 * Producer-Skill that will populate the dashboard, and returns the
 * dashboard id + producer bearer.
 *
 * The LLM-driven generation path ('write me a custom HTML view for X')
 * lands later. v1 is template-based but the interface is the right one —
 * an LLM upgrade swaps the template-picker for an LLM call, no API
 * change for callers.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { issueCapability } from "../../capabilities.ts";
import type { Principal } from "../../auth.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DASHBOARDS_ROOT =
  process.env.LOKYY_DASHBOARDS_ROOT ?? "/app/data/dashboards";
const TEMPLATES_DIR = resolve(__dirname, "templates");

type TemplateKey = "ki-news" | "email-digest";

type TemplateSpec = {
  key: TemplateKey;
  title: string;
  description: string;
  /** cron string the producer runs on (Hermes-cron). */
  schedule: string;
  /** what producer-skill markdown gets written out. */
  producerSpec: string;
};

const TEMPLATES: Record<TemplateKey, TemplateSpec> = {
  "ki-news": {
    key: "ki-news",
    title: "KI-News",
    description: "Tägliche Top-Beiträge aus KI-Welten — Anthropic, OpenAI, ArXiv, HN.",
    schedule: "0 8 * * *",
    producerSpec: `# KI-News Producer

Read the following sources, summarize each headline in 1–2 sentences,
return the top 10 in JSON shape \`{ items: [{ title, summary, source, url }] }\`.

Sources:
- https://www.anthropic.com/news
- https://openai.com/blog
- https://news.ycombinator.com (filter: AI/ML tag)
- https://arxiv.org/list/cs.AI/recent

Save via \`lokyy.dashboards.save_data\` using the capability injected as
\`LOKYY_CAPABILITY\` env-var.
`,
  },
  "email-digest": {
    key: "email-digest",
    title: "Email-Digest",
    description: "Zusammenfassung der letzten 24h Inbox, gruppiert nach Sender/Topic.",
    schedule: "0 7 * * *",
    producerSpec: `# Email-Digest Producer

Read inbox messages from the last 24 hours, group by sender domain or
topic, summarize each mail in 1 sentence, mark items that look like they
need a reply with \`actionable: true\`. Return JSON shape
\`{ groups: [{ name, mails: [{ subject, snippet, actionable }] }] }\`.

Save via \`lokyy.dashboards.save_data\` using the capability injected as
\`LOKYY_CAPABILITY\` env-var.
`,
  },
};

/** Cheap keyword-based template picker. The LLM-call upgrade replaces this. */
function pickTemplate(intent: string): TemplateKey {
  const i = intent.toLowerCase();
  if (/(mail|inbox|posteingang|nachrichten)/i.test(i)) return "email-digest";
  // default to ki-news — anything with "news", "ki", "ai", "trends" too
  return "ki-news";
}

/** Derive a stable, file-system-safe slug from the chosen template. */
function makeId(template: TemplateKey): string {
  return `${template}-${randomBytes(4).toString("hex")}`;
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function loadTemplateHtml(key: TemplateKey): string {
  return readFileSync(join(TEMPLATES_DIR, `${key}.html`), "utf8");
}

/** MCP tool registration. */
export const tool: Tool = {
  name: "lokyy.dashboards.create_via_builder",
  description:
    "Create a new Lokyy Dashboard from a free-text intent. Picks a starter template (KI-News or Email-Digest), writes the view + producer-skill files, mints a capability-token for the producer, and returns the dashboard id + producer bearer.",
  inputSchema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        minLength: 3,
        description:
          "What the user wants the dashboard to show. e.g. 'KI-News täglich' or 'Email summary every morning'.",
      },
    },
    required: ["intent"],
  } as Tool["inputSchema"],
};

type ToolInput = { intent: string };
type ToolResult = {
  dashboardId: string;
  template: TemplateKey;
  viewPath: string;
  producer: {
    schedule: string;
    capabilityBearer: string;
    capabilityTokenId: string;
    skillSpecPath: string;
  };
};

/** Validate input — kept inline to avoid pulling in a schema runtime. */
function parseInput(args: unknown): ToolInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  if (typeof a.intent !== "string" || a.intent.trim().length < 3) {
    throw new Error("intent must be a non-empty string of >=3 chars");
  }
  return { intent: a.intent.trim() };
}

export async function handle(
  rawArgs: unknown,
  principal: Principal
): Promise<ToolResult> {
  const { intent } = parseInput(rawArgs);

  const templateKey = pickTemplate(intent);
  const tmpl = TEMPLATES[templateKey];
  const id = makeId(templateKey);
  const dashboardDir = join(DASHBOARDS_ROOT, id);
  ensureDir(join(dashboardDir, "runs"));

  // 1. View
  const viewHtml = loadTemplateHtml(templateKey);
  writeFileSync(join(dashboardDir, "view.html"), viewHtml);

  // 2. Producer-Skill spec (Markdown for Hermes to load)
  writeFileSync(
    join(dashboardDir, "producer.skill.md"),
    tmpl.producerSpec
  );

  // 3. Capability for the producer to call save_data on THIS dashboard
  const capability = issueCapability({
    scope: "lokyy.dashboards.save_data",
    target: id,
    issuedBy: `DashboardBuilder/${principalLabel(principal)}`,
  });

  // 4. producer.json (metadata Lokyy reads to know how/when/where to run)
  const producerJson = {
    dashboardId: id,
    template: templateKey,
    schedule: tmpl.schedule,
    skillSpec: "producer.skill.md",
    capabilityTokenId: capability.tokenId,
    createdAt: new Date().toISOString(),
    originalIntent: intent,
  };
  writeFileSync(
    join(dashboardDir, "producer.json"),
    JSON.stringify(producerJson, null, 2)
  );

  return {
    dashboardId: id,
    template: templateKey,
    viewPath: `/app/data/dashboards/${id}/view.html`,
    producer: {
      schedule: tmpl.schedule,
      capabilityBearer: capability.bearer,
      capabilityTokenId: capability.tokenId,
      skillSpecPath: `/app/data/dashboards/${id}/producer.skill.md`,
    },
  };
}

function principalLabel(p: Principal): string {
  return p.kind === "system" ? "system" : `cap:${p.record.tokenId}`;
}
