#!/usr/bin/env bun
/**
 * scripts/verify-phase-1b.ts
 *
 * End-to-end Playwright check of the Phase-1b auth flow:
 *   1. visit /              → since a user already exists, redirect to /login
 *   2. fill login form, submit
 *   3. verify the dashboard renders the signed-in user's email
 *   4. screenshot dashboard
 *   5. click Sign-out
 *   6. verify we end up back at /login
 *
 * The script assumes the owner account was created already (run the curl
 * sign-up once before, or invoke this script idempotently on a fresh stack
 * by first hitting /setup via UI).
 *
 * Output: docs/evidence/phase-1b/*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(__dirname, "..", "docs", "evidence", "phase-1b");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";

const browser = await chromium.launch({
  args: [
    "--host-resolver-rules=MAP *.lokyy.local 127.0.0.1,MAP lokyy.local 127.0.0.1",
    "--ignore-certificate-errors",
  ],
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
let passed = 0;
let failed = 0;
const fail = (label: string, msg: string) => {
  console.log(`  ✗ ${label}: ${msg}`);
  failed++;
};
const ok = (label: string) => {
  console.log(`  ✓ ${label}`);
  passed++;
};

try {
  // Step 1: visit / → redirect to /login (user exists)
  await page.goto("https://lokyy.local/", { waitUntil: "networkidle", timeout: 15_000 });
  if (page.url().endsWith("/login")) {
    await page.screenshot({ path: resolve(EVIDENCE_DIR, "01-login-page.png") });
    ok("root redirects to /login when user exists");
  } else {
    fail("root redirect", `expected /login, got ${page.url()}`);
  }

  // Step 2: fill + submit
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);

  // Capture the sign-in response for debugging
  const signinResp = page.waitForResponse((r) =>
    r.url().includes("/api/auth/sign-in/email") && r.request().method() === "POST",
    { timeout: 15_000 }
  );
  await page.click('button[type="submit"]');
  const resp = await signinResp;
  console.log(`  ‖ sign-in response: ${resp.status()}`);
  console.log(`  ‖ set-cookie: ${resp.headers()["set-cookie"] ?? "(none)"}`);
  const ck = await context.cookies();
  console.log(`  ‖ cookies after sign-in: ${ck.map(c => c.name + "=...").join(", ") || "(none)"}`);

  // Step 3: wait for the dashboard's signout button to render — robust against
  // the brief loading state the Root component shows while useSession refetches.
  try {
    await page.waitForSelector('[data-testid="signout-button"]', { timeout: 15_000 });
  } catch {
    // Fall through; the fail below will capture diagnostic state.
  }

  const body = await page.evaluate(() => document.body.innerText);
  if (body.includes(EMAIL) && body.includes("Welcome")) {
    await page.screenshot({ path: resolve(EVIDENCE_DIR, "02-dashboard-authed.png") });
    ok(`dashboard shows ${EMAIL} after login`);
  } else {
    await page.screenshot({ path: resolve(EVIDENCE_DIR, "98-after-signin-empty.png") });
    fail("dashboard contents", `url=${page.url()} body="${body.slice(0, 200)}"`);
  }

  // Step 5: sign out
  await page.click('[data-testid="signout-button"]');
  await page.waitForURL(/\/login$/, { timeout: 10_000 });

  // Step 6: back at /login (with empty form, no session)
  await page.screenshot({ path: resolve(EVIDENCE_DIR, "03-after-signout.png") });
  if (page.url().endsWith("/login")) {
    ok("sign-out redirects back to /login");
  } else {
    fail("sign-out redirect", `expected /login, got ${page.url()}`);
  }
} catch (err) {
  fail("flow exception", (err as Error).message);
  await page.screenshot({ path: resolve(EVIDENCE_DIR, "99-failure.png") }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

console.log("");
console.log(`Phase-1b verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
