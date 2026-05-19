#!/usr/bin/env bun
/**
 * scripts/verify-prompts-persistence.ts — Playwright check for #137.
 *
 * Mirrors verify-jobs-persistence.ts: empty → create → reload-persists
 * → delete → empty.
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/prompts-persistence.png";

async function cleanLeftovers() {
  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  const cookie = login.headers.getSetCookie().join("; ");
  const list = await fetch(`${BASE}/api/lokyy/prompts`, { headers: { cookie } });
  const data = (await list.json()) as { prompts: Array<{ id: string }> };
  for (const p of data.prompts) {
    await fetch(`${BASE}/api/lokyy/prompts/${p.id}`, { method: "DELETE", headers: { cookie } });
  }
  console.log(`  cleanup: removed ${data.prompts.length} leftover prompts`);
}

await cleanLeftovers();

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

await page.goto(`${BASE}/prompts`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

if ((await page.locator("[data-testid='prompts-empty']").count()) === 0) {
  console.error("✗ /prompts not showing empty-state at start");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ /prompts starts in empty-state");

await page.locator("[data-testid='prompts-add']").click();
await page.waitForSelector("[data-testid='prompt-form-title']", { timeout: 5_000 });
await page.locator("[data-testid='prompt-form-title']").fill("Code Review Template");
await page
  .locator("[data-testid='prompt-form-body']")
  .fill("Review the diff and flag correctness/security/perf issues.");
await page.locator("[data-testid='prompt-form-tags']").fill("coding, review, lokyy");
await page.locator("[data-testid='prompt-form-save']").click();

await page.waitForSelector("[data-testid='prompts-grid']", { timeout: 5_000 });
const gridText = await page.locator("[data-testid='prompts-grid']").innerText();
if (!gridText.includes("Code Review Template")) {
  console.error("✗ created prompt title missing from grid");
  console.error("  excerpt:", gridText.slice(0, 400));
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ card appears with title");

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
const reloadedText = await page
  .locator("[data-testid='prompts-grid']")
  .innerText()
  .catch(() => "");
if (!reloadedText.includes("Code Review Template")) {
  console.error("✗ prompt lost after reload — persistence broken");
  await page.screenshot({ path: SHOT });
  await browser.close();
  process.exit(1);
}
console.log("✓ card persists after page reload");

await page.screenshot({ path: SHOT, fullPage: false });

const deleteButton = page.locator("[data-testid^='prompt-delete-']").first();
page.on("dialog", (d) => void d.accept());
await deleteButton.click();
await page.waitForTimeout(800);
if ((await page.locator("[data-testid='prompts-empty']").count()) === 0) {
  console.error("✗ /prompts not back to empty-state after delete");
  await browser.close();
  process.exit(1);
}
console.log("✓ row deleted, /prompts back to empty-state");

await browser.close();
console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /prompts persistence verified (Issue #137)");
