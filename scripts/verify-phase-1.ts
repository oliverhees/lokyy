#!/usr/bin/env bun
/**
 * scripts/verify-phase-1.ts
 *
 * Phase-1 Playwright verification — takes screenshots of the Lokyy landing page
 * served by the new lokyy-os-fe (Vite + React) talking to lokyy-os-be (Bun + Hono).
 *
 * Done-Gate evidence for Issue #86 + the Phase-1 scaffold PR.
 *
 * Usage:
 *   bun run scripts/verify-phase-1.ts
 *
 * Output: docs/evidence/phase-1/*.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE_DIR = resolve(__dirname, "..", "docs", "evidence", "phase-1");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const targets = [
  {
    name: "01-lokyy-landing-with-backend-version",
    url: "https://lokyy.local/",
    waitFor: "networkidle" as const,
    // Wait for the React app to fetch /api/version and render it
    expectText: "lokyy-os-be",
  },
  {
    name: "02-api-version-direct",
    url: "https://lokyy.local/api/version",
    waitFor: "domcontentloaded" as const,
    expectText: "Phase-1 scaffold",
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
  });
  const page = await context.newPage();
  const outPath = resolve(EVIDENCE_DIR, `${t.name}.png`);
  try {
    const resp = await page.goto(t.url, { waitUntil: t.waitFor, timeout: 15_000 });
    const status = resp?.status() ?? 0;
    // Wait for React-rendered content to settle
    await page.waitForTimeout(1500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const expectFound = bodyText.includes(t.expectText);
    await page.screenshot({ path: outPath, fullPage: false });
    if (status >= 200 && status < 400 && expectFound) {
      console.log(`  ✓ ${t.name}: ${status}, text "${t.expectText}" found → ${outPath}`);
      passed++;
    } else {
      console.log(`  ✗ ${t.name}: status=${status}, text-found=${expectFound} → ${outPath}`);
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
console.log(`Phase-1 verification: ${passed}/${targets.length} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
