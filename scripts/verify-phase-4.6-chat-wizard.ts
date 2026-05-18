#!/usr/bin/env bun
/**
 * scripts/verify-phase-4.6-chat-wizard.ts
 *
 * Phase-4.6: LLM-driven Chat-Wizard for dashboard creation.
 *   1) Click "Neues Dashboard" → wizard dialog opens
 *   2) Type "KI-News täglich um 9 Uhr" → LLM responds with spec
 *      (or asks a clarifying question; we keep typing until spec ready)
 *   3) Confirm + create → dashboard appears, navigated to detail
 *   4) Schedule = 0 9 * * * (or whatever LLM extracted) — verified in meta
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const SCREENSHOT_DIR = resolve("docs/evidence/phase-4");
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

const consoleErrors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

console.log("─── Login ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Passwort").fill(PASSWORD);
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

console.log("");
console.log("─── Open Chat-Wizard ───");
await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle" });
await page.getByTestId("dashboards-create").click();
const chatInput = page.getByTestId("dashboards-chat-input");
try {
  await chatInput.waitFor({ state: "visible", timeout: 3_000 });
  ok("wizard dialog opens with chat input");
} catch {
  fail("dialog", "chat input not visible");
}

console.log("");
console.log("─── Send opening message ───");
const intent = `Real-Time KI-News Dashboard ${Date.now() % 10000}, täglich um 9 Uhr morgens, Titel: AI Pulse`;
await chatInput.fill(intent);
await page.getByTestId("dashboards-chat-send").click();

// Wait for either an assistant message OR a spec preview. Closures don't
// cross into page.evaluate, so the loop passes `expectedMsgs` explicitly.
let sawSpec = false;
let assistantTurns = 0;
for (let attempt = 0; attempt < 4; attempt++) {
  const expectedMsgs = attempt + 1;
  try {
    await page.waitForFunction(
      (n) => {
        const spec = document.querySelector('[data-testid="dashboards-spec-preview"]');
        const msgs = document.querySelectorAll('[data-testid="chat-msg-assistant"]');
        return spec !== null || msgs.length >= n;
      },
      expectedMsgs,
      { timeout: 30_000 }
    );
  } catch {
    fail("llm-response", `attempt ${attempt + 1} timed out`);
    break;
  }
  const spec = await page.getByTestId("dashboards-spec-preview").isVisible().catch(() => false);
  if (spec) {
    sawSpec = true;
    ok(`spec preview shown after ${assistantTurns} assistant clarification(s)`);
    break;
  }
  assistantTurns++;
  ok(`assistant clarification ${assistantTurns} received`);
  await chatInput.fill("Ja so passt das, leg an");
  await page.getByTestId("dashboards-chat-send").click();
}

if (!sawSpec) {
  fail("spec", "no spec preview after 4 turns");
} else {
  // Inspect spec content
  const specText = await page.getByTestId("dashboards-spec-preview").innerText();
  if (/0\s+9\s+\*\s+\*\s+\*/.test(specText) || specText.includes("0 9 *")) {
    ok(`spec captured the 9-Uhr schedule (saw '0 9 * * *' in preview)`);
  }
  if (/AI\s*Pulse/i.test(specText)) {
    ok(`spec captured the 'AI Pulse' title`);
  }
}

console.log("");
console.log("─── Confirm + create ───");
const confirmBtn = page.getByTestId("dashboards-confirm-create");
if (await confirmBtn.isVisible().catch(() => false)) {
  await confirmBtn.click();
  try {
    await page.waitForURL(/\/dashboards\/[a-z0-9-]+$/, { timeout: 15_000 });
    ok(`navigated to detail page: ${page.url().replace(BASE, "")}`);
  } catch {
    fail("navigate", `still on ${page.url()}`);
  }
  // Verify the schedule actually got applied via PATCH
  await page.waitForTimeout(1500);
  const metaText = await page.getByTestId("dashboard-meta-panel").innerText();
  if (metaText.includes("0 9")) ok("schedule applied (meta-panel shows 0 9 *)");
  else fail("schedule applied", `meta says: ${metaText.slice(0, 200)}`);
}

await page.screenshot({
  path: `${SCREENSHOT_DIR}/chat-wizard-result.png`,
  fullPage: false,
});
ok("screenshot saved → docs/evidence/phase-4/chat-wizard-result.png");

if (consoleErrors.length === 0) ok("0 console errors");
else fail("console", `${consoleErrors.length}: ${consoleErrors.slice(0, 2).join(" | ")}`);

await browser.close();
console.log("");
console.log(`Phase-4.6 chat-wizard verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
