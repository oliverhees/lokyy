#!/usr/bin/env bun
/**
 * scripts/verify-chat-history-load.ts — Playwright check for #150.
 *
 * Reproduce the bug Oliver reported: clicking a past chat in the
 * sidebar must actually load it (messages render), not just highlight
 * the row visually.
 *
 * E2E:
 *   1. Pre-seed via API: create a conversation with two messages
 *   2. Open /chat — new-chat empty-state visible
 *   3. Click the conversation in the sidebar
 *   4. Verify the body now shows the user-message content (proves
 *      activeConv.messages rendered, not the empty-state)
 *   5. Cleanup the seeded conversation
 */
import { chromium } from "playwright";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const SHOT = "docs/evidence/audit-2026-05-19/chat-history-load.png";
const USER_MSG = "audit-test history-load user message";
const ASSIST_MSG = "audit-test history-load assistant response";

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
  });
  return r.headers.getSetCookie().join("; ");
}

const cookie = await loginCookie();

// Pre-seed a conversation
const created = (await (await fetch(`${BASE}/api/lokyy/conversations`, {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ title: "Audit history-load test" }),
})).json()) as { conversation: { id: string } };
const convId = created.conversation.id;

for (const m of [
  { role: "user", content: USER_MSG, at: new Date().toISOString() },
  { role: "assistant", content: ASSIST_MSG, at: new Date().toISOString() },
]) {
  await fetch(`${BASE}/api/lokyy/conversations/${convId}/append`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(m),
  });
}
console.log(`✓ pre-seeded conversation ${convId}`);

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

  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Sidebar item should exist
  const item = page.locator(`[data-testid='chat-history-item-${convId}']`);
  await item.waitFor({ state: "visible", timeout: 5_000 });
  console.log("✓ history item visible in sidebar");

  // Empty state visible BEFORE click
  const beforeClick = await page.evaluate(() => document.body.innerText ?? "");
  if (!beforeClick.includes("Wie kann Lokyy dir heute helfen")) {
    console.error("✗ expected empty-state before click");
    await browser.close();
    process.exit(1);
  }

  // Click → should load the conversation
  await item.click();

  // The seeded user message should appear in the chat area within 5s
  try {
    await page.getByText(USER_MSG, { exact: false }).waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    const body = await page.evaluate(() => document.body.innerText ?? "");
    console.error("✗ clicked history item but USER_MSG never appeared");
    console.error("  body excerpt:", body.slice(0, 500).replace(/\s+/g, " "));
    await page.screenshot({ path: SHOT });
    await browser.close();
    process.exit(1);
  }
  console.log(`✓ user-message rendered: "${USER_MSG}"`);

  await page.getByText(ASSIST_MSG, { exact: false }).waitFor({ state: "visible", timeout: 5_000 });
  console.log(`✓ assistant-message rendered: "${ASSIST_MSG}"`);

  // Empty-state should be GONE
  const afterClick = await page.evaluate(() => document.body.innerText ?? "");
  if (afterClick.includes("Wie kann Lokyy dir heute helfen")) {
    console.error("✗ empty-state still showing after click — conversation not loaded");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ empty-state gone");

  await page.screenshot({ path: SHOT, fullPage: false });
} finally {
  await browser.close();
  await fetch(`${BASE}/api/lokyy/conversations/${convId}`, { method: "DELETE", headers: { cookie } });
}

console.log(`✓ screenshot: ${SHOT}`);
console.log("✓ /chat history-load verified (Issue #150)");
