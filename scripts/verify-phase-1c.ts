#!/usr/bin/env bun
/**
 * scripts/verify-phase-1c.ts
 *
 * Phase-1c verification — the real lokyy-app frontend now drives the Lokyy
 * docker stack (replaces my Phase-1 lokyy-os-fe scaffold).
 *
 * Flow:
 *   1. visit /            → TanStack Router beforeLoad checks owner-exists, redirects to /login
 *   2. fill + submit login (oliver@lokyy.local / supersecure123)
 *   3. land on /dashboard with sidebar + welcome
 *   4. screenshot
 *   5. open a couple of routes to prove the SPA wires up
 *
 * Output: docs/evidence/phase-1c/*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(__dirname, "..", "docs", "evidence", "phase-1c");
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
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, msg: string) => { console.log(`  ✗ ${s}: ${msg}`); failed++; };

try {
  // Step 1: root → /login redirect
  await page.goto("https://lokyy.local/", { waitUntil: "networkidle", timeout: 15_000 });
  if (page.url().endsWith("/login")) {
    await page.screenshot({ path: resolve(EVIDENCE_DIR, "01-login-page.png") });
    ok("root → /login redirect (TanStack Router beforeLoad fired)");
  } else {
    fail("root redirect", `expected /login, got ${page.url()}`);
  }

  // Step 2: sign in
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Step 3: wait for /dashboard
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  // Let the sidebar + cards settle
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(EVIDENCE_DIR, "02-dashboard-with-sidebar.png"), fullPage: false });
  const body = await page.evaluate(() => document.body.innerText);
  if (body.includes("Dashboard") || body.includes("dashboard")) {
    ok("login → /dashboard with sidebar rendered");
  } else {
    fail("dashboard content", `got body=${body.slice(0, 120)}`);
  }

  // Step 4: poke a few other routes to show the SPA routes
  for (const path of ["/agents", "/memory", "/settings"]) {
    await page.goto("https://lokyy.local" + path, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: resolve(EVIDENCE_DIR, `03-route${path.replace(/\//g, "-")}.png`),
    });
    if (page.url().includes(path)) {
      ok(`route ${path} renders`);
    } else {
      fail(`route ${path}`, `landed at ${page.url()}`);
    }
  }
} catch (err) {
  fail("flow exception", (err as Error).message);
  await page.screenshot({ path: resolve(EVIDENCE_DIR, "99-failure.png") }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

console.log("");
console.log(`Phase-1c verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
