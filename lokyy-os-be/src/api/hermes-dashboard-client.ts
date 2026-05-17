/**
 * Lokyy-side client for the Hermes-Dashboard backend API.
 *
 * The Hermes-Dashboard process (port 9119) exposes a rich REST surface
 * (/api/sessions, /api/skills, /api/tools, /api/cron, /api/agents,
 *  /api/memory, /api/insights, /api/auth, /api/config, /api/plugins,
 *  /api/curator, /api/webhooks, /api/channels, /api/logs, /api/profiles,
 *  /api/models, /api/conversations, /api/status, …) that's gated by a
 * per-process session token. That token is injected into the dashboard's
 * HTML at boot as `window.__HERMES_SESSION_TOKEN__` — we scrape it out
 * once, cache it, and use it as `Authorization: Bearer …` for every
 * subsequent call.
 *
 * The token survives until the dashboard container restarts; if a 401
 * comes back later we force-refresh and retry once.
 */

const BASE_URL = process.env.HERMES_DASHBOARD_URL ?? "http://hermes-dashboard:9119";

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 30 * 60_000; // 30min before we re-scrape proactively

async function fetchSessionToken(): Promise<string> {
  const res = await fetch(BASE_URL + "/");
  if (!res.ok) {
    throw new Error(
      `hermes-dashboard HTML fetch failed: HTTP ${res.status} ${res.statusText}`
    );
  }
  const html = await res.text();
  const m = html.match(/__HERMES_SESSION_TOKEN__="([^"]+)"/);
  if (!m) {
    throw new Error("hermes-dashboard HTML did not contain __HERMES_SESSION_TOKEN__");
  }
  return m[1]!;
}

async function getToken(forceRefresh = false): Promise<string> {
  const stale =
    !cachedToken || Date.now() - tokenFetchedAt > TOKEN_TTL_MS;
  if (forceRefresh || stale) {
    cachedToken = await fetchSessionToken();
    tokenFetchedAt = Date.now();
  }
  return cachedToken!;
}

/**
 * Fetch any path on the hermes-dashboard backend with auto-injected auth.
 * Returns the upstream Response unchanged on first try; on 401 it
 * force-refreshes the token and retries exactly once.
 */
export async function dashFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(BASE_URL + path, { ...init, headers });
  if (res.status === 401) {
    token = await getToken(true);
    const retry = new Headers(init.headers);
    retry.set("Authorization", `Bearer ${token}`);
    res = await fetch(BASE_URL + path, { ...init, headers: retry });
  }
  return res;
}

/** Convenience: GET + parse JSON. Throws on non-2xx. */
export async function dashGet<T = unknown>(path: string): Promise<T> {
  const r = await dashFetch(path);
  if (!r.ok) {
    throw new Error(`hermes-dashboard ${path} → HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}
