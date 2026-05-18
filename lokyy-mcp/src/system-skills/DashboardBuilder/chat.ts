/**
 * Chat-Wizard for Dashboard creation (Phase-4.6).
 *
 * Replaces the single-intent input dialog with a short multi-turn
 * conversation. The LLM (Hermes /v1/chat/completions) asks 1-3
 * clarifying questions about template + schedule + title, then emits a
 * structured spec when ready. The FE then calls create_via_builder with
 * that spec.
 *
 * Tool surface (stateless):
 *   input  : { messages: [{role, content}] }
 *   output : { kind: "message", content }   — continue conversation
 *          | { kind: "spec", spec: {intent, schedule, title} }  — ready
 *
 * The LLM is instructed to respond with a single JSON code block of a
 * fixed shape when it has enough info. We parse that out of the message;
 * if no JSON match, the message is treated as a continuation turn.
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";

const HERMES_BASE_URL =
  process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? "";
const MODEL = process.env.HERMES_CHAT_MODEL ?? "hermes-agent";

const SYSTEM_PROMPT = `Du bist Lokyys Dashboard-Wizard. Du hilfst dem Nutzer in 1-3 Turns ein neues Dashboard zu spezifizieren.

Verfügbare Templates (Lokyy wählt das passende anhand des intent-Texts automatisch):
- ki-news:      KI- & Tech-News (Hacker News-Quellen)
- email-digest: E-Mail-Posteingang-Zusammenfassung (noch Demo, Gmail-OAuth pending)

Frage GEZIELT nach (nur was unklar ist):
- Was soll das Dashboard zeigen?
- Wie oft soll der Producer laufen? (Cron-Format, default 0 8 * * *)
- Optional ein kurzer Titel?

Sei knapp, freundlich, antworte auf deutsch.

SOBALD du genug weißt, antworte mit AUSSCHLIESSLICH einem JSON-Codeblock in diesem Format:

\`\`\`json
{
  "ready": true,
  "intent": "Klare Beschreibung in einem Satz",
  "schedule": "0 8 * * *",
  "title": "Kurzer Anzeige-Titel"
}
\`\`\`

KEINE weiteren Worte um den JSON-Block herum. Lokyy parst nur den JSON, kein anderer Text wird gelesen.`;

export const tool: Tool = {
  name: "lokyy.dashboards.chat",
  description:
    "Multi-turn chat to design a new Lokyy Dashboard. Send the full conversation history with each call. Stateless. Returns either the next assistant message OR a final spec when the LLM has enough info.",
  inputSchema: {
    type: "object",
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string" },
          },
          required: ["role", "content"],
        },
        minItems: 1,
      },
    },
    required: ["messages"],
  } as Tool["inputSchema"],
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatInput = { messages: ChatMessage[] };

type ChatResult =
  | { kind: "message"; content: string }
  | {
      kind: "spec";
      spec: { intent: string; schedule: string; title: string };
    };

function parseInput(args: unknown): ChatInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  if (!Array.isArray(a.messages) || a.messages.length === 0) {
    throw new Error("messages required (non-empty array)");
  }
  for (const m of a.messages) {
    if (
      !m ||
      typeof m !== "object" ||
      typeof (m as ChatMessage).role !== "string" ||
      typeof (m as ChatMessage).content !== "string"
    ) {
      throw new Error("each message needs role + content");
    }
  }
  return { messages: a.messages as ChatMessage[] };
}

/** Try to pull a JSON spec out of the LLM's reply. */
function tryParseSpec(text: string):
  | { intent: string; schedule: string; title: string }
  | null {
  // Match either ```json …``` or a bare JSON object containing "ready":true
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1] ?? text;
  let obj: unknown;
  try {
    obj = JSON.parse(candidate.trim());
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.ready !== true) return null;
  if (typeof o.intent !== "string" || o.intent.trim().length < 3) return null;
  if (typeof o.schedule !== "string") return null;
  if (typeof o.title !== "string" || o.title.trim().length < 1) return null;
  return {
    intent: o.intent.trim(),
    schedule: o.schedule.trim(),
    title: o.title.trim(),
  };
}

export async function handle(
  rawArgs: unknown,
  _principal: Principal
): Promise<ChatResult> {
  const { messages } = parseInput(rawArgs);

  // Call Hermes /v1/chat/completions. We pass our system prompt + the
  // user-supplied history.
  const body = {
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: false,
    temperature: 0.4,
  };

  const r = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Hermes chat-completion failed: HTTP ${r.status} ${errText.slice(0, 200)}`);
  }
  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Hermes returned empty content");

  const spec = tryParseSpec(content);
  if (spec) return { kind: "spec", spec };
  return { kind: "message", content };
}
