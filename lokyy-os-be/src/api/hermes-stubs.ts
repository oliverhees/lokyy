/**
 * Phase-1d stubs for /api/hermes/* — the chat-completion path the
 * lokyy-app chat screen expects.
 *
 * Real Hermes Agent integration lands in Phase-2 (own container with
 * the Hermes cron + subagent spawning + 40+ tools). Until then we
 * return a friendly 503 with a clear message instead of a TCP-error
 * cascade in the browser console.
 */
import { Hono } from "hono";

export const hermesStubs = new Hono();

hermesStubs.all("/*", (c) =>
  c.json(
    {
      error: "hermes_not_deployed",
      message:
        "Hermes Agent container is not deployed yet. Activated in Phase-2 of the Lokyy roadmap (see ISA.md).",
      phase: "Phase-1d",
      path: c.req.path,
    },
    503
  )
);
