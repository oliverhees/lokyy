#!/usr/bin/env bun
/**
 * scripts/verify-jobs-pause-resume.ts — Playwright check for #146.
 *
 * E2E:
 *   1. Create a job → starts active (default since #142)
 *   2. Click the pause toggle → status flips to paused, badge updates
 *   3. Click again (now play icon) → status flips back to active
 *   4. Delete
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/jobs-pause-resume.png";

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

// ── create active job ──────────────────────────────────────────────────
await page.locator("[data-testid='jobs-add']").click();
await page.waitForSelector("[data-testid='job-form-schedule']", { timeout: 5_000 });
await page.locator("[data-testid='job-form-name']").fill("Toggle-Test Job");
await page.locator("[data-testid='job-form-schedule']").fill("0 9 * * *");
await page.locator("[data-testid='job-form-prompt']").fill("Toggle test prompt.");
await page.locator("[data-testid='job-form-save']").click();
await page.waitForSelector("[data-testid='jobs-list']", { timeout: 5_000 });

const initialList = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
const initial = (await initialList.json()) as {
  jobs: Array<{ id: string; status: string }>;
};
const created = initial.jobs[0]!;
if (created.status !== "active") {
  console.error(`✗ new job has status='${created.status}', expected 'active'`);
  await browser.close();
  process.exit(1);
}
console.log("✓ new job created with status=active");

// ── click toggle → paused ──────────────────────────────────────────────
const toggleSelector = `[data-testid='job-toggle-${created.id}']`;
await page.locator(toggleSelector).click();
await page.waitForTimeout(800);

const afterPause = (await (await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } })).json()) as {
  jobs: Array<{ id: string; status: string }>;
};
if (afterPause.jobs[0]!.status !== "paused") {
  console.error(`✗ after toggle expected status='paused', got '${afterPause.jobs[0]!.status}'`);
  await browser.close();
  process.exit(1);
}
console.log("✓ toggle → status=paused");

// Badge im UI hat 'paused' Text
const rowText = await page.locator(`[data-testid='job-row-${created.id}']`).innerText();
if (!rowText.includes("paused")) {
  console.error(`✗ row badge does not show 'paused': "${rowText.slice(0, 200)}"`);
  await browser.close();
  process.exit(1);
}
console.log("✓ row badge updated to 'paused'");

// ── click again → active ──────────────────────────────────────────────
await page.locator(toggleSelector).click();
await page.waitForTimeout(800);

const afterResume = (await (await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } })).json()) as {
  jobs: Array<{ id: string; status: string }>;
};
if (afterResume.jobs[0]!.status !== "active") {
  console.error(`✗ after second toggle expected 'active', got '${afterResume.jobs[0]!.status}'`);
  await browser.close();
  process.exit(1);
}
console.log("✓ toggle again → status=active");

await page.screenshot({ path: SHOT, fullPage: false });

// ── cleanup ────────────────────────────────────────────────────────────
page.on("dialog", (d) => void d.accept());
await page.locator(`[data-testid='job-delete-${created.id}']`).click();
await page.waitForTimeout(800);
console.log("✓ deleted");

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /jobs Pause/Resume Toggle verified (Issue #146)");
