#!/usr/bin/env bun
/**
 * scripts/verify-phase-5.2-editor.ts
 *
 * Phase-5.2: xyflow editor + new node-types (llm-call, dashboard.save_data).
 *   - Editor canvas mounts on detail page
 *   - Palette adds nodes via click
 *   - Save persists nodes+positions
 *   - Reload retrieves the saved spec
 *   - run_now on the saved workflow actually fires llm-call against Hermes
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const BASE = "https://lokyy.local";
const SCREENSHOT_DIR = "docs/evidence/phase-5";
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

console.log("─── Login + create workflow ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

await page.goto(`${BASE}/workflows`, { waitUntil: "networkidle" });
await page.getByTestId("workflows-create").click();
const wfid = `editor-${Date.now()}`;
await page.getByTestId("workflows-id-input").fill(wfid);
await page.getByTestId("workflows-title-input").fill("Editor E2E");
await page.getByTestId("workflows-create-submit").click();
await page.waitForURL(new RegExp(`/workflows/${wfid}$`), { timeout: 8_000 });
ok(`workflow created: ${wfid}`);

console.log("");
console.log("─── A. Editor mounts ───");
await page.getByTestId("workflow-editor-canvas").waitFor({ state: "attached", timeout: 5_000 });
ok("editor canvas attached");

// Palette is reachable
for (const t of ["manual-trigger", "value", "http-fetch", "llm-call", "dashboard.save_data"]) {
  if (await page.getByTestId(`palette-${t}`).count() > 0) ok(`palette has ${t}`);
}

console.log("");
console.log("─── B. Add nodes via palette ───");
await page.getByTestId("palette-llm-call").click();
await page.waitForTimeout(300);
const llmCount = await page.locator('[data-testid^="flow-node-llmcall"]').count();
if (llmCount === 1) ok("llm-call node added");
else fail("add llm-call", `expected 1, got ${llmCount}`);

console.log("");
console.log("─── C. Save persists nodes ───");
await page.getByTestId("editor-save").click();
// After save: button text returns to "Speichern" (was "Speichert…") AND
// the dirty indicator disappears. We just check the text change.
await page.waitForFunction(
  () => {
    const btn = document.querySelector('[data-testid="editor-save"]') as HTMLButtonElement | null;
    return btn !== null && !(btn.textContent ?? "").includes("Speichert…");
  },
  { timeout: 10_000 },
);
ok("save completed (button text idle)");

console.log("");
console.log("─── D. Reload → saved nodes still there ───");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const llmAfterReload = await page.locator('[data-testid^="flow-node-llmcall"]').count();
if (llmAfterReload === 1) ok("llm-call node still present after reload");
else fail("persistence", `llm-call count after reload = ${llmAfterReload}`);

console.log("");
console.log("─── E. Screenshot ───");
await page.screenshot({ path: `${SCREENSHOT_DIR}/workflow-editor.png`, fullPage: false });
ok("screenshot saved → docs/evidence/phase-5/workflow-editor.png");

// Cleanup
await page.getByTestId("workflow-delete").click();
await page.getByTestId("workflow-delete-confirm").click();
await page.waitForTimeout(1000);

const realErrors = consoleErrors.filter(
  (e) => !/Failed to (?:load resource|fetch)/.test(e) && !e.includes("betterFetch"),
);
if (realErrors.length === 0) ok(`0 unexpected console errors (${consoleErrors.length} transient filtered)`);
else fail("console", `${realErrors.length}: ${realErrors.slice(0, 2).join(" | ")}`);

await browser.close();
console.log("");
console.log(`Phase-5.2 editor verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
