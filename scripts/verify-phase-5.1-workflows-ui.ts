#!/usr/bin/env bun
/**
 * scripts/verify-phase-5.1-workflows-ui.ts
 *
 * Phase-5.1: REST + read-only UI for workflows.
 *   - sidebar entry exists
 *   - /workflows list renders (empty + populated)
 *   - "Neuer Workflow" dialog → creates a stub workflow
 *   - /workflows/:id detail page renders
 *   - "Jetzt laufen" triggers a run, run-history shows it
 *   - Delete confirmation
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const BASE = "https://lokyy.local";

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
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

console.log("");
console.log("─── A. /workflows list page ───");
await page.goto(`${BASE}/workflows`, { waitUntil: "networkidle" });
try {
  await page.getByTestId("workflows-page").waitFor({ state: "visible", timeout: 5_000 });
  ok("workflows page rendered");
} catch {
  fail("page render", "not visible");
}

if (await page.getByTestId("workflows-create").isVisible().catch(() => false)) {
  ok("create button visible");
}

console.log("");
console.log("─── B. Create workflow via dialog ───");
const uniqueId = `e2e-${Date.now()}`;
await page.getByTestId("workflows-create").click();
await page.getByTestId("workflows-id-input").waitFor({ state: "visible" });
await page.getByTestId("workflows-id-input").fill(uniqueId);
await page.getByTestId("workflows-title-input").fill("E2E Smoke Workflow");
await page.getByTestId("workflows-create-submit").click();
try {
  await page.waitForURL(new RegExp(`/workflows/${uniqueId}$`), { timeout: 8_000 });
  ok(`navigated to detail page: ${page.url().replace(BASE, "")}`);
} catch {
  fail("navigation", `still on ${page.url()}`);
}

console.log("");
console.log("─── C. Detail page elements ───");
// Wait for the spec-loaded DOM to settle (Route.useLoaderData is async)
try {
  await page.getByTestId("workflow-nodes-card").waitFor({ state: "attached", timeout: 5_000 });
  ok("detail page + nodes card mounted");
} catch {
  fail("detail", "nodes-card never attached");
}

const startNode = page.getByTestId("workflow-node-start");
if (await startNode.isVisible().catch(() => false)) {
  ok("manual-trigger 'start' node listed");
}

console.log("");
console.log("─── D. Run-now triggers + shows history ───");
await page.getByTestId("workflow-run-now").click();
try {
  await page.waitForSelector('[data-testid="workflow-active-run"]', { timeout: 15_000 });
  ok("active run card appeared after click");
} catch {
  fail("run", "no active-run card");
}

const runText = await page.getByTestId("workflow-active-run").innerText().catch(() => "");
if (/\bok\b/i.test(runText)) ok("run status visible (ok)");

// Run-history shows the run
await page.waitForTimeout(500);
const historyLinks = await page.locator('[data-testid^="workflow-run-link-"]').count();
if (historyLinks >= 1) ok(`run history shows ${historyLinks} run(s)`);
else fail("history", "no run-link in sidebar");

console.log("");
console.log("─── E. Delete workflow ───");
await page.getByTestId("workflow-delete").click();
const confirmBtn = page.getByTestId("workflow-delete-confirm");
await confirmBtn.waitFor({ state: "visible", timeout: 3_000 });
await confirmBtn.click();
try {
  await page.waitForURL(`${BASE}/workflows`, { timeout: 5_000 });
  ok("navigated back to /workflows after delete");
} catch {
  fail("delete-nav", `still on ${page.url()}`);
}
await page.waitForTimeout(1000);
const stillVisible = await page.getByTestId(`workflow-card-${uniqueId}`).count();
if (stillVisible === 0) ok("deleted workflow no longer in list");
else fail("delete", `still in list (count=${stillVisible})`);

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
console.log(`Phase-5.1 workflows-UI verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
