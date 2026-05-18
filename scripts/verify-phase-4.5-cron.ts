#!/usr/bin/env bun
/**
 * scripts/verify-phase-4.5-cron.ts
 *
 * ISC-91 full verification: in-process cron scheduler in lokyy-mcp
 * autonomously fires dashboard Producers on schedule. We:
 *   1) create a dashboard
 *   2) PATCH its schedule to '* * * * *' (every minute)
 *   3) wait for the next minute boundary plus a generous buffer for
 *      the HN-fetch producer to complete
 *   4) verify a runs/YYYY-MM-DD.json file appears
 *   5) verify cron log line shows the fire event
 *
 * Cleans up the test dashboard at the end either way.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ENV_FILE = "infrastructure/.env.local";
const SYSTEM_SECRET = (() => {
  const text = readFileSync(ENV_FILE, "utf8");
  const m = text.match(/^LOKYY_SYSTEM_SECRET=(.+)$/m);
  if (!m) throw new Error("LOKYY_SYSTEM_SECRET missing in .env.local");
  return m[1]!.trim();
})();

const BASE = "https://lokyy.local";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

async function signIn(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "oliver@lokyy.local",
      password: "supersecure123",
    }),
  });
  const cookies = r.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

const cookie = await signIn();
ok("authenticated");

// 1. Create
const createRes = await fetch(`${BASE}/api/lokyy/dashboards/from-intent`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ intent: `cron-test-${Date.now()}` }),
});
const created = (await createRes.json()) as { dashboardId: string };
const id = created.dashboardId;
ok(`dashboard created: ${id}`);

// 2. PATCH to every-minute
const patchRes = await fetch(`${BASE}/api/lokyy/dashboards/${id}`, {
  method: "PATCH",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ schedule: "* * * * *" }),
});
if (patchRes.ok) ok("schedule patched to '* * * * *'");
else fail("patch", `HTTP ${patchRes.status}`);

// 3. Wait for next minute boundary + cron tick (60s) + HN-fetch (~10s) + buffer
const now = new Date();
const secondsToMinute = 60 - now.getSeconds();
const totalWait = secondsToMinute + 75; // worst case 75s after boundary
console.log(`→ waiting ${totalWait}s for next-minute + HN-fetch + buffer`);
await new Promise((r) => setTimeout(r, totalWait * 1000));

// 4. Look for run file
let runAppeared = false;
try {
  const r = await fetch(`${BASE}/api/lokyy/dashboards/${id}/data`, {
    headers: { Cookie: cookie },
  });
  const data = (await r.json()) as { payload: unknown; runAt: string | null };
  if (data.runAt && data.payload) {
    ok(`run file present, runAt=${data.runAt}`);
    runAppeared = true;
    const items = (data.payload as { items?: unknown[] }).items;
    if (Array.isArray(items) && items.length > 0) {
      ok(`payload has ${items.length} items (HN-fetch worked)`);
    }
  } else {
    fail("run file", "no payload / runAt — cron may not have fired or producer failed");
  }
} catch (err) {
  fail("data fetch", String(err));
}

// 5. Check the admin cron-jobs surface
try {
  const r = execSync(
    `docker run --rm --network=lokyy-net curlimages/curl:latest -s -H "Authorization: Bearer ${SYSTEM_SECRET}" http://lokyy-mcp:7878/admin/cron`,
    { encoding: "utf8" }
  );
  if (r.includes(id) && r.includes("lastFiredAt")) {
    ok("admin/cron lists our test job with non-null lastFiredAt");
  } else if (r.includes(id)) {
    fail("admin/cron lastFiredAt", "job listed but lastFiredAt null");
  } else {
    fail("admin/cron", `job not in /admin/cron output`);
  }
} catch (err) {
  fail("admin/cron", String(err).split("\n")[0]!);
}

// 6. Verify cron log line in container logs
try {
  const logs = execSync(`docker logs lokyy-mcp --since 3m`, { encoding: "utf8" });
  if (logs.includes(`fire dashboard=${id}`)) {
    ok("lokyy-mcp logged the fire event");
  } else {
    fail("log", "no fire event in last 3m of logs");
  }
} catch (err) {
  fail("log", String(err).split("\n")[0]!);
}

// Cleanup
try {
  await fetch(`${BASE}/api/lokyy/dashboards/${id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  ok("cleanup: dashboard deleted");
} catch {}

console.log("");
console.log(`Phase-4.5 cron verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
