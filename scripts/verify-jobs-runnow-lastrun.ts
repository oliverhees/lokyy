#!/usr/bin/env bun
/**
 * scripts/verify-jobs-runnow-lastrun.ts — Playwright check for #148.
 *
 * E2E:
 *   1. Create a fresh job (no lastRun yet)
 *   2. Verify NO 'zuletzt:' line is rendered initially
 *   3. Click the lightning 'Run now' button
 *   4. Verify the API call set lastRun
 *   5. Verify the UI now shows 'zuletzt: gerade eben'
 *   6. Cleanup
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/jobs-runnow-lastrun.png";

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  return r.headers.getSetCookie().join("; ");
}

async function cleanLeftovers(cookie: string): Promise<void> {
  const list = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
  const data = (await list.json()) as { jobs: Array<{ id: string }> };
  for (const j of data.jobs) {
    await fetch(`${BASE}/api/lokyy/jobs/${j.id}`, { method: "DELETE", headers: { cookie } });
  }
  console.log(`  cleanup: removed ${data.jobs.length} leftover jobs`);
}

const cookie = await loginCookie();
await cleanLeftovers(cookie);

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("oliver@lokyy.local");
await page.getByLabel("Passwort").fill("supersecure123");
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });
console.log("✓ logged in");

await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// ── create job ─────────────────────────────────────────────────────────
await page.locator("[data-testid='jobs-add']").click();
await page.waitForSelector("[data-testid='job-form-schedule']", { timeout: 5_000 });
await page.locator("[data-testid='job-form-name']").fill("Run-Now-Test");
await page.locator("[data-testid='job-form-schedule']").fill("0 9 * * *");
await page.locator("[data-testid='job-form-prompt']").fill("Run-now verification prompt.");
await page.locator("[data-testid='job-form-save']").click();
await page.waitForSelector("[data-testid='jobs-list']", { timeout: 5_000 });

const list = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
const data = (await list.json()) as {
  jobs: Array<{ id: string; lastRun?: string }>;
};
const created = data.jobs[0]!;
if (created.lastRun) {
  console.error(`✗ fresh job already has lastRun: ${created.lastRun}`);
  await browser.close();
  process.exit(1);
}
console.log("✓ fresh job has no lastRun yet");

// 'zuletzt:' should NOT appear yet
const lastRunSel = `[data-testid='job-lastrun-${created.id}']`;
if ((await page.locator(lastRunSel).count()) !== 0) {
  console.error("✗ 'zuletzt:' line rendered before any run");
  await browser.close();
  process.exit(1);
}
console.log("✓ no 'zuletzt:' line rendered yet");

// ── click Run now ──────────────────────────────────────────────────────
await page.locator(`[data-testid='job-runnow-${created.id}']`).click();

// Wait for the API to settle the lastRun timestamp
await page.waitForFunction(
  async (url) => {
    const r = await fetch(url);
    const j = (await r.json()) as { jobs: Array<{ lastRun?: string }> };
    return Boolean(j.jobs[0]?.lastRun);
  },
  `${BASE}/api/lokyy/jobs`,
  { timeout: 10_000 },
);

const afterRun = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
const afterData = (await afterRun.json()) as {
  jobs: Array<{ id: string; lastRun?: string }>;
};
if (!afterData.jobs[0]!.lastRun) {
  console.error("✗ lastRun still not set after Run-now click");
  await browser.close();
  process.exit(1);
}
console.log(`✓ lastRun stamped (${afterData.jobs[0]!.lastRun})`);

// FE refresh fires inside onRunNow's finally — give it room for the Hermes
// call to complete (5-30s with key set) plus the React re-render.
await page.waitForSelector(lastRunSel, { timeout: 35_000 });
const lastRunText = await page.locator(lastRunSel).innerText();
if (!/zuletzt:.*(gerade eben|vor \d+ min)/i.test(lastRunText)) {
  console.error(`✗ 'zuletzt:' line text unexpected: "${lastRunText}"`);
  await browser.close();
  process.exit(1);
}
console.log(`✓ row shows: "${lastRunText.trim()}"`);

await page.screenshot({ path: SHOT, fullPage: false });

// ── cleanup ────────────────────────────────────────────────────────────
page.on("dialog", (d) => void d.accept());
await page.locator(`[data-testid='job-delete-${created.id}']`).click();
await page.waitForTimeout(800);

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /jobs Run-now + lastRun verified (Issue #148)");
