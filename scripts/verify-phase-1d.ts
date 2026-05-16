#!/usr/bin/env bun
/**
 * scripts/verify-phase-1d.ts
 *
 * Walks every sidebar route after signin and screenshots each one,
 * confirming the FE no longer hits 404s on the /api/lokyy/* path
 * (sidebar routes now have stub backing).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(__dirname, "..", "docs", "evidence", "phase-1d");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";

const ROUTES = [
  "/dashboard",
  "/agents",
  "/chat",
  "/tasks",
  "/sessions",
  "/jobs",
  "/prompts",
  "/teams",
  "/workflows",
  "/integrations",
  "/channels",
  "/memory",
  "/insights",
  "/tools",
  "/plugins",
  "/vault",
  "/logs",
  "/webhooks",
  "/n8n",
  "/settings",
];

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
const consoleErrors: { route: string; messages: string[] }[] = [];

try {
  // Sign in once, reuse session
  await page.goto("https://lokyy.local/login", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  for (const route of ROUTES) {
    const errors: string[] = [];
    const onPageError = (err: Error) => errors.push(`pageerror: ${err.message}`);
    const onConsole = (msg: any) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore stray network errors triggered by missing assets we don't care about
        if (!text.includes("favicon") && !text.includes("DevTools")) errors.push(`console: ${text}`);
      }
    };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      await page.goto("https://lokyy.local" + route, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await page.waitForTimeout(1200);
      const snap = `${route.replace(/\//g, "-").replace(/^-/, "")}.png`;
      await page.screenshot({ path: resolve(EVIDENCE_DIR, snap), fullPage: false });

      const landed = new URL(page.url()).pathname;
      const fatalErrors = errors.filter((e) => !e.includes("503")); // hermes 503 is expected on /chat
      if (errors.length === 0 || (route === "/chat" && fatalErrors.length === 0)) {
        console.log(`  ✓ ${route} → ${landed}`);
        passed++;
      } else {
        console.log(`  ✗ ${route}: ${errors.length} error(s) — ${errors[0]?.slice(0, 100)}`);
        if (errors.length > 0) consoleErrors.push({ route, messages: errors.slice(0, 3) });
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ ${route}: navigate failure — ${(err as Error).message.slice(0, 120)}`);
      failed++;
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }
  }
} catch (err) {
  console.log(`  ✗ flow exception: ${(err as Error).message}`);
  failed++;
} finally {
  await context.close();
  await browser.close();
}

console.log("");
console.log(`Phase-1d verification: ${passed}/${ROUTES.length} routes clean, ${failed} with errors`);
if (consoleErrors.length > 0) {
  console.log("");
  console.log("Error detail (first 3 per route):");
  for (const e of consoleErrors) {
    console.log(`  ${e.route}:`);
    for (const m of e.messages) console.log(`    - ${m}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
