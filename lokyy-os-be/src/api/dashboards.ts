/**
 * /api/lokyy/dashboards — FE-facing surface for the Dashboards feature.
 *
 * Read paths (list, view-html, data, metadata) read directly from the
 * shared lokyy-os-db volume — same files lokyy-mcp wrote there. No MCP
 * round-trip needed for reads.
 *
 * Mutation paths (create, manual-run) proxy to lokyy-mcp using
 * LOKYY_SYSTEM_SECRET. The browser session must be a Better-Auth user;
 * lokyy-os-be is the trusted bridge — it never exposes the system
 * secret to the browser.
 */
import { Hono } from "hono";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const DASHBOARDS_ROOT = "/app/data/dashboards";
const MCP_URL = process.env.LOKYY_MCP_URL ?? "http://lokyy-mcp:7878";
const SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

type ProducerJson = {
  dashboardId: string;
  template: string;
  schedule: string;
  skillSpec: string;
  capabilityTokenId: string;
  createdAt: string;
  originalIntent?: string;
  /** User-customized title (overrides prettyTitle when set). */
  title?: string;
};

function ensureSecret(): void {
  if (!SYSTEM_SECRET) {
    throw new Error(
      "LOKYY_SYSTEM_SECRET not configured on lokyy-os-be — dashboards mutation calls cannot proceed"
    );
  }
}

function readProducer(id: string): ProducerJson | null {
  const p = join(DASHBOARDS_ROOT, id, "producer.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ProducerJson;
  } catch {
    return null;
  }
}

function safeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(id);
}

function listDashboardIds(): string[] {
  if (!existsSync(DASHBOARDS_ROOT)) return [];
  return readdirSync(DASHBOARDS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter(safeId);
}

function listRunDates(id: string): string[] {
  const runsDir = join(DASHBOARDS_ROOT, id, "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort()
    .reverse();
}

export const dashboards = new Hono();

dashboards.get("/", (c) => {
  const items = listDashboardIds()
    .map((id) => {
      const p = readProducer(id);
      if (!p) return null;
      const runs = listRunDates(id);
      return {
        id,
        title: p.title ?? prettyTitle(id, p.template),
        template: p.template,
        schedule: p.schedule,
        createdAt: p.createdAt,
        originalIntent: p.originalIntent,
        lastRunDate: runs[0] ?? null,
        runCount: runs.length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // newest first
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return c.json({ dashboards: items });
});

dashboards.get("/:id", (c) => {
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const p = readProducer(id);
  if (!p) return c.json({ error: "not_found" }, 404);
  const runs = listRunDates(id);
  return c.json({
    dashboard: {
      id,
      title: p.title ?? prettyTitle(id, p.template),
      template: p.template,
      schedule: p.schedule,
      createdAt: p.createdAt,
      originalIntent: p.originalIntent,
      capabilityTokenId: p.capabilityTokenId,
      runs,
    },
  });
});

dashboards.get("/:id/view", (c) => {
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const viewPath = join(DASHBOARDS_ROOT, id, "view.html");
  if (!existsSync(viewPath)) return c.json({ error: "not_found" }, 404);
  const html = readFileSync(viewPath, "utf8");
  return c.body(html, 200, {
    "Content-Type": "text/html; charset=utf-8",
    // The iframe is sandboxed; CSP just hardens it further.
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
  });
});

dashboards.get("/:id/data", (c) => {
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const dateParam = c.req.query("date");
  const dates = listRunDates(id);
  const date = dateParam ?? dates[0];
  if (!date) return c.json({ payload: null, runAt: null, date: null });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "bad_date" }, 400);
  }
  const file = join(DASHBOARDS_ROOT, id, "runs", `${date}.json`);
  if (!existsSync(file)) return c.json({ payload: null, runAt: null, date });
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as {
      runAt: string;
      payload: unknown;
    };
    return c.json({ payload: data.payload, runAt: data.runAt, date });
  } catch {
    return c.json({ error: "corrupt_run_file" }, 500);
  }
});

dashboards.post("/from-intent", async (c) => {
  ensureSecret();
  const body = (await c.req.json().catch(() => ({}))) as { intent?: string };
  if (!body.intent || typeof body.intent !== "string" || body.intent.trim().length < 3) {
    return c.json({ error: "intent must be a string of >=3 chars" }, 400);
  }
  // Proxy to lokyy-mcp /tools/lokyy.dashboards.create_via_builder/invoke
  const r = await fetch(`${MCP_URL}/tools/lokyy.dashboards.create_via_builder/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SYSTEM_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ intent: body.intent.trim() }),
  });
  const data = (await r.json()) as
    | { ok: true; result: { dashboardId: string; template: string; producer: unknown } }
    | { ok: false; error: string };
  if (!data.ok) return c.json({ error: data.error }, 502);
  // Strip producer.capabilityBearer from the response so the browser
  // never sees the producer's bearer token (security: that bearer is
  // for the Producer-Skill runtime, not for the user).
  const safeResult = {
    dashboardId: data.result.dashboardId,
    template: data.result.template,
  };
  return c.json(safeResult, 201);
});

dashboards.post("/:id/run", async (c) => {
  ensureSecret();
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const p = readProducer(id);
  if (!p) return c.json({ error: "not_found" }, 404);
  // Invoke lokyy-mcp's run_now tool — pure server-to-server, system bearer.
  const r = await fetch(`${MCP_URL}/tools/lokyy.dashboards.run_now/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SYSTEM_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dashboardId: id }),
  });
  const data = (await r.json()) as
    | { ok: true; result: { runDate: string; itemCount: number } }
    | { ok: false; error: string };
  if (!data.ok) return c.json({ error: data.error }, 502);
  return c.json({
    ok: true,
    runDate: data.result.runDate,
    itemCount: data.result.itemCount,
  });
});

