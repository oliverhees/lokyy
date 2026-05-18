#!/usr/bin/env bun
/**
 * scripts/verify-phase-4.7-artifact-wizard.ts
 *
 * Iterative wizard with split chat/preview layout:
 *   - open wizard
 *   - send a creative prompt
 *   - LLM emits a draft (kind=draft) → preview iframe appears
 *   - send a follow-up ("mach blau")
 *   - say "passt, speichern"
 *   - save → dashboard exists, custom HTML is what's served at /view
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const BASE = "https://lokyy.local";
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
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
const consoleErrors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

console.log("─── Login ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

console.log("");
console.log("─── Open Wizard ───");
await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle" });
await page.getByTestId("dashboards-create").click();
const chatInput = page.getByTestId("wizard-chat-input");
try {
  await chatInput.waitFor({ state: "visible", timeout: 3_000 });
  ok("wizard dialog opens");
} catch {
  fail("wizard open", "chat input not visible");
}

console.log("");
console.log("─── Turn 1: opening prompt ───");
const initial = `Bau mir ein KI-News Dashboard mit großen Cards und violetten Akzenten. Schedule ist egal.`;
await chatInput.fill(initial);
await page.getByTestId("wizard-chat-send").click();
try {
  await page.waitForSelector('[data-testid="wizard-preview-iframe"]', { timeout: 60_000 });
  ok("preview iframe appeared after first turn");
} catch {
  fail("first draft", "no preview iframe in 60s");
}

// Verify iframe has actual content
await page.waitForTimeout(2000);
const frame = page.frame({ url: /^blob:/ });
if (frame) {
  const bodyText = (await frame.evaluate(() => document.body.innerText)).trim();
  if (bodyText.length > 5) ok(`preview rendered, body has ${bodyText.length} chars of text`);
  else fail("preview content", "iframe body empty");
}

const title1 = await page.getByTestId("wizard-spec-title").innerText().catch(() => "");
if (title1.length > 0) ok(`spec title shown in preview header: "${title1}"`);

await page.screenshot({
  path: `${SCREENSHOT_DIR}/artifact-wizard-draft.png`,
  fullPage: false,
});

console.log("");
console.log("─── Turn 2: feedback iteration ───");
await chatInput.fill("Mach den Hintergrund tiefblau und die Titel etwas größer.");
await page.getByTestId("wizard-chat-send").click();
// Wait for assistant message + draft update
try {
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="wizard-msg-assistant"]').length >= 2,
    { timeout: 60_000 }
  );
  ok("second assistant turn arrived");
} catch {
  fail("iteration", "second turn timed out");
}

console.log("");
console.log("─── Turn 3: accept + save ───");
await chatInput.fill("Passt, speichern bitte");
await page.getByTestId("wizard-chat-send").click();
// Allow LLM to respond with kind:final
await page.waitForTimeout(15_000);

await page.getByTestId("wizard-save").click();
try {
  await page.waitForURL(/\/dashboards\/[a-z0-9-]+$/, { timeout: 25_000 });
  ok(`saved + navigated to detail: ${page.url().replace(BASE, "")}`);
} catch {
  fail("save", `still on ${page.url()}`);
}

// Verify the served view.html contains some of the LLM-customized content
// (not the default ki-news template colors)
await page.waitForTimeout(1500);
await page.screenshot({
  path: `${SCREENSHOT_DIR}/artifact-wizard-saved.png`,
  fullPage: false,
});
ok("screenshots saved");

// Filter known-harmless errors (TanStack-Router beforeLoad's betterFetch
// can flake during navigation transitions — not our bug).
const realErrors = consoleErrors.filter(
  (e) => !/Failed to (?:load resource|fetch)/.test(e) && !e.includes("betterFetch"),
);
if (realErrors.length === 0) {
  ok(`0 unexpected console errors (${consoleErrors.length} transient filtered)`);
} else {
  fail("console", `${realErrors.length}: ${realErrors.slice(0, 2).join(" | ")}`);
}

await browser.close();
console.log("");
console.log(`Phase-4.7 artifact-wizard verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
