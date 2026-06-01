#!/usr/bin/env bun
/**
 * scripts/verify-path-c-mcp-reminder.ts — Path C Done-Gate (Etappe 2).
 *
 * Verifies the full chain:
 *   Chat → api_server agent-loop → Claude tool_use
 *        → mcp_lokyy_system_lokyy_reminders_create (MCP, Streamable HTTP)
 *        → lokyy-os-be /api/lokyy/reminders/agent/create
 *        → SQLite row with origin='agent'.
 *
 * Steps:
 *   1. Login as Oliver via /api/auth/sign-in/email → cookie.
 *   2. Cleanup: DELETE any reminders whose text matches /PathC-Verify-Test/i.
 *   3. POST /api/hermes/v1/chat/completions with a user message that asks
 *      the agent to use the MCP tool. Expect HTTP 200 + non-empty assistant
 *      content. (The backend stub forwards to lokyy-hermes:8642 and injects
 *      HERMES_API_KEY itself — we don't have to send the bearer.)
 *   4. Poll GET /api/lokyy/reminders for up to 12 s. Pass requires a row
 *      with text ~ /PathC-Verify-Test/i AND origin === 'agent'.
 *   5. Take Playwright screenshot of /reminders (evidence per Etappe-2 Done-Gate).
 *   6. Cleanup: DELETE the test reminder.
 *
 * Run:  bunx tsx scripts/verify-path-c-mcp-reminder.ts
 *       (or just `bun scripts/verify-path-c-mcp-reminder.ts` — bun reads .ts directly)
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const MARKER = "PathC-Verify-Test";
const ISO_DATE = new Date().toISOString().slice(0, 10);
const SHOT_DIR = "docs/evidence/path-c";
const SHOT = `${SHOT_DIR}/agent-creates-reminder-${ISO_DATE}.png`;

type Reminder = {
  id: string;
  text: string;
  origin: "user" | "agent";
  status: string;
};

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: HTTP ${r.status}`);
  return r.headers.getSetCookie().join("; ");
}

async function listReminders(cookie: string): Promise<Reminder[]> {
  const r = await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } });
  if (!r.ok) throw new Error(`list reminders failed: HTTP ${r.status}`);
  const data = (await r.json()) as { reminders: Reminder[] };
  return data.reminders;
}

async function deleteReminder(cookie: string, id: string): Promise<void> {
  await fetch(`${BASE}/api/lokyy/reminders/${id}`, {
    method: "DELETE",
    headers: { cookie },
  });
}

async function cleanupMarker(cookie: string): Promise<number> {
  const all = await listReminders(cookie);
  const targets = all.filter((r) => /PathC-Verify-Test/i.test(r.text));
  for (const t of targets) await deleteReminder(cookie, t.id);
  return targets.length;
}

async function fail(msg: string, page?: Page, ctx?: BrowserContext): Promise<never> {
  console.error(`✗ ${msg}`);
  if (page) {
    try {
      mkdirSync(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: `${SHOT_DIR}/FAIL-${ISO_DATE}.png`, fullPage: true });
      console.error(`  failure screenshot: ${SHOT_DIR}/FAIL-${ISO_DATE}.png`);
    } catch {
      /* ignore */
    }
  }
  if (ctx) await ctx.close();
  process.exit(1);
}

async function tailHermesLog(lines = 30): Promise<string> {
  try {
    const proc = Bun.spawnSync([
      "docker",
      "exec",
      "lokyy-hermes",
      "tail",
      `-n`,
      String(lines),
      "/opt/data/logs/agent.log",
    ]);
    return new TextDecoder().decode(proc.stdout);
  } catch {
    return "(could not read agent.log)";
  }
}

mkdirSync(SHOT_DIR, { recursive: true });

const cookie = await loginCookie();
console.log("✓ logged in");

const removed = await cleanupMarker(cookie);
if (removed > 0) console.log(`  cleanup: removed ${removed} stale ${MARKER} reminder(s)`);

const userPrompt = `Erinnere mich in 6 Minuten an ${MARKER}. Setze den Reminder via das MCP-Tool, nicht /reminders manuell.`;

const chatRes = await fetch(`${BASE}/api/hermes/v1/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: userPrompt }],
    stream: false,
    max_tokens: 800,
  }),
});

if (!chatRes.ok) {
  console.error(`  chat HTTP ${chatRes.status}`);
  console.error(`  body: ${(await chatRes.text()).slice(0, 400)}`);
  await fail("chat completion request failed");
}

const chatBody = (await chatRes.json()) as {
  choices?: Array<{ message?: { content?: string } }>;
};
const assistantReply = chatBody.choices?.[0]?.message?.content ?? "";
if (!assistantReply.trim()) {
  await fail("chat returned empty assistant content");
}
console.log(`✓ chat 200 — assistant: "${assistantReply.slice(0, 80).replace(/\n/g, " ")}…"`);

let agentReminder: Reminder | undefined;
const deadline = Date.now() + 12_000;
while (Date.now() < deadline) {
  const all = await listReminders(cookie);
  agentReminder = all.find(
    (r) => /PathC-Verify-Test/i.test(r.text) && r.origin === "agent",
  );
  if (agentReminder) break;
  await new Promise((r) => setTimeout(r, 1_000));
}

if (!agentReminder) {
  console.error(`  assistant reply was: "${assistantReply.slice(0, 300)}"`);
  console.error(`  recent agent.log tail:\n${await tailHermesLog(40)}`);
  await fail("no reminder with origin=agent + marker appeared within 12 s");
}

console.log(`✓ reminder created: id=${agentReminder.id} origin=${agentReminder.origin} text="${agentReminder.text.slice(0, 60)}"`);

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto(`${BASE}/reminders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const pendingText = await page
    .locator("[data-testid='reminders-pending']")
    .innerText()
    .catch(() => "");
  if (!pendingText.includes(MARKER)) {
    await fail(`reminder visible in API but not in 'Anstehend' card UI`, page, ctx);
  }
  console.log("✓ reminder visible in /reminders UI (Anstehend card)");

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`✓ screenshot: ${SHOT}`);
} finally {
  await ctx.close();
  await browser.close();
}

await deleteReminder(cookie, agentReminder.id);
console.log("✓ cleanup: test reminder deleted");

console.log("\n✅ Path C verified end-to-end — chat → MCP tool → DB row origin=agent → UI visible");
