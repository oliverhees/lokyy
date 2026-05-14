#!/usr/bin/env bun
/**
 * scripts/verify-ui.ts
 *
 * Visual verification for Lokyy via Playwright (headless Chromium).
 *
 * Context:
 *   CLAUDE.md (global PAI rule) says "Interceptor for ALL web verification."
 *   On the Linux dev box Interceptor isn't installed, so per Issue #22 we
 *   use Playwright instead. This is a Lokyy/Linux-specific override of the
 *   global rule — NOT a general PAI policy change.
 *
 * Usage:
 *   bun run scripts/verify-ui.ts <url> [output.png] [--full] [--width N] [--height N]
 *
 * Examples:
 *   bun run scripts/verify-ui.ts http://localhost:3002/
 *   bun run scripts/verify-ui.ts http://localhost:3002/dashboard ./docs/verification-shots/dashboard-phase-a.png
 *   bun run scripts/verify-ui.ts http://localhost:3002/ shot.png --full --width 1440 --height 900
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Args = {
  url: string;
  output: string;
  fullPage: boolean;
  viewport: { width: number; height: number };
};

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let fullPage = false;
  let width = 1440;
  let height = 900;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") fullPage = true;
    else if (a === "--width") width = Number(argv[++i]);
    else if (a === "--height") height = Number(argv[++i]);
    else positional.push(a);
  }

  if (positional.length < 1) {
    console.error("Usage: bun run scripts/verify-ui.ts <url> [output.png] [--full] [--width N] [--height N]");
    process.exit(2);
  }

  const url = positional[0]!;
  const defaultName = `shot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  const output = positional[1] ?? `./docs/verification-shots/${defaultName}`;

  return { url, output, fullPage, viewport: { width, height } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = dirname(resolve(args.output));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const t0 = Date.now();
  console.log(`Verifying: ${args.url}`);
  console.log(`Viewport:  ${args.viewport.width}x${args.viewport.height}  fullPage=${args.fullPage}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: args.viewport });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.failure()?.errorText ?? "?"} ${req.url()}`);
    });

    const response = await page.goto(args.url, { waitUntil: "networkidle", timeout: 30_000 });
    const status = response?.status() ?? 0;
    const title = await page.title();

    await page.screenshot({ path: args.output, fullPage: args.fullPage });

    const elapsed = Date.now() - t0;
    console.log(`Status:    ${status}`);
    console.log(`Title:     ${title}`);
    console.log(`Screenshot: ${resolve(args.output)}`);
    console.log(`Elapsed:    ${elapsed}ms`);

    if (consoleErrors.length) {
      console.log(`\nConsole errors (${consoleErrors.length}):`);
      consoleErrors.slice(0, 10).forEach((e) => console.log(`  - ${e.slice(0, 160)}`));
    }
    if (failedRequests.length) {
      console.log(`\nFailed requests (${failedRequests.length}):`);
      failedRequests.slice(0, 10).forEach((r) => console.log(`  - ${r}`));
    }
    if (status >= 400) {
      console.error(`\nFAIL: HTTP ${status}`);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
