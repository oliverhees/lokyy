/**
 * Save a fully-iterated draft as a real Lokyy Dashboard (Phase-4.7).
 *
 * Sibling to create_via_builder, but takes an LLM-authored view_html
 * verbatim instead of running through the template-picker. Producer
 * stays template-bound (so the cron + run_now logic still applies).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { issueCapability } from "../../capabilities.ts";
import type { Principal } from "../../auth.ts";

const DASHBOARDS_ROOT =
  process.env.LOKYY_DASHBOARDS_ROOT ?? "/app/data/dashboards";

export const tool: Tool = {
  name: "lokyy.dashboards.create_from_draft",
  description:
    "Persist an LLM-authored draft (view_html + spec) as a real Lokyy Dashboard. Producer is bound to spec.template; the iterated view_html is what users see.",
  inputSchema: {
    type: "object",
    properties: {
      spec: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          intent: { type: "string", minLength: 3 },
          template: { type: "string", enum: ["ki-news", "email-digest"] },
          schedule: { type: "string", minLength: 5 },
        },
        required: ["title", "intent", "template", "schedule"],
      },
      view_html: { type: "string", minLength: 30 },
    },
    required: ["spec", "view_html"],
  } as Tool["inputSchema"],
};

type ToolInput = {
  spec: {
    title: string;
    intent: string;
    template: "ki-news" | "email-digest";
    schedule: string;
  };
  view_html: string;
};

function parseInput(args: unknown): ToolInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  const spec = a.spec as Record<string, unknown> | undefined;
  if (!spec) throw new Error("spec required");
  if (typeof spec.title !== "string" || spec.title.trim().length < 1) throw new Error("spec.title invalid");
  if (typeof spec.intent !== "string" || spec.intent.trim().length < 3) throw new Error("spec.intent invalid");
  if (spec.template !== "ki-news" && spec.template !== "email-digest") throw new Error("spec.template invalid");
  if (typeof spec.schedule !== "string") throw new Error("spec.schedule required");
  if (typeof a.view_html !== "string" || a.view_html.length < 30) throw new Error("view_html invalid");
  return {
    spec: {
      title: spec.title.trim(),
      intent: spec.intent.trim(),
      template: spec.template,
      schedule: spec.schedule.trim(),
    },
    view_html: a.view_html,
  };
}

export async function handle(
  rawArgs: unknown,
  principal: Principal
): Promise<{
  dashboardId: string;
  template: string;
  producer: { capabilityBearer: string; capabilityTokenId: string };
}> {
  const { spec, view_html } = parseInput(rawArgs);

  // Dashboard ID: template-prefix + short hash, matches DashboardBuilder.
  const id = `${spec.template}-${randomBytes(4).toString("hex")}`;
  const dashboardDir = join(DASHBOARDS_ROOT, id);
  mkdirSync(join(dashboardDir, "runs"), { recursive: true });

  // 1. Custom (LLM-generated) view
  writeFileSync(join(dashboardDir, "view.html"), view_html);

  // 2. Capability for the producer to call save_data on this dashboard
  const capability = issueCapability({
    scope: "lokyy.dashboards.save_data",
    target: id,
    issuedBy: `DraftWizard/${principalLabel(principal)}`,
  });

  // 3. producer.json — schema-compatible with create_via_builder so the
  //    rest of the system (cron, edit, delete, list) treats it identically.
  const producerJson = {
    dashboardId: id,
    template: spec.template,
    schedule: spec.schedule,
    skillSpec: "producer.skill.md",
    capabilityTokenId: capability.tokenId,
    createdAt: new Date().toISOString(),
    originalIntent: spec.intent,
    title: spec.title,
    // Marker so we know this dashboard came from the wizard (vs template-picker).
    source: "draft-wizard",
  };
  writeFileSync(
    join(dashboardDir, "producer.json"),
    JSON.stringify(producerJson, null, 2)
  );

  // 4. Producer-spec markdown — still template-bound for run_now.
  const producerMd =
    spec.template === "ki-news"
      ? "# Producer: ki-news\n\nUses built-in HackerNews-AI fetcher (Producer/index.ts → runKiNewsProducer)."
      : "# Producer: email-digest\n\nDemo producer until Gmail OAuth lands.";
  writeFileSync(join(dashboardDir, "producer.skill.md"), producerMd);

  return {
    dashboardId: id,
    template: spec.template,
    producer: {
      capabilityBearer: capability.bearer,
      capabilityTokenId: capability.tokenId,
    },
  };
}

function principalLabel(p: Principal): string {
  return p.kind === "system" ? "system" : `cap:${p.record.tokenId}`;
}
