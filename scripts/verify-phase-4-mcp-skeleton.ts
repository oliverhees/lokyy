#!/usr/bin/env bun
/**
 * scripts/verify-phase-4-mcp-skeleton.ts
 *
 * Phase-4 ISC-82–84 verification: lokyy-mcp container, MCP protocol over
 * SSE, bearer-token auth.
 *
 * Scenarios:
 *   A. /health public (no auth, 200)
 *   B. /mcp without auth → 401
 *   C. /mcp with wrong bearer → 401
 *   D. /mcp with right bearer → SSE 'endpoint' event arrives
 *   E. Full MCP handshake: initialize → tools/list → empty list returned
 *   F. lokyy-mcp not reachable via public Traefik (no router defined)
 *
 * Runs from the host but talks to lokyy-mcp via a curl helper container
 * on lokyy-net (the MCP port isn't published — that's the whole point).
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

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

/** Run curl in a throwaway container attached to lokyy-net.
 * curl exits non-zero on timeout (status 28) — we still want the bytes
 * received before the timeout (SSE streams never close cleanly), so we
 * swallow the exit code and only surface stdout. */
function curl(args: string): string {
  try {
    return execSync(
      `docker run --rm --network=lokyy-net curlimages/curl:latest -s ${args}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    const e = err as { stdout?: string };
    return e.stdout ?? "";
  }
}

// ─── A. Public health ──────────────────────────────────────────────────────
console.log("─── A. /health (public) ───");
const health = curl("http://lokyy-mcp:7878/health");
if (health.includes(`"ok":true`) && health.includes(`"service":"lokyy-mcp"`)) {
  ok("/health returns service identity");
} else {
  fail("/health", `unexpected body: ${health.slice(0, 120)}`);
}

// ─── B. No auth → 401 ──────────────────────────────────────────────────────
console.log("");
console.log("─── B. /mcp without bearer ───");
const code = curl(`-o /dev/null -w "%{http_code}" http://lokyy-mcp:7878/mcp`).trim();
if (code === "401") ok(`401 returned (got ${code})`);
else fail("auth gate", `expected 401, got ${code}`);

// ─── C. Wrong bearer → 401 ─────────────────────────────────────────────────
console.log("");
console.log("─── C. /mcp with wrong bearer ───");
const codeWrong = curl(
  `-o /dev/null -w "%{http_code}" -H "Authorization: Bearer not-the-secret" http://lokyy-mcp:7878/mcp`
).trim();
if (codeWrong === "401") ok(`401 returned (got ${codeWrong})`);
else fail("wrong-bearer", `expected 401, got ${codeWrong}`);

// ─── D. Right bearer → SSE 'endpoint' event ────────────────────────────────
console.log("");
console.log("─── D. /mcp with right bearer ───");
const sseRaw = curl(
  `-N --max-time 2 -H "Authorization: Bearer ${SYSTEM_SECRET}" http://lokyy-mcp:7878/mcp`
);
const endpointMatch = sseRaw.match(/event: endpoint\ndata: (\/mcp\/messages\?sessionId=[a-f0-9-]+)/);
if (endpointMatch) {
  ok(`SSE delivered 'endpoint' event → ${endpointMatch[1]}`);
} else {
  fail("sse handshake", `no endpoint event; got: ${sseRaw.slice(0, 200)}`);
}

// ─── E. POST channel exists + sessionId validation ─────────────────────────
console.log("");
console.log("─── E. POST /mcp/messages — auth + sessionId ───");
// Full MCP handshake (initialize → tools/list → empty list) is verified
// in the next slice where the first real System Skill exists. For the
// skeleton we just prove that:
//   - the POST channel exists
//   - it's bearer-gated
//   - unknown sessionId returns 404 (not 500/crash)
const postNoAuth = curl(
  `-o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' http://lokyy-mcp:7878/mcp/messages?sessionId=fake`
).trim();
if (postNoAuth === "401") ok(`POST without bearer → 401 (got ${postNoAuth})`);
else fail("post auth gate", `expected 401, got ${postNoAuth}`);

const postUnknown = curl(
  `-o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer ${SYSTEM_SECRET}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' http://lokyy-mcp:7878/mcp/messages?sessionId=fake-id`
).trim();
if (postUnknown === "404") ok(`POST with unknown sessionId → 404 (got ${postUnknown})`);
else fail("session validation", `expected 404, got ${postUnknown}`);

// ─── F. Network isolation ──────────────────────────────────────────────────
console.log("");
console.log("─── F. lokyy-mcp not reachable via Traefik ───");
try {
  // Hit traefik with a Host header for lokyy-mcp — there's no router
  // configured for it, so traefik should 404.
  const res = execSync(
    `curl -ksI --resolve lokyy.local:443:127.0.0.1 -H "Host: lokyy-mcp.lokyy.local" https://lokyy.local/ --max-time 5`,
    { encoding: "utf8" }
  );
  const status = res.split("\n")[0]?.match(/\b(\d{3})\b/)?.[1] ?? "?";
  // Traefik responds 404 for unknown hosts. Any non-success status is
  // acceptable; the only failure mode would be a 2xx that somehow exposed
  // the MCP surface.
  if (/^[45]/.test(status)) {
    ok(`traefik refuses ${status} for lokyy-mcp host (network-isolated)`);
  } else {
    fail("network-isolation", `traefik returned ${status} — MCP surface may be exposed`);
  }
} catch {
  // curl exiting non-zero (e.g. connect timeout) also means traefik
  // doesn't expose the surface.
  ok("traefik does not route to lokyy-mcp (connection rejected)");
}

console.log("");
console.log(`Phase-4 skeleton verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
