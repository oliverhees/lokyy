import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: (origin) => origin ?? "*" }));

// Health probe used by Docker healthcheck and the Lokyy supervisor (Phase-2).
app.get("/health", (c) => c.text("OK", 200));

// Version/identity endpoint — Phase-1 frontend calls this on first paint.
app.get("/api/version", (c) =>
  c.json({
    service: "lokyy-os-be",
    version: "0.1.0",
    phase: "Phase-1 scaffold",
  })
);

// Default catch-all for unmatched /api/* paths.
app.notFound((c) =>
  c.json({ error: "not_found", path: c.req.path }, 404)
);

const port = Number(process.env.PORT ?? 80);
console.log(`lokyy-os-be listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
