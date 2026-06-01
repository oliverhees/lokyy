/**
 * brainAdapter.ts — thin HTTP client for writing managed notes into
 * lokyy-brain (the SSOT vault) from the OS backend.
 *
 * Epic Cron-AP1, Story C1. Contract is FIXED (see
 * `_bmad-output/planning-artifacts/epic-cron-ap1-brain-andockung.md`):
 *
 *   createManagedNote(input) →
 *     { ok: true, id, path }                         (HTTP 2xx)
 *   | { ok: false, reason: 'disabled' }              (LOKYY_BRAIN_URL unset)
 *   | { ok: false, reason: 'conflict' }              (HTTP 409 — ISC-42)
 *   | { ok: false, reason: 'unreachable' }           (network error / fetch threw)
 *   | { ok: false, reason: 'error' }                 (any other non-2xx, bad body)
 *
 * Design rules:
 *   - NEVER throws. Every failure path is a typed `{ ok: false, reason }`.
 *     The caller (fireJob) must be able to treat a Brain write as best-effort.
 *   - LOKYY_BRAIN_URL unset → 'disabled', analogous to the HERMES_API_KEY-skip
 *     in job-runner.ts. No fetch is attempted.
 *   - HTTP 409 is deterministic → 'conflict' (note already exists), NOT an error
 *     and NOT a throw (ISC-42).
 *   - Authorization: Bearer is only sent when LOKYY_BRAIN_TOKEN is set (Brain may
 *     run unauthenticated inside lokyy-net).
 *
 * Network reachability: env is read lazily inside each call so tests can flip
 * LOKYY_BRAIN_URL between cases without re-importing the module.
 */

export type ManagedNoteInput = {
  title: string;
  body: string;
  type: string;
  tags?: string[];
  folderHint?: string;
};

export type CreateManagedNoteResult =
  | { ok: true; id: string; path: string }
  | { ok: false; reason: "disabled" | "conflict" | "unreachable" | "error" };

function brainBaseUrl(): string {
  return (process.env.LOKYY_BRAIN_URL ?? "").trim();
}

function brainToken(): string {
  return (process.env.LOKYY_BRAIN_TOKEN ?? "").trim();
}

/**
 * Write a single managed note into lokyy-brain.
 *
 * POST `${LOKYY_BRAIN_URL}/api/notes/create-managed`
 *   body: { title, body, type, tags, folder_hint }
 *
 * Resolves to a typed result; never rejects.
 */
export async function createManagedNote(
  input: ManagedNoteInput,
): Promise<CreateManagedNoteResult> {
  const baseUrl = brainBaseUrl();
  // No Brain configured → graceful no-op (analogous to HERMES_API_KEY skip).
  if (!baseUrl) {
    return { ok: false, reason: "disabled" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/api/notes/create-managed`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = brainToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const payload = {
    title: input.title,
    body: input.body,
    type: input.type,
    tags: input.tags ?? [],
    folder_hint: input.folderHint,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // DNS failure, connection refused, timeout, etc.
    return { ok: false, reason: "unreachable" };
  }

  // ISC-42: a 409 means the note already exists — deterministic conflict,
  // not an error and not a throw.
  if (res.status === 409) {
    return { ok: false, reason: "conflict" };
  }

  if (!res.ok) {
    return { ok: false, reason: "error" };
  }

  try {
    const data = (await res.json()) as { id?: unknown; path?: unknown };
    const id = typeof data.id === "string" ? data.id : "";
    const path = typeof data.path === "string" ? data.path : "";
    if (!id || !path) {
      return { ok: false, reason: "error" };
    }
    return { ok: true, id, path };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * One-shot reachability probe used at server start (ISC-49). Logs status but
 * never throws and never blocks — Brain being down must not stop the OS.
 * Returns true if `${LOKYY_BRAIN_URL}/health` answered 2xx.
 */
export async function probeBrainHealth(): Promise<boolean> {
  const baseUrl = brainBaseUrl();
  if (!baseUrl) {
    console.log("[brain] LOKYY_BRAIN_URL unset — Brain integration disabled");
    return false;
  }
  const url = `${baseUrl.replace(/\/+$/, "")}/health`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      console.log(`[brain] health OK (${res.status}) at ${url}`);
      return true;
    }
    console.warn(`[brain] health check returned HTTP ${res.status} at ${url}`);
    return false;
  } catch (err) {
    console.warn(
      `[brain] health check unreachable at ${url}: ${(err as Error).message}`,
    );
    return false;
  }
}
