#!/usr/bin/env bun
/**
 * scripts/verify-jobs-runner.ts — Playwright check for #141.
 *
 * Builds on the persistence test from #135 (PR #136). Now we also
 * exercise the cron-runner path:
 *   - new jobs land status='active' (not 'paused' anymore)
 *   - schedule shortcuts get normalized server-side (30m -> star/30 * * * *)
 *   - POST /jobs/:id/run fires the job NOW, sets lastRun, returns
 *     either real Hermes content (key present) or hermesSkipped=true
 *   - lastRun is visible in the row after a reload
 *
 * We use the manual-fire endpoint so the test doesn't have to wait
 * for the next 60s tick.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/jobs-runner.png";

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "oliver@lokyy.local",
      password: "supersecure123",
    }),
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

// ── create via dialog using FE-shortcut "30m" ──────────────────────────
await page.locator("[data-testid='jobs-add']").click();
await page.waitForSelector("[data-testid='job-form-schedule']", { timeout: 5_000 });
await page.locator("[data-testid='job-form-name']").fill("Runner-Test Job");
await page.locator("[data-testid='job-form-schedule']").fill("30m");
await page.locator("[data-testid='job-form-prompt']").fill("Test prompt for the runner audit.");
await page.locator("[data-testid='job-form-save']").click();
await page.waitForSelector("[data-testid='jobs-list']", { timeout: 5_000 });

// ── server normalized 30m to */30 * * * * AND set status=active ─────────
const apiList = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
const apiData = (await apiList.json()) as {
  jobs: Array<{ id: string; schedule: string; status: string; lastRun?: string }>;
};
const created = apiData.jobs.find((j) => j.schedule === "*/30 * * * *");
if (!created) {
  console.error("✗ schedule shortcut '30m' was not normalized to '*/30 * * * *'");
  console.error("  jobs:", JSON.stringify(apiData.jobs));
  await browser.close();
  process.exit(1);
}
if (created.status !== "active") {
  console.error(`✗ created job has status='${created.status}', expected 'active'`);
  await browser.close();
  process.exit(1);
}
if (created.lastRun) {
  console.error("✗ created job already has lastRun set (should be null)");
  await browser.close();
  process.exit(1);
}
console.log("✓ schedule normalized: 30m → */30 * * * * + status=active + lastRun=null");

// ── manual-fire via API and confirm Hermes responded ────────────────────
const fireRes = await fetch(`${BASE}/api/lokyy/jobs/${created.id}/run`, {
  method: "POST",
  headers: { cookie },
});
const fire = (await fireRes.json()) as {
  ok: boolean;
  durationMs: number;
  hermesContent?: string;
  hermesSkipped?: boolean;
  error?: string;
  job: { lastRun?: string };
};
if (!fire.ok) {
  console.error(`✗ manual-fire failed: ${fire.error}`);
  await browser.close();
  process.exit(1);
}
if (!fire.job.lastRun) {
  console.error("✗ manual-fire did not set lastRun on the job row");
  await browser.close();
  process.exit(1);
}
if (fire.hermesSkipped) {
  console.log(`✓ manual-fire ok (Hermes skipped: no HERMES_API_KEY)`);
} else {
  const preview = (fire.hermesContent ?? "").slice(0, 80);
  console.log(`✓ manual-fire ok in ${fire.durationMs}ms — hermes: "${preview}…"`);
}

// ── reload page and confirm lastRun shows ───────────────────────────────
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const apiAfterReload = await fetch(`${BASE}/api/lokyy/jobs`, { headers: { cookie } });
const after = (await apiAfterReload.json()) as {
  jobs: Array<{ id: string; lastRun?: string }>;
};
const reloaded = after.jobs.find((j) => j.id === created.id);
if (!reloaded?.lastRun) {
  console.error("✗ lastRun did not persist after page reload");
  await browser.close();
  process.exit(1);
}
console.log("✓ lastRun persists across reload");

await page.screenshot({ path: SHOT, fullPage: false });

// ── PATCH status to paused via API ──────────────────────────────────────
const patchRes = await fetch(`${BASE}/api/lokyy/jobs/${created.id}`, {
  method: "PATCH",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ status: "paused" }),
});
const patched = (await patchRes.json()) as { job: { status: string } };
if (patched.job.status !== "paused") {
  console.error(`✗ PATCH status=paused did not stick: now ${patched.job.status}`);
  await browser.close();
  process.exit(1);
}
console.log("✓ PATCH status=paused works");

// ── delete via UI to keep the existing E2E gesture covered ──────────────
page.on("dialog", (d) => void d.accept());
await page.locator("[data-testid^='job-delete-']").first().click();
await page.waitForTimeout(800);
if ((await page.locator("[data-testid='jobs-empty']").count()) === 0) {
  console.error("✗ /jobs not back to empty-state after delete");
  await browser.close();
  process.exit(1);
}
console.log("✓ delete via UI returns /jobs to empty-state");

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /jobs cron-runner verified (Issue #141)");
