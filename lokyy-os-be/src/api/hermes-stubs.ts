/**
 * /api/hermes/* — proxy to the Hermes Agent container's OpenAI-compatible
 * HTTP server. Falls back to a 503 with a clear phase note when Hermes is
 * not deployed or auth is missing.
 *
 * Upstream:
 *   ${HERMES_BASE_URL:-http://hermes:8642}
 * Auth:
 *   Authorization: Bearer ${HERMES_API_KEY}    (must match Hermes side)
 *
 * Streaming responses (Server-Sent Events for chat completions) pass through
 * unchanged because we return the upstream Response body directly.
 *
 * Time-injection (#156): every POST /v1/chat/completions gets a small
 * system-message prepended that tells the LLM the current wall-clock time
 * and timezone. LLMs don't otherwise have any clue what time it is in the
 * user's locale, and Hermes' default persona doesn't inject one, so the
 * agent would otherwise hallucinate timestamps (Oliver saw "18:59" when
 * it was actually 21:00). The injected message is small and prepended,
 * so it doesn't disturb the rest of the conversation.
 */
import { Hono } from "hono";

const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY;
const SCHEDULER_TZ = process.env.LOKYY_CRON_TZ ?? "Europe/Berlin";

export const hermesStubs = new Hono();

function buildLokyyGuardrails(): { role: "system"; content: string } {
  const now = new Date();
  const isoUtc = now.toISOString();
  const local = new Intl.DateTimeFormat("de-DE", {
    timeZone: SCHEDULER_TZ,
    dateStyle: "full",
    timeStyle: "long",
  }).format(now);
  return {
    role: "system",
    content:
      `[Lokyy runtime context — inject pro Call, höchste Priorität]\n\n` +
      `## Aktuelle Zeit\n` +
      `Wand-Uhr (${SCHEDULER_TZ}): ${local}\n` +
      `UTC/ISO-8601:               ${isoUtc}\n` +
      `Nutze IMMER diese Zeit als Referenz für Reminders, Termine, "morgen", "in 10 Minuten" etc. Niemals raten.\n\n` +
      `## EHRLICHKEITS-REGEL (überschreibt alles andere)\n` +
      `1. WENN du KEIN funktionsfähiges Tool für die Aufgabe hast: sag das ehrlich. NIEMALS "Erledigt!", "Done", "✓ gesetzt", "läuft jetzt" wenn du gar nichts angerufen hast.\n` +
      `2. WENN ein Tool-Call mit Error returnt: zitiere den Error wörtlich oder paraphrasiere knapp. NIEMALS einen erfundenen technischen Grund ("Docker-Problem", "API down", "Cron-Scheduler übernimmt") liefern den du nicht selbst gesehen hast.\n` +
      `3. WENN du unsicher bist ob ein Tool-Call erfolgreich war: sag "Tool hat geantwortet aber ich bin mir nicht sicher ob es geklappt hat — prüf bitte unter /<route>".\n\n` +
      `## REMINDER-TOOL: nutze IMMER lokyy.reminders.create (MCP-Tool)\n` +
      `Lokyy hat einen native MCP-Tool über den MCP-Server "lokyy-system": \`lokyy.reminders.create({text, scheduledAt, channel})\`. \n` +
      `- Wenn User um Reminder/Erinnerung bittet: rufe DIESES Tool auf. NIEMALS curl, NIEMALS terminal/bash/shell — die sind sandbox-bedingt nicht erreichbar.\n` +
      `- scheduledAt parsen aus Lokyy time-context oben + User-Angabe ("in 10 min", "morgen 8 Uhr") zu ISO-8601 UTC.\n` +
      `- Tool returnt {ok, reminder:{id, scheduledAt, channel, status}, note}. Bestätige User KNAPP die Zeit + Channel + bei non-in-app erwähne dass external delivery noch nicht verdrahtet ist.\n` +
      `- Bei Tool-Fehler: zitiere den Fehler + biete /reminders als manuelle Alternative.\n\n` +
      `Diese Regeln sind nicht verhandelbar. Wenn du dich gleich beim Antworten erwischst wie du "Erledigt!" tippen willst ohne ein Tool ausgeführt zu haben: STOPP, schreib die ehrliche Variante.`,
  };
}

// Rewrites a POST /v1/chat/completions body: prepends the time-message
// to the existing messages array. Returns the new body as a Uint8Array
// ready to forward upstream.
async function rewriteChatBody(originalBody: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const text = new TextDecoder().decode(originalBody);
    const obj = JSON.parse(text) as { messages?: Array<unknown> };
    if (!Array.isArray(obj.messages)) return null;
    obj.messages = [buildLokyyGuardrails(), ...obj.messages];
    return new TextEncoder().encode(JSON.stringify(obj));
  } catch {
    return null;
  }
}

hermesStubs.all("/*", async (c) => {
  if (!HERMES_API_KEY) {
    return c.json(
      {
        error: "hermes_not_configured",
        message:
          "HERMES_API_KEY is not set in the lokyy-os-be environment. Re-run `lokyy install` to generate one.",
        phase: "Phase-2a",
        path: c.req.path,
      },
      503
    );
  }

  // Strip the /api/hermes prefix to forward the canonical Hermes path.
  // Example: /api/hermes/v1/chat/completions → /v1/chat/completions
  const apiPath = c.req.path.replace(/^\/api\/hermes/, "") || "/";
  const qs = c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : "";
  const url = HERMES_BASE_URL.replace(/\/$/, "") + apiPath + qs;

  // Forward method, content-type, and Hermes auth.
  const headers = new Headers();
  const ct = c.req.header("content-type");
  if (ct) headers.set("Content-Type", ct);
  headers.set("Authorization", `Bearer ${HERMES_API_KEY}`);

  let body: BodyInit | undefined = undefined;
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const raw = await c.req.raw.arrayBuffer();
    // Time-injection only for the chat-completions endpoint and only when
    // the body parses as JSON with a messages array. For everything else
    // we pass through unchanged.
    if (
      c.req.method === "POST" &&
      apiPath === "/v1/chat/completions" &&
      (ct ?? "").includes("application/json")
    ) {
      const rewritten = await rewriteChatBody(raw);
      body = rewritten ?? raw;
    } else {
      body = raw;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: c.req.method,
      headers,
      body,
      // Hermes streams chat completions via SSE — keep duplex half-open.
      // @ts-expect-error — Bun's fetch supports duplex; @types not aligned.
      duplex: "half",
    });
  } catch (err) {
    return c.json(
      {
        error: "hermes_unreachable",
        message: `Failed to reach Hermes at ${HERMES_BASE_URL}: ${(err as Error).message}`,
        phase: "Phase-2a",
        path: c.req.path,
      },
      503
    );
  }

  // Pass upstream response through unchanged (body, headers, status).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
});
