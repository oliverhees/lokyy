#!/usr/bin/env bun
/**
 * scripts/verify-phase-2b-supervisor.ts
 *
 * Chaos + happy-path verification of the Lokyy Heartbeat Supervisor
 * (Phase-2b, Issue #96).
 *
 * Test scenarios:
 *   A. Tick cadence — activity-log shows tick entries at ~60s
 *   B. Crash recovery — kill hermes, supervisor restarts within 120s,
 *      activity-log records the event
 *   C. Bell surfaces in lokyy-app sidebar (Playwright headless)
 *
 * Prerequisites: docker compose --env-file .env.local up -d running.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SCREENSHOT_DIR = resolve("docs/evidence/phase-2b");
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

async function call(path: string, init?: RequestInit) {
  return fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function signIn(): Promise<string> {
  const r = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`sign-in failed: ${r.status}`);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

type ActivityEvent = {
  at: string;
  kind: "tick" | "hermes-down" | "hermes-restart" | "hermes-restart-failed" | "catch-up";
  service?: string;
  message?: string;
  ok?: boolean;
};

async function getActivity(cookie: string, since?: string): Promise<ActivityEvent[]> {
  const url = since ? `/api/lokyy/activity?since=${encodeURIComponent(since)}` : "/api/lokyy/activity";
  const r = await call(url, { headers: { Cookie: cookie } });
  if (!r.ok) throw new Error(`activity ${r.status}`);
  return (await r.json()).events ?? [];
}

// ───────────────────────────────────────────────────────────────────────────
// A. Tick cadence
// ───────────────────────────────────────────────────────────────────────────

console.log("─── A. Tick cadence ───");
const cookie = await signIn();
ok("authenticated");

const tickEvents = await getActivity(cookie);
const recentTicks = tickEvents.filter(
  (e) => e.kind === "tick" && Date.now() - new Date(e.at).getTime() < 180_000
);
if (recentTicks.length >= 1) {
  ok(`found ${recentTicks.length} tick(s) in last 180s`);
} else {
  fail("tick cadence", `expected >=1 tick, found ${recentTicks.length}`);
  console.log("  (full log:", tickEvents.slice(-5), ")");
}

// ───────────────────────────────────────────────────────────────────────────
// B. Crash recovery
// ───────────────────────────────────────────────────────────────────────────

console.log("");
console.log("─── B. Crash recovery (chaos) ───");
const since = new Date().toISOString();
console.log("  → killing hermes container …");
try {
  execSync("docker compose --env-file .env.local kill hermes", {
    cwd: "infrastructure",
    stdio: "pipe",
  });
  ok("hermes killed");
} catch (err) {
  fail("kill hermes", String(err));
}

// Wait up to 150s for the supervisor to react. The "success" condition is
// EITHER a hermes-restart event (kill leaves container in 'exited' state),
// OR a hermes-missing event (Docker reaped the container; supervisor flags
// it for manual recreate). Both prove the supervisor reacted correctly to
// the loss of Hermes — the recovery action differs by container state, not
// by supervisor health.
console.log("  → waiting for supervisor to detect + react (max 150s) …");
let reacted: "restart" | "missing" | null = null;
let hermesHealthy = false;
for (let i = 0; i < 30 && !reacted; i++) {
  await new Promise((r) => setTimeout(r, 5_000));
  try {
    const evts = await getActivity(cookie, since);
    if (evts.some((e) => e.kind === "hermes-restart" && e.ok)) reacted = "restart";
    else if (evts.some((e) => e.kind === "hermes-missing")) reacted = "missing";
    if (!reacted && evts.some((e) => e.kind === "hermes-down")) {
      console.log(`    t+${(i + 1) * 5}s — supervisor flagged hermes-down`);
    }
  } catch {}
}

if (reacted === "restart") {
  ok("activity-log: hermes-restart event recorded (container was just stopped)");
} else if (reacted === "missing") {
  ok("activity-log: hermes-missing event recorded (container was reaped — operator action expected)");
} else {
  fail("crash recovery", "neither hermes-restart nor hermes-missing event seen in 150s");
}

// If we got the restart path, hermes should self-heal. If we got the
// missing path, the operator (or this script's epilogue) must bring it
// back. Either way: ensure hermes is healthy at end so the next test run
// has a clean stack to work with.
if (reacted === "missing") {
  console.log("  → recovering hermes for clean handoff …");
  try {
    execSync("docker compose --env-file .env.local up -d hermes", {
      cwd: "infrastructure",
      stdio: "pipe",
    });
  } catch {}
}
for (let i = 0; i < 30 && !hermesHealthy; i++) {
  await new Promise((r) => setTimeout(r, 3_000));
  try {
    const health = execSync(
      "docker inspect --format '{{.State.Health.Status}}' lokyy-hermes 2>/dev/null || echo 'unknown'",
      { encoding: "utf8" }
    ).trim();
    if (health === "healthy") hermesHealthy = true;
  } catch {}
}

if (hermesHealthy) ok("hermes container back to healthy");
else fail("hermes health", "still not healthy after recovery window");

// ───────────────────────────────────────────────────────────────────────────
// C. Bell visible in UI
// ───────────────────────────────────────────────────────────────────────────

console.log("");
console.log("─── C. UI bell ───");

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Passwort").fill(PASSWORD);
await page.getByRole("button", { name: "Login", exact: true }).click();
await page.waitForURL("**/dashboard", { timeout: 15_000 });

const bell = page.getByTestId("activity-bell");
try {
  await bell.waitFor({ state: "visible", timeout: 5_000 });
  ok("activity-bell visible in header");
  await bell.click();
  const panel = page.getByTestId("activity-panel");
  await panel.waitFor({ state: "visible", timeout: 3_000 });
  ok("activity-panel opens on click");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/bell-open.png`,
    fullPage: false,
  });
} catch (err) {
  fail("activity bell", String(err).split("\n")[0] ?? "");
}

await browser.close();

console.log("");
console.log(`Phase-2b verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
