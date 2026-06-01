#!/usr/bin/env bun
/**
 * scripts/verify-reminders-poller.ts — Iteration-A Toast-Delivery Done-Gate.
 *
 * Verifies the in-app toast delivery chain:
 *   scheduler-tick flips reminder pending → fired
 *     → frontend RemindersPoller polls /pending-deliveries every 15 s
 *     → Sonner toast appears with text + "Quittieren" action
 *     → click Quittieren → patchReminder({status:'dismissed'})
 *     → toast disappears + DB row status='dismissed'.
 *
 * Trick to skip the 60 s scheduler wait: we directly mutate the reminder row
 * to status='fired' via docker exec into lokyy-os-be (bun:sqlite). Tests the
 * delivery chain in isolation — the scheduler-tick → fired flip is already
 * covered by verify-reminders-system.ts.
 *
 * Run:  bun scripts/verify-reminders-poller.ts
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = "https://lokyy.local";
const EMAIL = "oliver@lokyy.local";
const PASSWORD = "supersecure123";
const MARKER = `Poller-Verify-${randomUUID().slice(0, 8)}`;
const ISO_DATE = new Date().toISOString().slice(0, 10);
const SHOT_DIR = "docs/evidence/path-c";
const SHOT = `${SHOT_DIR}/poller-toast-${ISO_DATE}.png`;

function readSystemSecret(): string {
  const env = readFileSync("infrastructure/.env.local", "utf8");
  const m = env.match(/^LOKYY_SYSTEM_SECRET=(.+)$/m);
  if (!m) throw new Error("LOKYY_SYSTEM_SECRET missing in .env.local");
  return m[1]!.trim();
}

async function loginCookie(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: HTTP ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function deleteRem(cookie: string, id: string): Promise<void> {
  await fetch(`${BASE}/api/lokyy/reminders/${id}`, {
    method: "DELETE",
    headers: { cookie },
  });
}

async function cleanupLeakedTestReminders(cookie: string): Promise<number> {
  const r = await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } });
  const data = (await r.json()) as { reminders: Array<{ id: string; text: string }> };
  const leaked = data.reminders.filter((rem) => /Poller-Verify-/.test(rem.text));
  for (const rem of leaked) await deleteRem(cookie, rem.id);
  return leaked.length;
}

function flipToFired(id: string): void {
  const script =
    `import { Database } from 'bun:sqlite'; ` +
    `const db = new Database('/app/data/lokyy.db'); ` +
    `db.run(\"UPDATE lokyy_reminder SET status='fired', firedAt=? WHERE id=?\", [Date.now(), '${id}']);`;
  const proc = Bun.spawnSync(["docker", "exec", "lokyy-os-be", "bun", "-e", script]);
  if (proc.exitCode !== 0) {
    throw new Error(
      `flipToFired failed: ${new TextDecoder().decode(proc.stderr)}`,
    );
  }
}

mkdirSync(SHOT_DIR, { recursive: true });

const cookie = await loginCookie();
const SYSTEM_SECRET = readSystemSecret();
console.log("✓ logged in");

const leakedCount = await cleanupLeakedTestReminders(cookie);
if (leakedCount > 0) console.log(`  cleanup: removed ${leakedCount} leaked Poller-Verify reminder(s) from prior runs`);

// Create a fresh reminder via the agent endpoint (origin=agent, channel=in-app).
const createRes = await fetch(`${BASE}/api/lokyy/reminders/agent/create`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SYSTEM_SECRET}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    text: MARKER,
    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    channel: "in-app",
  }),
});
if (!createRes.ok) {
  console.error(`✗ agent/create failed: HTTP ${createRes.status}`);
  process.exit(1);
}
const { reminder } = (await createRes.json()) as { reminder: { id: string } };
const reminderId = reminder.id;
console.log(`✓ reminder created: ${reminderId} (pending)`);

flipToFired(reminderId);
console.log("✓ direct DB flip: status='fired'");

// Boot a fresh browser context (empty localStorage → poller hasn't seen this ID).
const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP lokyy.local 127.0.0.1"],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  ignoreHTTPSErrors: true,
  permissions: ["notifications"],
});
// Spy on Notification constructor so we can prove the poller fired an OS-level
// notification (not just an in-app toast).
await ctx.addInitScript(() => {
  type NSpy = { title: string; body?: string; tag?: string }
  ;(window as unknown as { __notifications: NSpy[] }).__notifications = []
  const Orig = window.Notification
  function Spy(title: string, opts?: NotificationOptions) {
    ;(window as unknown as { __notifications: NSpy[] }).__notifications.push({
      title,
      body: opts?.body,
      tag: opts?.tag,
    })
    return new Orig(title, opts)
  }
  Spy.permission = "granted" as NotificationPermission
  Spy.requestPermission = () => Promise.resolve("granted" as NotificationPermission)
  ;(window as unknown as { Notification: unknown }).Notification = Spy as unknown as typeof Notification
})
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log(`  [browser:pageerror] ${err.message}`));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  console.log("✓ logged into UI");

  // Sonner renders toasts inside [data-sonner-toaster]. Wait up to 18 s
  // (poll interval is 15 s + first tick is immediate, so usually <2 s).
  const toast = page.locator(`[data-sonner-toaster] :text("${MARKER}")`).first();
  await toast.waitFor({ state: "visible", timeout: 18_000 });
  console.log("✓ toast appeared with marker text");

  // Verify the poller also fired an OS-level Notification — same gesture
  // covers the case where the tab is backgrounded.
  const notifications = (await page.evaluate(
    () =>
      (window as unknown as { __notifications: { title: string; body?: string; tag?: string }[] })
        .__notifications,
  )) as { title: string; body?: string; tag?: string }[];
  const ours = notifications.find((n) => n.body === MARKER);
  if (!ours) {
    throw new Error(
      `no OS Notification with body="${MARKER}" was constructed (got ${JSON.stringify(notifications)})`,
    );
  }
  console.log(`✓ OS-level Notification fired (title="${ours.title}", tag=${ours.tag})`);

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`✓ screenshot: ${SHOT}`);

  // Scope the action click to ONLY the toast that contains our unique marker —
  // sonner doesn't tag individual toasts, but :has() lets us find the toast wrapper
  // by its visible text and click the action button inside that exact wrapper.
  const ourToast = page.locator(`[data-sonner-toast]:has-text("${MARKER}")`);
  await ourToast.locator(`button[data-action="true"]`).click();

  // Verify DB transitioned to dismissed.
  let dismissed = false;
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE}/api/lokyy/reminders`, { headers: { cookie } });
    const data = (await r.json()) as {
      reminders: Array<{ id: string; status: string }>;
    };
    const rem = data.reminders.find((x) => x.id === reminderId);
    if (rem?.status === "dismissed") {
      dismissed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!dismissed) {
    throw new Error("Quittieren-Click did not flip status to 'dismissed'");
  }
  console.log("✓ click Quittieren → status='dismissed' in DB");
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  await browser.close();
  await deleteRem(cookie, reminderId);
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
  await deleteRem(cookie, reminderId);
}

console.log(`\n✅ In-app toast delivery verified end-to-end (marker=${MARKER})`);
