#!/usr/bin/env bun
/**
 * scripts/audit-2026-05-19.ts
 *
 * Full Playwright-tour through every sidebar route. For each:
 *   - capture URL + console errors
 *   - capture visible body text (first 500 chars) so we can spot stubs
 *   - take a screenshot under docs/evidence/audit-2026-05-19/
 *   - report network responses with non-2xx status
 *
 * Output: docs/evidence/audit-2026-05-19/audit-report.json
 * Plus a markdown summary printable to stdout.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SCREENSHOT_DIR = "docs/evidence/audit-2026-05-19";
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/chat", name: "Chat" },
  { path: "/agents", name: "Agents" },
  { path: "/tasks", name: "Tasks" },
  { path: "/sessions", name: "Sessions" },
  { path: "/jobs", name: "Schedule Jobs" },
  { path: "/dashboards", name: "Dashboards" },
  { path: "/prompts", name: "Prompt Library" },
  { path: "/vault", name: "Second Brain" },
  { path: "/workflows", name: "Workflows" },
  { path: "/teams", name: "Teams" },
  { path: "/integrations", name: "Integrations" },
  { path: "/channels", name: "Channels" },
  { path: "/insights", name: "Insights" },
  { path: "/memory", name: "Memory" },
  { path: "/tools", name: "Tools" },
  { path: "/plugins", name: "Plugins" },
  { path: "/webhooks", name: "Webhooks" },
  { path: "/logs", name: "Logs" },
  { path: "/n8n", name: "n8n" },
  { path: "/settings", name: "Settings" },
];

type Finding = {
  route: string;
  name: string;
  loaded: boolean;
  bodyTextPreview: string;
  consoleErrors: string[];
  networkErrors: Array<{ url: string; status: number }>;
  apiCalls: Array<{ url: string; status: number }>;
  hasEmptyState: boolean;
  hasInitMessage: boolean;
  hasNotDeployedMessage: boolean;
  hasNoDataMessage: boolean;
  ctaButtons: string[];
  screenshotPath: string;
};

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

// Login first
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
console.log("✓ logged in");
console.log("");

const findings: Finding[] = [];

for (const r of ROUTES) {
  console.log(`─── ${r.name} (${r.path}) ───`);
  const consoleErrors: string[] = [];
  const networkErrors: Array<{ url: string; status: number }> = [];
  const apiCalls: Array<{ url: string; status: number }> = [];

  const consoleHandler = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  };
  const responseHandler = (resp: { status(): number; url(): string }) => {
    const url = resp.url();
    const status = resp.status();
    if (url.includes("/api/")) {
      apiCalls.push({ url: url.replace(BASE, ""), status });
      if (status >= 400) networkErrors.push({ url: url.replace(BASE, ""), status });
    }
  };
  page.on("console", consoleHandler);
  page.on("response", responseHandler);

  let loaded = false;
  try {
    await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(1200);
    loaded = true;
  } catch (err) {
    console.log(`  ✗ navigation failed: ${(err as Error).message.slice(0, 100)}`);
  }

  // Capture body text
  let bodyText = "";
  try {
    bodyText = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return (main as HTMLElement).innerText ?? "";
    });
  } catch {
    bodyText = "(could not read)";
  }
  const bodyTextPreview = bodyText.slice(0, 500).replace(/\s+/g, " ").trim();

  // Heuristics for "is this stub?"
  const lower = bodyText.toLowerCase();
  const hasEmptyState = /noch keine|no data|empty|leer|nichts gefunden/i.test(bodyText);
  const hasInitMessage = /init|initializ|wird geladen|loading|lade…|lade …|fetching/i.test(bodyText);
  const hasNotDeployedMessage = /not deployed|nicht deployed|phase-\d|stub|coming soon|kommt sp/i.test(bodyText);
  const hasNoDataMessage = /no data|keine daten|nothing to show/i.test(bodyText);

  // Find buttons / CTAs
  let ctaButtons: string[] = [];
  try {
    ctaButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a[role='button']"));
      return btns
        .map((b) => (b.textContent ?? "").trim())
        .filter((t) => t.length > 0 && t.length < 50)
        .slice(0, 10);
    });
  } catch {}

  const screenshotPath = `${SCREENSHOT_DIR}${r.path}.png`.replace(/\//g, "_").replace("docs_", "docs/");
  try {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${r.name.replace(/[^a-z0-9]/gi, "_")}.png`, fullPage: false });
  } catch {}

  findings.push({
    route: r.path,
    name: r.name,
    loaded,
    bodyTextPreview,
    consoleErrors: consoleErrors.slice(0, 5),
    networkErrors,
    apiCalls,
    hasEmptyState,
    hasInitMessage,
    hasNotDeployedMessage,
    hasNoDataMessage,
    ctaButtons,
    screenshotPath: `${SCREENSHOT_DIR}/${r.name.replace(/[^a-z0-9]/gi, "_")}.png`,
  });

  // Brief summary line
  const flags: string[] = [];
  if (!loaded) flags.push("✗ FAILED");
  if (networkErrors.length > 0) flags.push(`${networkErrors.length} net-err`);
  if (consoleErrors.filter((e) => !/Failed to (?:load resource|fetch)/.test(e)).length > 0) {
    flags.push("console-err");
  }
  if (hasNotDeployedMessage) flags.push("STUB/not-deployed");
  if (hasInitMessage && !hasEmptyState) flags.push("stuck-loading?");
  if (hasEmptyState) flags.push("empty");
  console.log(`  body: "${bodyTextPreview.slice(0, 120)}…"`);
  console.log(`  flags: ${flags.join(", ") || "OK"}`);
  console.log("");

  page.off("console", consoleHandler);
  page.off("response", responseHandler);
}

await browser.close();

// Write findings to JSON
writeFileSync(`${SCREENSHOT_DIR}/audit-report.json`, JSON.stringify(findings, null, 2));

// Write markdown summary
const mdLines: string[] = [];
mdLines.push("# System-Audit 2026-05-19");
mdLines.push("");
mdLines.push("Playwright-tour through every sidebar route. Findings below.");
mdLines.push("");
mdLines.push("## Summary table");
mdLines.push("");
mdLines.push("| Route | Loaded? | Stub? | Empty? | API-fails | Console-errs | CTAs |");
mdLines.push("|---|---|---|---|---|---|---|");
for (const f of findings) {
  const realConsoleErrs = f.consoleErrors.filter((e) => !/Failed to (?:load resource|fetch)/.test(e));
  mdLines.push(
    `| ${f.name} (${f.route}) | ${f.loaded ? "✓" : "✗"} | ${f.hasNotDeployedMessage ? "**YES**" : "no"} | ${f.hasEmptyState ? "yes" : "no"} | ${f.networkErrors.length} | ${realConsoleErrs.length} | ${f.ctaButtons.slice(0, 3).join(" / ") || "-"} |`,
  );
}
mdLines.push("");

mdLines.push("## Per-route detail");
mdLines.push("");
for (const f of findings) {
  mdLines.push(`### ${f.name} (\`${f.route}\`)`);
  mdLines.push("");
  mdLines.push(`**Loaded:** ${f.loaded ? "yes" : "**NO**"}`);
  mdLines.push("");
  mdLines.push(`**Body preview:** ${f.bodyTextPreview.slice(0, 300)}…`);
  mdLines.push("");
  if (f.networkErrors.length > 0) {
    mdLines.push(`**Network errors:**`);
    for (const ne of f.networkErrors.slice(0, 5)) mdLines.push(`- \`${ne.status}\` ${ne.url}`);
    mdLines.push("");
  }
  const realErrs = f.consoleErrors.filter((e) => !/Failed to (?:load resource|fetch)/.test(e));
  if (realErrs.length > 0) {
    mdLines.push(`**Console errors:**`);
    for (const e of realErrs.slice(0, 3)) mdLines.push(`- ${e.slice(0, 200)}`);
    mdLines.push("");
  }
  mdLines.push(`**Indicators:** ${f.hasEmptyState ? "empty " : ""}${f.hasInitMessage ? "init " : ""}${f.hasNotDeployedMessage ? "**stub** " : ""}${f.hasNoDataMessage ? "no-data " : ""}`);
  mdLines.push("");
  mdLines.push(`**Screenshot:** \`${f.screenshotPath}\``);
  mdLines.push("");
}
writeFileSync(`${SCREENSHOT_DIR}/AUDIT.md`, mdLines.join("\n"));

console.log("");
console.log(`✓ ${findings.length} routes audited`);
console.log(`✓ Report: ${SCREENSHOT_DIR}/AUDIT.md`);
console.log(`✓ Raw JSON: ${SCREENSHOT_DIR}/audit-report.json`);

// Count of broken/stub routes
const broken = findings.filter((f) => !f.loaded || f.networkErrors.length > 0).length;
const stubs = findings.filter((f) => f.hasNotDeployedMessage).length;
const emptyCount = findings.filter((f) => f.hasEmptyState).length;
console.log("");
console.log(`Headline: ${broken} broken · ${stubs} stub/not-deployed · ${emptyCount} empty-state`);
