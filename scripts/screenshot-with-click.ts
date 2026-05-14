#!/usr/bin/env bun
/**
 * scripts/screenshot-with-click.ts
 *
 * One-shot helper: open URL, optionally click an element by accessible text,
 * wait, screenshot. Used for Phase C visual verification where we need to
 * dismiss the Hermes onboarding "Skip setup" before the LokyyShell appears.
 *
 * Usage:
 *   bun run scripts/screenshot-with-click.ts <url> <output.png> [--click "Skip setup"] [--wait 1000]
 */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
let clickText: string | null = null;
let waitMs = 1500;

for (let i = 2; i < args.length; i++) {
  if (args[i] === "--click") clickText = args[++i] ?? null;
  else if (args[i] === "--wait") waitMs = Number(args[++i]) ?? 1500;
}

if (!url || !out) {
  console.error("Usage: bun run scripts/screenshot-with-click.ts <url> <out.png> [--click TEXT] [--wait MS]");
  process.exit(2);
}

const dir = dirname(resolve(out));
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  if (clickText) {
    try {
      await page.getByText(clickText, { exact: false }).first().click({ timeout: 5000 });
      await page.waitForTimeout(waitMs);
    } catch (err) {
      console.warn(`Click "${clickText}" failed: ${(err as Error).message}`);
    }
  }
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Screenshot: ${resolve(out)}`);
} finally {
  await browser.close();
}
