#!/usr/bin/env bun
/**
 * scripts/verify-phase-4-ui.ts
 *
 * Phase-4 ISC-93–96 verification: lokyy-app sidebar entry, /dashboards
 * list, detail page with iframe + meta panel, chat-wizard creation
 * flow.
 *
 * Distinct from verify-phase-4-mcp-skeleton.ts (which exercises the
 * backend MCP surface). This script runs against the real Docker stack
 * via Playwright + a host-resolver rule so we can hit https://lokyy.local.
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
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
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

// ─── Login ─────────────────────────────────────────────────────────────────
console.log("─── Login ───");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Passwort").fill(PASSWORD);
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
ok("logged in");

// ─── A. Sidebar entry (ISC-93) ─────────────────────────────────────────────
console.log("");
console.log("─── A. Sidebar 'Dashboards' entry ───");
const sidebarLink = page.getByRole("link", { name: /Dashboards/, exact: false }).first();
try {
  await sidebarLink.waitFor({ state: "visible", timeout: 5_000 });
  ok("sidebar link visible");
} catch {
  fail("sidebar link", "not visible");
}

// ─── B. List page (ISC-94) ─────────────────────────────────────────────────
console.log("");
console.log("─── B. /dashboards list page ───");
await page.goto(`${BASE}/dashboards`, { waitUntil: "networkidle" });
const listPage = page.getByTestId("dashboards-page");
try {
  await listPage.waitFor({ state: "visible", timeout: 5_000 });
  ok("/dashboards page rendered");
} catch {
  fail("/dashboards page", "did not render");
}

// Create button visible
const createBtn = page.getByTestId("dashboards-create");
if (await createBtn.isVisible().catch(() => false)) ok("'Neues Dashboard' button visible");
else fail("create button", "not visible");

// Either empty state OR grid is shown (any existing dashboards from earlier ops)
const empty = await page.getByTestId("dashboards-empty").isVisible().catch(() => false);
const grid = await page.getByTestId("dashboards-grid").isVisible().catch(() => false);
if (empty || grid) {
  ok(empty ? "empty state shown (no dashboards yet)" : "grid shown with existing dashboards");
} else {
  fail("list view", "neither empty state nor grid is visible");
}

// ─── C. Chat-Wizard creation flow (ISC-96) ─────────────────────────────────
console.log("");
console.log("─── C. Create dashboard via dialog ───");
const uniqueIntent = `KI-News E2E ${Date.now()}`;
await createBtn.click();
const intentInput = page.getByTestId("dashboards-intent-input");
await intentInput.waitFor({ state: "visible", timeout: 3_000 });
ok("create-dialog opens");
await intentInput.fill(uniqueIntent);
await page.getByTestId("dashboards-create-submit").click();
// Wait for navigation to /dashboards/<id>
try {
  await page.waitForURL(/\/dashboards\/[a-z0-9-]+$/, { timeout: 15_000 });
  ok(`navigated to detail page: ${page.url().replace(BASE, "")}`);
} catch {
  fail("navigate to detail", `still on ${page.url()}`);
}

// ─── D. Detail page (ISC-94 + ISC-95) ──────────────────────────────────────
console.log("");
console.log("─── D. Detail page — iframe + meta-panel ───");
const detailPage = page.getByTestId("dashboard-detail-page");
try {
  await detailPage.waitFor({ state: "visible", timeout: 5_000 });
  ok("detail page mounted");
} catch {
  fail("detail mounted", "not visible");
}

const metaPanel = page.getByTestId("dashboard-meta-panel");
if (await metaPanel.isVisible().catch(() => false)) ok("meta-panel visible");
else fail("meta-panel", "not visible");

const iframe = page.getByTestId("dashboard-iframe");
if (await iframe.isVisible().catch(() => false)) {
  ok("iframe element rendered");
  const sandboxAttr = await iframe.getAttribute("sandbox");
  // ISC-95: scripts must run; popups allowed so 'Weiterlesen' links work;
  // popups escape sandbox so the external site isn't crippled. No
  // same-origin and no top-navigation — those would break the isolation.
  const expectedFlags = ["allow-scripts", "allow-popups", "allow-popups-to-escape-sandbox"];
  const actualFlags = (sandboxAttr ?? "").split(/\s+/).filter(Boolean);
  const forbidden = ["allow-same-origin", "allow-top-navigation"].filter((f) =>
    actualFlags.includes(f)
  );
  const missing = expectedFlags.filter((f) => !actualFlags.includes(f));
  if (missing.length === 0 && forbidden.length === 0) {
    ok(`iframe sandbox flags valid: '${sandboxAttr}'`);
  } else {
    fail("iframe sandbox", `missing ${missing.join(",")} / forbidden ${forbidden.join(",")}`);
  }
} else {
  fail("iframe", "not visible");
}

// Iframe content actually loaded? Check inner-frame title.
const frame = page.frame({ name: undefined, url: /dashboards\/.*\/view$/ });
if (frame) {
  const innerTitle = await frame.title();
  if (innerTitle.includes("Lokyy")) ok(`iframe loaded view: '${innerTitle}'`);
  else fail("iframe content", `unexpected title: ${innerTitle}`);
}

await page.screenshot({
  path: `${SCREENSHOT_DIR}/dashboards-detail.png`,
  fullPage: false,
});
ok(`screenshot saved → docs/evidence/phase-4/dashboards-detail.png`);

// ─── Console errors ────────────────────────────────────────────────────────
console.log("");
console.log("─── Console health ───");
if (consoleErrors.length === 0) {
  ok("0 console errors");
} else {
  fail("console errors", `${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")}`);
}

await browser.close();

console.log("");
console.log(`Phase-4 UI verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
