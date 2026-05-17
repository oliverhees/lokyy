/**
 * Capability-Token store (ISC-85, ADR-008 §3).
 *
 * System Skills (Bearer LOKYY_SYSTEM_SECRET) call /admin/capabilities to
 * mint narrow-scoped tokens for User-Skills. Each token grants exactly
 * one operation on one target (e.g. "save data to dashboard 'ki-news'"),
 * is revocable, and every use is audited.
 *
 * Storage: JSON file at /app/data/capabilities.json (shared volume,
 * persists across container restarts). Audit-log appended as JSONL at
 * /app/data/audit.jsonl (same atomic-append pattern as the supervisor
 * activity log).
 *
 * Phase-3 swap-target: lokyy-brain. Interface stays.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

const STORE_PATH =
  process.env.LOKYY_CAPABILITY_STORE ?? "/app/data/capabilities.json";
const AUDIT_PATH =
  process.env.LOKYY_AUDIT_LOG ?? "/app/data/audit.jsonl";

export type CapabilityScope =
  // Phase-4 first scope — Producer-Skills writing back to "their" dashboard
  | "lokyy.dashboards.save_data";
// Future scopes get added here as System Skills introduce them.

export type CapabilityRecord = {
  tokenId: string;
  /** Full bearer string the holder presents (`Capability-<id>-<secret>`). */
  bearer: string;
  scope: CapabilityScope;
  /** Optional target the scope is bound to, e.g. dashboard id. */
  target?: string;
  /** Free-form note for the audit trail — who issued it and why. */
  issuedBy: string;
  issuedAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
  useCount: number;
};

type Store = { capabilities: CapabilityRecord[] };

function ensureDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function read(): Store {
  if (!existsSync(STORE_PATH)) return { capabilities: [] };
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return { capabilities: [] };
  }
}

function write(store: Store) {
  ensureDir(STORE_PATH);
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function audit(entry: Record<string, unknown>) {
  ensureDir(AUDIT_PATH);
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n";
  try {
    appendFileSync(AUDIT_PATH, line);
  } catch (err) {
    console.error("[capabilities] audit-log write failed:", err);
  }
}

export function issueCapability(input: {
  scope: CapabilityScope;
  target?: string;
  issuedBy: string;
}): CapabilityRecord {
  const tokenId = randomBytes(8).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const record: CapabilityRecord = {
    tokenId,
    bearer: `Capability-${tokenId}-${secret}`,
    scope: input.scope,
    target: input.target,
    issuedBy: input.issuedBy,
    issuedAt: new Date().toISOString(),
    useCount: 0,
  };
  const store = read();
  store.capabilities.push(record);
  write(store);
  audit({
    op: "issue",
    tokenId,
    scope: record.scope,
    target: record.target,
    issuedBy: record.issuedBy,
  });
  return record;
}

export function revokeCapability(tokenId: string, by: string): boolean {
  const store = read();
  const rec = store.capabilities.find((c) => c.tokenId === tokenId);
  if (!rec) return false;
  if (rec.revokedAt) return false;
  rec.revokedAt = new Date().toISOString();
  write(store);
  audit({ op: "revoke", tokenId, by });
  return true;
}

export function listCapabilities(): CapabilityRecord[] {
  return read().capabilities;
}

export type CapabilityValidationResult =
  | { ok: true; record: CapabilityRecord }
  | { ok: false; reason: "unknown" | "revoked" };

export function validateBearer(
  bearerValue: string
): CapabilityValidationResult {
  const store = read();
  const rec = store.capabilities.find((c) => c.bearer === bearerValue);
  if (!rec) return { ok: false, reason: "unknown" };
  if (rec.revokedAt) return { ok: false, reason: "revoked" };
  // Bump use counter — atomic-ish; under contention worst case is a
  // slightly stale counter, which is fine for audit purposes.
  rec.useCount += 1;
  rec.lastUsedAt = new Date().toISOString();
  write(store);
  return { ok: true, record: rec };
}

export function authorize(
  record: CapabilityRecord,
  required: { scope: CapabilityScope; target?: string }
): { ok: boolean; reason?: "scope_mismatch" | "target_mismatch" } {
  if (record.scope !== required.scope) {
    audit({
      op: "deny",
      tokenId: record.tokenId,
      reason: "scope_mismatch",
      required: required.scope,
      actual: record.scope,
    });
    return { ok: false, reason: "scope_mismatch" };
  }
  if (required.target && record.target && record.target !== required.target) {
    audit({
      op: "deny",
      tokenId: record.tokenId,
      reason: "target_mismatch",
      required: required.target,
      actual: record.target,
    });
    return { ok: false, reason: "target_mismatch" };
  }
  return { ok: true };
}

export function recordUse(
  tokenId: string,
  op: string,
  outcome: "allow" | "deny"
) {
  audit({ op: "use", tokenId, action: op, outcome });
}
