#!/usr/bin/env bun
/**
 * scripts/verify-phase-2a.ts
 *
 * End-to-end check of the Hermes proxy:
 *   1. Sign in as oliver@lokyy.local
 *   2. GET /api/hermes/v1/models — must return the hermes-agent model
 *   3. POST /api/hermes/v1/chat/completions — must reach Hermes (200 with
 *      content if a provider key is set, or 500 with the explicit
 *      "No inference provider configured" message if not — either is a
 *      pass for Phase-2a because both prove the proxy is wired correctly).
 */
const BASE = "https://lokyy.local";
const FETCH_OPTS: RequestInit = {
  // bun's fetch supports tls.rejectUnauthorized:false via --tls-no-verify
  // env, but we use NODE_TLS_REJECT_UNAUTHORIZED below for reliability.
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Resolve lokyy.local at the Node level via DNS hooks isn't easy; rely on
// /etc/hosts being set OR Playwright. For curl-style smoke, we POST through
// `bun fetch` which uses the default resolver — Oliver already has the
// /etc/hosts entry in place per memory.

async function call(path: string, init?: RequestInit) {
  const cookieJar: Record<string, string> = {};
  return fetch(BASE + path, {
    ...FETCH_OPTS,
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

let passed = 0;
let failed = 0;
const ok = (s: string) => { console.log(`  ✓ ${s}`); passed++; };
const fail = (s: string, m: string) => { console.log(`  ✗ ${s}: ${m}`); failed++; };

// Step 1: sign in
const signinResp = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: JSON.stringify({ email: "oliver@lokyy.local", password: "supersecure123" }),
});
const cookies = signinResp.headers.getSetCookie?.() ?? [];
const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
if (signinResp.status !== 200) {
  fail("sign-in", `HTTP ${signinResp.status}`);
  process.exit(1);
}
ok("sign-in");

// Step 2: /v1/models — expect 200 + hermes-agent
const modelsResp = await call("/api/hermes/v1/models", {
  headers: { Cookie: cookieHeader },
});
if (modelsResp.status !== 200) {
  fail("/v1/models", `HTTP ${modelsResp.status}`);
} else {
  const body = (await modelsResp.json()) as { data?: Array<{ id: string }> };
  if (body?.data?.some((m) => m.id === "hermes-agent")) {
    ok("/v1/models lists hermes-agent");
  } else {
    fail("/v1/models", `model 'hermes-agent' missing in ${JSON.stringify(body).slice(0, 200)}`);
  }
}

// Step 3: chat completion — Hermes either succeeds (provider key set)
// or returns "No inference provider configured". Both prove the wiring.
const chatResp = await call("/api/hermes/v1/chat/completions", {
  method: "POST",
  headers: { Cookie: cookieHeader },
  body: JSON.stringify({
    model: "hermes-agent",
    messages: [{ role: "user", content: "Sag in einem Wort hi." }],
    stream: false,
  }),
});
const chatBody = await chatResp.text();
if (chatResp.status === 200) {
  ok("/v1/chat/completions returned 200 (provider key set, full chat works)");
} else if (chatResp.status === 500 && chatBody.includes("No inference provider configured")) {
  ok("/v1/chat/completions reached Hermes (no provider key yet — expected)");
} else {
  fail("/v1/chat/completions", `HTTP ${chatResp.status}: ${chatBody.slice(0, 200)}`);
}

console.log("");
console.log(`Phase-2a verification: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