// Update a dashboard's mutable fields. Right now only schedule (cron) and
// title (display string) are editable — template + capability + intent are
// anchored at creation time. Re-generating the view itself lands with the
// LLM-Wizard later (Phase-4.x).
dashboards.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const p = readProducer(id);
  if (!p) return c.json({ error: "not_found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as {
    schedule?: string;
    title?: string;
  };

  if (body.schedule !== undefined) {
    if (typeof body.schedule !== "string" || !isPlausibleCron(body.schedule)) {
      return c.json({ error: "invalid_schedule", note: "expected 5-field cron like '0 8 * * *'" }, 400);
    }
    p.schedule = body.schedule.trim();
  }
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length < 1) {
      return c.json({ error: "invalid_title" }, 400);
    }
    p.title = body.title.trim();
  }

  writeFileSync(
    join(DASHBOARDS_ROOT, id, "producer.json"),
    JSON.stringify(p, null, 2)
  );
  return c.json({
    dashboard: {
      id,
      title: p.title ?? prettyTitle(id, p.template),
      template: p.template,
      schedule: p.schedule,
      createdAt: p.createdAt,
      originalIntent: p.originalIntent,
      capabilityTokenId: p.capabilityTokenId,
    },
  });
});

// Delete a dashboard entirely — directory + all runs + producer-skill.
// Also revokes the producer's capability via lokyy-mcp /admin so the
// token is invalidated even if some Producer process still holds it.
dashboards.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!safeId(id)) return c.json({ error: "invalid_id" }, 400);
  const dir = join(DASHBOARDS_ROOT, id);
  if (!existsSync(dir)) return c.json({ error: "not_found" }, 404);

  // Try to revoke the capability so dangling tokens can't authenticate.
  // Best-effort — if MCP is unreachable we still proceed with the file
  // deletion (the capability becomes useless anyway since the dashboard
  // is gone and save_data's ensureDashboardExists will block writes).
  const p = readProducer(id);
  if (p?.capabilityTokenId && SYSTEM_SECRET) {
    try {
      await fetch(
        `${MCP_URL}/admin/capabilities/${encodeURIComponent(p.capabilityTokenId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${SYSTEM_SECRET}` },
        }
      );
    } catch {
      // ignore — proceed with delete
    }
  }

  rmSync(dir, { recursive: true, force: true });
  return c.json({ ok: true, id });
});

/** Very loose cron-format check — 5 whitespace-separated fields. Real
 *  validation happens in Hermes-cron later; here we just block obvious junk. */
function isPlausibleCron(s: string): boolean {
  const fields = s.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  // Each field is digits, *, /, -, ,
  return fields.every((f) => /^[\d*/,-]+$/.test(f));
}

function prettyTitle(id: string, template: string): string {
  if (template === "ki-news") return "KI-News";
  if (template === "email-digest") return "Email-Digest";
  // Fallback: capitalize the id portion before the suffix
  const head = id.split("-").slice(0, -1).join("-");
  return head ? head.replace(/(^|-)\w/g, (s) => s.toUpperCase()) : id;
}
