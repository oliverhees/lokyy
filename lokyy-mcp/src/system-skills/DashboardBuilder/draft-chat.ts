/**
 * Iterative Dashboard-Builder (Phase-4.7).
 *
 * Multi-turn conversation where the LLM acts as a co-author of the
 * dashboard. Each iteration the LLM can:
 *   - ask a clarifying question  → kind="message"
 *   - emit/update a working draft → kind="draft"   (view_html + spec)
 *   - signal "save this"          → kind="final"   (same payload)
 *
 * The FE renders the current draft.view_html in a sandboxed iframe so
 * the user sees the work-in-progress, gives feedback ("mach Farben
 * blauer", "andere Quelle"), and the LLM regenerates.
 *
 * Producer-data-shape stays bound to one of the existing templates
 * (ki-news or email-digest) because the runtime producer logic is
 * still TypeScript in src/system-skills/Producer/. The LLM knows the
 * shape of each template and generates a view that consumes it via
 * postMessage.
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";

const HERMES_BASE_URL =
  process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? "";
const MODEL = process.env.HERMES_CHAT_MODEL ?? "hermes-agent";

// Producer data shapes the LLM is allowed to bind a view to.
const DATA_SHAPES = `
Producer-Daten-Formen (template → JSON-Shape die der View über postMessage empfängt):

1. template "ki-news" → \`{ runAt: ISO, items: [{ title: string, summary: string, source: string, url: string }] }\`
   Tägliche AI/Tech-News (Hacker News + Filter). 10 items.

2. template "email-digest" → \`{ runAt: ISO, groups: [{ name: string, mails: [{ subject: string, snippet: string, actionable: boolean }] }] }\`
   (Demo bis Gmail-OAuth landed, aber Shape ist final.)
`.trim();

const SYSTEM_PROMPT = `Du bist Lokyys interaktiver Dashboard-Builder. Du arbeitest MIT dem User zusammen einen Dashboard-View zu bauen.

${DATA_SHAPES}

PROZESS:
1. Frag kurz nach was unklar ist (1 Frage pro Turn, freundlich, deutsch).
2. Sobald du genug weißt, generiere einen ENTWURF: vollständiges Standalone-HTML.
3. Zeige den Entwurf, frag: "Was möchtest du anpassen?"
4. User gibt Feedback ("mach Farben rot", "größere Cards", "Quelle umtauschen"). Generiere überarbeitete Version.
5. Wenn User OK gibt ("passt", "speichern", "fertig"), markiere FINAL.

VIEW-HTML-REGELN:
- Standalone, inline CSS in <style>, inline JS in <script>
- Dark theme: \`--bg: #0b0b0f; --card: #15151c; --border: #242430; --text: #e7e7ee; --muted: #8b8b96\` (User darf das überschreiben)
- Daten kommen via postMessage:
    window.addEventListener('message', (ev) => {
      if (ev.data?.type === 'lokyy:dashboard:data') render(ev.data.payload);
    });
- Beim Laden sendet der View an parent:
    window.parent.postMessage({ type: 'lokyy:dashboard:ready' }, '*');
- HTML escapen mit \`(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))\`
- Empty-state wenn keine Daten ankommen
- Keine externen Skript-/CSS-Imports (CSP blockt sie)

OUTPUT-FORMAT (STRENG):

Wenn nur Klärung:
\`\`\`json
{ "kind": "message", "message": "Deine Rückfrage…" }
\`\`\`

Wenn Entwurf oder finaler Stand:
\`\`\`json
{
  "kind": "draft",
  "message": "Was hier neu/geändert ist + 'Was passt nicht?' (kurz)",
  "spec": {
    "title": "Anzeige-Titel",
    "intent": "Eine-Satz-Beschreibung",
    "template": "ki-news" | "email-digest",
    "schedule": "0 8 * * *"
  },
  "view_html": "<!doctype html>\\n<html>…vollständig…</html>"
}
\`\`\`

Wenn User sagt "passt"/"fertig"/"speichern" UND du hast einen Entwurf gemacht: setze \`"kind": "final"\` mit demselben payload-Shape.

KEINE Erklärungen um den JSON-Codeblock herum. Lokyy parst nur den JSON-Block.`;

export const tool: Tool = {
  name: "lokyy.dashboards.draft_chat",
  description:
    "Iterative dashboard-builder chat. Send conversation history + optional current draft. LLM returns either a clarification message, an updated draft (view_html + spec), or signals 'final' when the user accepts.",
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
      currentDraft: {
        type: "object",
        description: "Optional last-known draft so the LLM can iterate on it instead of starting over.",
      },
    },
    required: ["messages"],
  } as Tool["inputSchema"],
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type Spec = {
  title: string;
  intent: string;
  template: "ki-news" | "email-digest";
  schedule: string;
};
type Draft = { spec: Spec; view_html: string };
type DraftChatInput = { messages: ChatMessage[]; currentDraft?: Draft };

type DraftChatResult =
  | { kind: "message"; message: string }
  | { kind: "draft"; message: string; spec: Spec; view_html: string }
  | { kind: "final"; message: string; spec: Spec; view_html: string };

function parseInput(args: unknown): DraftChatInput {
  if (!args || typeof args !== "object") throw new Error("input must be object");
  const a = args as Record<string, unknown>;
  if (!Array.isArray(a.messages) || a.messages.length === 0) {
    throw new Error("messages required (non-empty array)");
  }
  return {
    messages: a.messages as ChatMessage[],
    currentDraft: a.currentDraft as Draft | undefined,
  };
}

function extractJsonBlock(text: string): unknown | null {
  // Prefer fenced ```json blocks; fall back to first {...} that parses.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]!.trim());
    } catch {
      // fall through
    }
  }
  // Last resort: brace-balanced first object
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function validateDraft(obj: Record<string, unknown>): Draft | null {
  const spec = obj.spec as Record<string, unknown> | undefined;
  const view_html = obj.view_html;
  if (!spec || typeof view_html !== "string" || view_html.length < 30) return null;
  if (typeof spec.title !== "string" || spec.title.trim().length < 1) return null;
  if (typeof spec.intent !== "string" || spec.intent.trim().length < 3) return null;
  if (spec.template !== "ki-news" && spec.template !== "email-digest") return null;
  if (typeof spec.schedule !== "string" || spec.schedule.trim().length < 1) return null;
  return {
    spec: {
      title: spec.title.trim(),
      intent: spec.intent.trim(),
      template: spec.template,
      schedule: spec.schedule.trim(),
    },
    view_html,
  };
}

export async function handle(
  rawArgs: unknown,
  _principal: Principal
): Promise<DraftChatResult> {
  const { messages, currentDraft } = parseInput(rawArgs);

  // If we have a currentDraft, prepend it as an assistant message so the
  // LLM sees what it already produced and can incrementally edit it
  // rather than re-emit the whole HTML each turn. This also keeps token
  // usage reasonable on long iterations.
  const contextMessages: ChatMessage[] = [];
  if (currentDraft) {
    contextMessages.push({
      role: "assistant",
      content:
        "```json\n" +
        JSON.stringify(
          { kind: "draft", message: "(previous draft)", ...currentDraft },
          null,
          2
        ) +
        "\n```",
    });
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...contextMessages,
      ...messages,
    ],
    stream: false,
    temperature: 0.5,
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
    throw new Error(
      `Hermes chat-completion failed: HTTP ${r.status} ${errText.slice(0, 200)}`
    );
  }
  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Hermes returned empty content");

  const parsed = extractJsonBlock(content);
  if (!parsed || typeof parsed !== "object") {
    // LLM didn't follow protocol — treat as plain message
    return { kind: "message", message: content };
  }
  const obj = parsed as Record<string, unknown>;
  const kindRaw = obj.kind;

  if (kindRaw === "message") {
    const msg = typeof obj.message === "string" ? obj.message : content;
    return { kind: "message", message: msg };
  }
  if (kindRaw === "draft" || kindRaw === "final") {
    const draft = validateDraft(obj);
    if (!draft) {
      return {
        kind: "message",
        message:
          "(Der Agent hat zwar ein JSON, aber kein valides Draft geliefert. Versuch's nochmal anders zu formulieren.)",
      };
    }
    const message =
      typeof obj.message === "string"
        ? obj.message
        : kindRaw === "final"
        ? "Fertig — kann gespeichert werden."
        : "Entwurf aktualisiert.";
    return { kind: kindRaw, message, ...draft };
  }
  // Unknown kind → fall back to message
  return { kind: "message", message: content };
}
