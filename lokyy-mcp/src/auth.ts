/**
 * Auth surface for lokyy-mcp.
 *
 * Two acceptable credentials:
 *   - System Bearer (`LOKYY_SYSTEM_SECRET`) — full privilege, used by
 *     System Skills (Lokyy-owned TS code running in this container).
 *   - Capability Bearer (`Capability-<tokenId>-<secret>`) — narrow scope,
 *     issued at runtime by Lokyy when a User-Skill needs a specific
 *     Lokyy write path. Validation in capabilities.ts.
 */
import type { Context, Next } from "hono";
import { validateBearer, type CapabilityRecord } from "./capabilities.ts";

const SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

if (!SYSTEM_SECRET) {
  console.error(
    "[lokyy-mcp] FATAL: LOKYY_SYSTEM_SECRET not set — every request will be denied"
  );
}

export type Principal =
  | { kind: "system"; label: "system" }
  | { kind: "capability"; record: CapabilityRecord };

const PRINCIPAL_KEY = "__lokyy_principal__";

export function getPrincipal(c: Context): Principal | null {
  return (c.get(PRINCIPAL_KEY) ?? null) as Principal | null;
}

/** Bearer gate — accepts System or any non-revoked Capability token. */
export const requireBearer = async (c: Context, next: Next) => {
  const header = c.req.header("Authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return c.json({ error: "missing_bearer" }, 401);

  const token = m[1]!.trim();

  if (SYSTEM_SECRET && timingSafeEqual(token, SYSTEM_SECRET)) {
    c.set(PRINCIPAL_KEY as never, { kind: "system", label: "system" } as never);
    return next();
  }

  if (token.startsWith("Capability-")) {
    const result = validateBearer(token);
    if (!result.ok) {
      return c.json(
        { error: "invalid_capability", reason: result.reason },
        401
      );
    }
    c.set(
      PRINCIPAL_KEY as never,
      { kind: "capability", record: result.record } as never
    );
    return next();
  }

  return c.json({ error: "invalid_token" }, 401);
};

/** Stricter gate — only the System bearer passes. Used for admin routes. */
export const requireSystem = async (c: Context, next: Next) => {
  const header = c.req.header("Authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return c.json({ error: "missing_bearer" }, 401);
  const token = m[1]!.trim();
  if (!SYSTEM_SECRET || !timingSafeEqual(token, SYSTEM_SECRET)) {
    return c.json({ error: "system_only" }, 403);
  }
  c.set(PRINCIPAL_KEY as never, { kind: "system", label: "system" } as never);
  await next();
};

/** Constant-time compare so we don't leak length via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
