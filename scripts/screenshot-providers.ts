#!/usr/bin/env bun
/**
 * One-off: open /settings/providers, click Continue, scroll to Configured
 * Providers section, screenshot. Used by Phase-A++ Fixup #6 (issue #33).
 */
import { chromium } from "playwright";
import { resolve } from "node:path";

const url = "http://localhost:3004/settings/providers";
const out = resolve("docs/verification-shots/phase-a-fixup-6/providers-after.png");

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  try {
    await page.getByText("Continue", { exact: false }).first().click({ timeout: 5000 });
  } catch {}
  await page.waitForTimeout(6000);
  try {
    const heading = page.getByText("Configured Providers", { exact: false }).first();
    await heading.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (err) {
    console.warn(`scrollIntoView failed: ${(err as Error).message}`);
  }
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Screenshot: ${out}`);
} finally {
  await browser.close();
}
