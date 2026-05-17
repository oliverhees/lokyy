/**
 * lokyy-supervisor — Layer-3 watchdog.
 *
 * Polls Hermes health on a fixed cadence (default 60s). Appends an event
 * line to /app/data/activity.jsonl every tick. On consecutive failures,
 * restarts the Hermes container via docker-socket-proxy. Detects laptop-
 * sleep / paused-stack via wall-clock-vs-elapsed comparison and logs a
 * single 'catch-up' event without firing duplicate restarts.
 *
 * See ADR-007 for the design rationale.
 */
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS ?? 60_000);
const MAX_MISSED_TICKS = Number(process.env.MAX_MISSED_TICKS ?? 2);
const HERMES_HEALTH_URL =
  process.env.HERMES_HEALTH_URL ?? "http://hermes:8642/health";
const DOCKER_API_BASE =
  process.env.DOCKER_API_BASE ?? "http://docker-socket-proxy:2375";
const HERMES_CONTAINER_NAME =
  process.env.HERMES_CONTAINER_NAME ?? "lokyy-hermes-1";
const ACTIVITY_LOG_PATH =
  process.env.ACTIVITY_LOG_PATH ?? "/app/data/activity.jsonl";
const HEALTH_TIMEOUT_MS = 5_000;
const RESTART_COOLDOWN_MS = 90_000;

type Event = {
  at: string;
  kind:
    | "tick"
    | "hermes-down"
    | "hermes-restart"
    | "hermes-restart-failed"
    | "hermes-missing"
    | "catch-up";
  service?: string;
  message?: string;
  ok?: boolean;
};

const MISSING_CONTAINER_BACKOFF_MS = 30 * 60_000; // 30 minutes between gripes

function ensureLogDir() {
  const dir = dirname(ACTIVITY_LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function record(ev: Omit<Event, "at">) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...ev }) + "\n";
  try {
    appendFileSync(ACTIVITY_LOG_PATH, line);
  } catch (err) {
    // Last resort — log to stdout if file write fails (e.g. volume gone).
    console.error("[supervisor] activity-log write failed:", err);
  }
  console.log("[supervisor]", line.trim());
}

async function checkHermes(): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HERMES_HEALTH_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: (err as Error).message };
  }
}

type RestartResult =
  | { ok: true }
  | { ok: false; missing: true; error: string }
  | { ok: false; missing?: false; error: string };

async function restartHermes(): Promise<RestartResult> {
  try {
    const url = `${DOCKER_API_BASE}/containers/${HERMES_CONTAINER_NAME}/restart`;
    const res = await fetch(url, { method: "POST" });
    if (res.status === 204 || res.ok) return { ok: true };
    const body = await res.text();
    // Docker returns 404 with a "No such container" payload when the container
    // is actually gone (not just stopped). Distinguish so we don't loop forever.
    const missing = res.status === 404 && /no such container/i.test(body);
    return { ok: false, missing, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function main() {
  ensureLogDir();
  console.log(
    `[supervisor] starting · tick=${TICK_INTERVAL_MS}ms · maxMissed=${MAX_MISSED_TICKS} ` +
      `· target=${HERMES_HEALTH_URL} · log=${ACTIVITY_LOG_PATH}`
  );

  let missedTicks = 0;
  let lastTickAt = 0;
  let lastRestartAt = 0;
  let lastMissingLogAt = 0;

  // Run one tick immediately so the activity log shows a heartbeat
  // straight after container start instead of waiting a full interval.
  await tick();
  setInterval(tick, TICK_INTERVAL_MS);

  async function tick() {
    const now = Date.now();
    if (lastTickAt && now - lastTickAt > 2.5 * TICK_INTERVAL_MS) {
      record({
        kind: "catch-up",
        message: `Detected ${Math.round((now - lastTickAt) / 1000)}s gap — likely sleep/pause`,
        ok: true,
      });
    }
    lastTickAt = now;

    const health = await checkHermes();
    if (health.ok) {
      record({ kind: "tick", service: "hermes", ok: true });
      missedTicks = 0;
      return;
    }

    missedTicks++;
    record({
      kind: "hermes-down",
      service: "hermes",
      message: `miss ${missedTicks}/${MAX_MISSED_TICKS}: ${health.error}`,
      ok: false,
    });

    if (missedTicks < MAX_MISSED_TICKS) return;

    // Cooldown prevents thrashing if the previous restart didn't help yet.
    if (now - lastRestartAt < RESTART_COOLDOWN_MS) {
      record({
        kind: "hermes-down",
        service: "hermes",
        message: `restart cooldown active (${Math.round((RESTART_COOLDOWN_MS - (now - lastRestartAt)) / 1000)}s left)`,
        ok: false,
      });
      return;
    }

    const r = await restartHermes();
    if (r.ok) {
      lastRestartAt = Date.now();
      record({ kind: "hermes-restart", service: "hermes", ok: true });
      missedTicks = 0;
      return;
    }

    // Container truly removed (not just stopped) — auto-restart can't help.
    // Log once per long backoff window so the activity feed isn't a wall
    // of identical 404s. Operator must `docker compose up -d hermes`.
    if (r.missing) {
      const since = Date.now() - lastMissingLogAt;
      if (lastMissingLogAt === 0 || since > MISSING_CONTAINER_BACKOFF_MS) {
        record({
          kind: "hermes-missing",
          service: "hermes",
          message: `Container '${HERMES_CONTAINER_NAME}' does not exist — run 'docker compose up -d hermes'`,
          ok: false,
        });
        lastMissingLogAt = Date.now();
      }
      // Don't count missed ticks against the restart threshold while gone;
      // we'd just thrash on the next round otherwise.
      missedTicks = 0;
      return;
    }

    // Generic restart failure — log every time, keep retry pressure.
    lastRestartAt = Date.now();
    record({
      kind: "hermes-restart-failed",
      service: "hermes",
      message: r.error,
      ok: false,
    });
  }
}

main().catch((err) => {
  console.error("[supervisor] fatal:", err);
  process.exit(1);
});
