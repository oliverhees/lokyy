import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { auth } from "./auth.ts";

const app = new Hono();

app.use("*", logger());

// CORS: trust the lokyy frontend origin; credentialed so cookies flow.
app.use(
  "*",
  cors({
    origin: (origin) => {
      const trusted = (process.env.AUTH_TRUSTED_ORIGINS ?? "https://lokyy.local")
        .split(",")
        .map((s) => s.trim());
      if (!origin) return trusted[0] ?? "https://lokyy.local";
      return trusted.includes(origin) ? origin : "";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Public health + version endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.text("OK", 200));

app.get("/api/version", (c) =>
  c.json({
    service: "lokyy-os-be",
    version: "0.2.0",
    phase: "Phase-1b auth",
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Better-Auth handler — mounts /api/auth/* (sign-in, sign-up, sign-out, …)
// ─────────────────────────────────────────────────────────────────────────────

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ─────────────────────────────────────────────────────────────────────────────
// Application endpoints (guarded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * /api/me — returns the authenticated user, or 401.
 */
app.get("/api/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
      createdAt: session.user.createdAt,
    },
  });
});

/**
 * /api/setup-needed — true if no user exists yet (first-run).
 * Used by the frontend to decide whether to redirect to /setup or /login.
 */
async function countUsers(): Promise<number> {
  const k = (auth.options.database as any).db as any;
  const { count } = (await k
    .selectFrom("user")
    .select((eb: any) => eb.fn.countAll().as("count"))
    .executeTakeFirst()) as { count: number | bigint };
  return typeof count === "bigint" ? Number(count) : count;
}

/**
 * /api/lokyy/owner-exists — the shape lokyy-app expects.
 * Returns `true` once an owner account exists; routes use this to decide
 * between /login and /setup at first paint.
 */
app.get("/api/lokyy/owner-exists", async (c) => {
  const n = await countUsers();
  return c.json({ ownerExists: n > 0 });
});

// Kept for backwards compatibility with my Phase-1b scaffold's frontend; can
// be removed once the older lokyy-os-fe is gone.
app.get("/api/setup-needed", async (c) => {
  const n = await countUsers();
  return c.json({ setupNeeded: n === 0 });
});

app.notFound((c) =>
  c.json({ error: "not_found", path: c.req.path }, 404)
);

const port = Number(process.env.PORT ?? 80);
console.log(`lokyy-os-be (Phase-1b) listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
