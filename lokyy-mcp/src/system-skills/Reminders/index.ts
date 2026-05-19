/**
 * MCP-Tool für Reminders — Issue #158 (Path C).
 *
 * Surface:
 *   lokyy.reminders.create({ text, scheduledAt, channel? }) →
 *     { ok, reminder: { id, scheduledAt, channel, status } }
 *
 * Implementation: thin wrapper around the lokyy-os-be HTTP endpoint
 *   POST http://lokyy-os-be/api/lokyy/reminders/agent/create
 * which already exists (#155) and is gated by LOKYY_SYSTEM_SECRET.
 * We use the same system-bearer that lokyy-mcp itself holds — both
 * containers share the secret via .env.local.
 *
 * Privilege: system-only. The MCP-Client (Hermes) authenticates to
 * lokyy-mcp via system-bearer at the MCP-server layer; from there
 * any tool inside this registry is reachable.
 */
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Principal } from "../../auth.ts";

const LOKYY_OS_BE_URL =
  process.env.LOKYY_OS_BE_URL ?? "http://lokyy-os-be";
const LOKYY_SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

const VALID_CHANNELS = ["in-app", "telegram", "email", "calendar"] as const;
type Channel = (typeof VALID_CHANNELS)[number];

export const tool: Tool = {
  name: "lokyy.reminders.create",
  description:
    "Lege eine ein-malige Erinnerung an, die zum angegebenen Zeitpunkt feuert. " +
    "Nutze IMMER dieses Tool wenn der User um eine Erinnerung bittet ('erinnere mich', " +
    "'remind me', 'setze eine Erinnerung'). Parse natürliche Zeitangaben in der Zeitzone " +
    "Europe/Berlin (oder der in der Lokyy time-context-Message angegebenen) zu einer " +
    "ISO-8601-UTC Timestamp. Channel: 'in-app' (default, Toast im Browser), 'telegram', " +
    "'email', 'calendar' (letzte drei: Delivery ist noch nicht verdrahtet, fired wird " +
    "aber trotzdem korrekt). Bei Erfolg returnt das Tool die Reminder-ID — bestätige " +
    "dem User die geparste Zeit + Channel, damit er Fehler korrigieren kann.",
  inputSchema: {
    type: "object",
    required: ["text", "scheduledAt"],
    properties: {
      text: {
        type: "string",
        minLength: 1,
        description: "Worauf soll der User erinnert werden? Knapp + konkret.",
      },
      scheduledAt: {
        type: "string",
        description:
          "ISO-8601 UTC-Timestamp wann gefeuert wird, z.B. '2026-05-19T19:30:00Z'.",
      },
      channel: {
        type: "string",
        enum: ["in-app", "telegram", "email", "calendar"],
        description:
          "Default 'in-app'. Wenn USER.md eine Preference hat, nutze die. " +
          "telegram/email/calendar werden gespeichert + gefeuert, aber Delivery " +
          "ist noch nicht verdrahtet (sag das dem User).",
      },
    },
  },
};

type Args = { text?: unknown; scheduledAt?: unknown; channel?: unknown };

export async function handle(
  args: unknown,
  _principal: Principal,
): Promise<unknown> {
  const a = (args ?? {}) as Args;
  const text = typeof a.text === "string" ? a.text.trim() : "";
  const scheduledAt = typeof a.scheduledAt === "string" ? a.scheduledAt.trim() : "";
  const channel: Channel =
    typeof a.channel === "string" && (VALID_CHANNELS as readonly string[]).includes(a.channel)
      ? (a.channel as Channel)
      : "in-app";

  if (!text) throw new Error("lokyy.reminders.create: 'text' (non-empty string) required");
  if (!scheduledAt) throw new Error("lokyy.reminders.create: 'scheduledAt' (ISO-8601 string) required");
  if (!Number.isFinite(Date.parse(scheduledAt))) {
    throw new Error(`lokyy.reminders.create: 'scheduledAt' is not a valid ISO timestamp: ${scheduledAt}`);
  }
  if (!LOKYY_SYSTEM_SECRET) {
    throw new Error("lokyy.reminders.create: LOKYY_SYSTEM_SECRET missing in lokyy-mcp env");
  }

  const r = await fetch(`${LOKYY_OS_BE_URL}/api/lokyy/reminders/agent/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOKYY_SYSTEM_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, scheduledAt, channel }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`lokyy-os-be reminders.create failed: HTTP ${r.status} ${body.slice(0, 200)}`);
  }
  const data = (await r.json()) as { reminder?: { id: string; scheduledAt: string; channel: string; status: string } };
  if (!data.reminder) throw new Error("lokyy-os-be returned no reminder object");

  // Return a compact summary the LLM can format back to the user.
  return {
    ok: true,
    reminder: {
      id: data.reminder.id,
      scheduledAt: data.reminder.scheduledAt,
      channel: data.reminder.channel,
      status: data.reminder.status,
    },
    note:
      channel !== "in-app"
        ? `Reminder gespeichert + wird gefeuert, aber external delivery (${channel}) ist noch nicht verdrahtet — User sieht's unter /reminders.`
        : "In-app: User sieht beim Fire-Zeitpunkt einen Toast wenn der Browser offen ist, sonst eine Zeile unter /reminders.",
  };
}
