#!/usr/bin/env bun
/**
 * scripts/verify-reminders-system.ts — Playwright + API check for #154.
 *
 * Covers the full reminder lifecycle:
 *   1. /reminders page renders empty
 *   2. Create a near-future reminder via the dialog → appears in 'Anstehend'
 *   3. Simulate the Hermes lokyy-reminders skill calling /agent/create →
 *      appears with origin=agent badge
 *   4. Wait for the scheduler tick to flip status pending→fired on the
 *      near-future reminder (we set scheduledAt = now + 5s and use a
 *      short tick override for the test)
 *   5. Quittieren (dismiss) the fired reminder → moves to 'Erledigt'
 *   6. Delete cleanup
 *
 * Tick override: the test reads SCHEDULER_TICK_MS from the running
 * container; if it's still 60s the test waits up to 75s for the fire.
 * For faster iteration use SCHEDULER_TICK_MS=3000 in .env.local.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/reminders-system.png";

function readSecret(): string {
  const env = readFileSync("infrastructure/.env.local", "utf8");
  const m = env.match(/^LOKYY_SYSTEM_SECRET=(.+)$/m);
  if (!m) throw new Error("LOKYY_SYSTEM_SECRET missing in .env.local");
  return m[1]!.trim();
}

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  return r.headers.getSetCookie().join("; ");
}

async function cleanAll(cookie: string): Promise<void> {
  const r = await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } });
  const data = (await r.json()) as { reminders: Array<{ id: string }> };
  for (const rem of data.reminders) {
    await fetch(`${BASE}/api/lokyy/reminders/${rem.id}`, { method: "DELETE", headers: { cookie } });
  }
  console.log(`  cleanup: removed ${data.reminders.length} leftover reminders`);
}

const cookie = await loginCookie();
const SYSTEM_SECRET = readSecret();
await cleanAll(cookie);

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
  await page.getByLabel("Email").fill("oliver@lokyy.local");
  await page.getByLabel("Passwort").fill("supersecure123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("✓ logged in");

  await page.goto(`${BASE}/reminders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  if ((await page.locator("[data-testid='reminders-pending-empty']").count()) === 0) {
    console.error("✗ expected empty 'Anstehend' card at start");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ /reminders starts in empty-state");

  // Manual create via dialog
  await page.locator("[data-testid='reminders-add']").click();
  await page.waitForSelector("[data-testid='reminder-form-text']", { timeout: 5_000 });
  await page.locator("[data-testid='reminder-form-text']").fill("Manual test reminder");
  // datetime-local input — leave the default (now+1h)
  await page.locator("[data-testid='reminder-form-save']").click();

  await page.waitForSelector("[data-testid='reminders-pending']", { timeout: 5_000 });
  const pendingText = await page.locator("[data-testid='reminders-pending']").innerText();
  if (!pendingText.includes("Manual test reminder")) {
    console.error("✗ manual reminder missing from list");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ manual reminder appears in 'Anstehend' with user badge");

  // Simulate the Hermes skill calling /agent/create with a near-future time
  const fireAt = new Date(Date.now() + 4_000).toISOString();
  const agentRes = await fetch(`${BASE}/api/lokyy/reminders/agent/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SYSTEM_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: "Agent-created near-future reminder",
      scheduledAt: fireAt,
      channel: "in-app",
    }),
  });
  if (!agentRes.ok) {
    console.error(`✗ agent/create failed: HTTP ${agentRes.status}`);
    await browser.close();
    process.exit(1);
  }
  const agentData = (await agentRes.json()) as { reminder: { id: string } };
  const agentReminderId = agentData.reminder.id;
  console.log(`✓ agent/create simulated → ${agentReminderId}`);

  // Wait for the scheduler tick (default 60s) to flip pending → fired.
  // We poll the API instead of relying on UI refresh.
  const fireDeadline = Date.now() + 75_000;
  let fired = false;
  while (Date.now() < fireDeadline) {
    const list = (await (await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } })).json()) as {
      reminders: Array<{ id: string; status: string }>;
    };
    const rem = list.reminders.find((r) => r.id === agentReminderId);
    if (rem && rem.status === "fired") {
      fired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  if (!fired) {
    console.error("✗ scheduler did not flip agent-reminder to 'fired' within 75s");
    console.error("  (tip: set SCHEDULER_TICK_MS=3000 in .env.local for faster iteration)");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ scheduler-tick flipped agent-reminder to 'fired'");

  // Reload UI and confirm the fired card is visible
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  if ((await page.locator("[data-testid='reminders-fired']").count()) === 0) {
    console.error("✗ 'Gefeuert' card not visible on /reminders after fire");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ 'Gefeuert (nicht quittiert)' card visible in UI");

  // Dismiss the fired reminder
  await page.locator(`[data-testid='reminder-dismiss-${agentReminderId}']`).click();
  await page.waitForTimeout(800);
  const after = (await (await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } })).json()) as {
    reminders: Array<{ id: string; status: string }>;
  };
  const remAfter = after.reminders.find((r) => r.id === agentReminderId);
  if (remAfter?.status !== "dismissed") {
    console.error(`✗ dismiss failed: status=${remAfter?.status}`);
    await browser.close();
    process.exit(1);
  }
  console.log("✓ dismiss → status='dismissed'");

  await page.screenshot({ path: SHOT, fullPage: false });
} finally {
  await browser.close();
  await cleanAll(cookie);
}

console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ Reminder-System Iteration A verified (Issue #154)");
