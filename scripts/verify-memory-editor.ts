#!/usr/bin/env bun
/**
 * scripts/verify-memory-editor.ts — Playwright check for #152.
 *
 * /memory now exposes 2 editable textareas:
 *   - SOUL.md (Agent-Persona)
 *   - USER.md (Über dich)
 *
 * E2E:
 *   1. Open /memory
 *   2. Both textareas render with non-empty initial content
 *   3. Edit USER.md textarea (append a marker line)
 *   4. Click Save
 *   5. Reload — marker persists
 *   6. Curl backend directly — change visible via API too
 *   7. Cleanup: revert USER.md to its prior state
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/memory-editor.png";
const MARKER = `# Audit-Test Marker — ${new Date().toISOString()}`;

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  return r.headers.getSetCookie().join("; ");
}

const cookie = await loginCookie();

// Snapshot the original USER.md so we can restore it after the test
const beforeRes = await fetch(`${BASE}/api/lokyy/hermes-user-facts`, { headers: { cookie } });
const before = (await beforeRes.json()) as { content: string };
const originalUserMd = before.content;

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("oliver@lokyy.local");
  await page.getByLabel("Passwort").fill("supersecure123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("✓ logged in");

  await page.goto(`${BASE}/memory`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Both cards rendered
  for (const card of ["memory-persona", "memory-user-facts"]) {
    if ((await page.locator(`[data-testid='${card}']`).count()) === 0) {
      console.error(`✗ card ${card} missing`);
      await browser.close();
      process.exit(1);
    }
  }
  console.log("✓ both editable cards rendered (persona + user-facts)");

  // Persona textarea has non-empty content (it was already written via curl)
  const personaText = await page
    .locator("[data-testid='memory-persona-textarea']")
    .inputValue();
  if (personaText.length < 100) {
    console.error(`✗ persona textarea is empty / too short (${personaText.length} chars)`);
    await browser.close();
    process.exit(1);
  }
  if (!/Lokyy Agent Persona|Reminders/i.test(personaText)) {
    console.error("✗ persona textarea content doesn't look like our SOUL.md");
    await browser.close();
    process.exit(1);
  }
  console.log(`✓ persona textarea loaded (${personaText.length} chars, looks legit)`);

  // Edit USER.md: append a marker line
  const userTextarea = page.locator("[data-testid='memory-user-facts-textarea']");
  const userBefore = await userTextarea.inputValue();
  await userTextarea.fill(`${userBefore}\n\n${MARKER}\n`);

  // Save button now enabled (dirty)
  const saveBtn = page.locator("[data-testid='memory-user-facts-save']");
  if (await saveBtn.isDisabled()) {
    console.error("✗ user-facts save button still disabled after edit");
    await browser.close();
    process.exit(1);
  }
  await saveBtn.click();
  await page.waitForTimeout(800);
  console.log("✓ user-facts saved");

  // Reload and confirm the marker is in the textarea
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const reloadedUser = await page
    .locator("[data-testid='memory-user-facts-textarea']")
    .inputValue();
  if (!reloadedUser.includes(MARKER)) {
    console.error("✗ marker missing from user-facts after reload");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ marker persists across page reload");

  // Confirm via direct API too
  const afterRes = await fetch(`${BASE}/api/lokyy/hermes-user-facts`, { headers: { cookie } });
  const after = (await afterRes.json()) as { content: string };
  if (!after.content.includes(MARKER)) {
    console.error("✗ API GET doesn't show the marker — write didn't reach disk");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ API roundtrip confirms write reached /opt/data/USER.md");

  await page.screenshot({ path: SHOT, fullPage: false });
} finally {
  await browser.close();
  // Restore USER.md to its prior state
  await fetch(`${BASE}/api/lokyy/hermes-user-facts`, {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ content: originalUserMd }),
  });
}

console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /memory editor verified (Issue #152)");
