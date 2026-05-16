#!/usr/bin/env bun
/**
 * scripts/verify-phase-0.ts
 *
 * Phase-0 Playwright verification — takes screenshots of the running Lokyy stack
 * without requiring /etc/hosts entries (uses Chromium --host-resolver-rules).
 *
 * Done-Gate evidence for Issue #77 + PR #82.
 *
 * Usage:
 *   bun run scripts/verify-phase-0.ts
 *
 * Output: docs/evidence/phase-0/*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(__dirname, "..", "docs", "evidence", "phase-0");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const targets = [
  {
    name: "01-traefik-dashboard-authed",
    url: "https://traefik.lokyy.local/dashboard/",
    auth: { username: "admin", password: "supersecure123" },
    waitFor: "networkidle" as const,
  },
  {
    name: "02-lokyy-fe-placeholder",
    url: "https://lokyy.local/",
    auth: null,
    waitFor: "domcontentloaded" as const,
  },
];

const browser = await chromium.launch({
  args: [
    "--host-resolver-rules=MAP *.lokyy.local 127.0.0.1,MAP lokyy.local 127.0.0.1",
    "--ignore-certificate-errors",
  ],
});

let passed = 0;
let failed = 0;

for (const t of targets) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    httpCredentials: t.auth ?? undefined,
  });
  const page = await context.newPage();
  const outPath = resolve(EVIDENCE_DIR, `${t.name}.png`);
  try {
    const resp = await page.goto(t.url, { waitUntil: t.waitFor, timeout: 15_000 });
    const status = resp?.status() ?? 0;
    // Give the dashboard JS a moment to render its services list
    if (t.name.includes("dashboard")) await page.waitForTimeout(2_500);
    await page.screenshot({ path: outPath, fullPage: false });
    if (status >= 200 && status < 400) {
      console.log(`  ✓ ${t.name}: ${status} → ${outPath}`);
      passed++;
    } else {
      console.log(`  ✗ ${t.name}: ${status} (screenshot still saved at ${outPath})`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${t.name}: ERROR — ${(err as Error).message}`);
    failed++;
  } finally {
    await context.close();
  }
}

await browser.close();

console.log("");
console.log(`Phase-0 verification: ${passed}/${targets.length} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
