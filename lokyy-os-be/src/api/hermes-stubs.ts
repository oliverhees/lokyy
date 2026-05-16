/**
 * /api/hermes/* — proxy to the Hermes Agent container's OpenAI-compatible
 * HTTP server. Falls back to a 503 with a clear phase note when Hermes is
 * not deployed or auth is missing.
 *
 * Upstream:
 *   ${HERMES_BASE_URL:-http://hermes:8642}
 * Auth:
 *   Authorization: Bearer ${HERMES_API_KEY}    (must match Hermes side)
 *
 * Streaming responses (Server-Sent Events for chat completions) pass through
 * unchanged because we return the upstream Response body directly.
 */
import { Hono } from "hono";

const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? "http://hermes:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY;

export const hermesStubs = new Hono();

hermesStubs.all("/*", async (c) => {
  if (!HERMES_API_KEY) {
    return c.json(
      {
        error: "hermes_not_configured",
        message:
          "HERMES_API_KEY is not set in the lokyy-os-be environment. Re-run `lokyy install` to generate one.",
        phase: "Phase-2a",
        path: c.req.path,
      },
      503
    );
  }

  // Strip the /api/hermes prefix to forward the canonical Hermes path.
  // Example: /api/hermes/v1/chat/completions → /v1/chat/completions
  const apiPath = c.req.path.replace(/^\/api\/hermes/, "") || "/";
  const qs = c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : "";
  const url = HERMES_BASE_URL.replace(/\/$/, "") + apiPath + qs;

  // Forward method, content-type, and Hermes auth.
  const headers = new Headers();
  const ct = c.req.header("content-type");
  if (ct) headers.set("Content-Type", ct);
  headers.set("Authorization", `Bearer ${HERMES_API_KEY}`);

  let body: BodyInit | undefined = undefined;
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    body = await c.req.raw.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: c.req.method,
      headers,
      body,
      // Hermes streams chat completions via SSE — keep duplex half-open.
      // @ts-expect-error — Bun's fetch supports duplex; @types not aligned.
      duplex: "half",
    });
  } catch (err) {
    return c.json(
      {
        error: "hermes_unreachable",
        message: `Failed to reach Hermes at ${HERMES_BASE_URL}: ${(err as Error).message}`,
        phase: "Phase-2a",
        path: c.req.path,
      },
      503
    );
  }

  // Pass upstream response through unchanged (body, headers, status).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
});
