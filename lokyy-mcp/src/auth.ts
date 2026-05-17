/**
 * Auth surface for lokyy-mcp.
 *
 * Two acceptable credentials:
 *   - System Bearer (`LOKYY_SYSTEM_SECRET`) — full privilege, used by
 *     System Skills (Lokyy-owned TS code running in this container).
 *   - Capability Bearer (`Capability-<id>`) — narrow scope, issued at
 *     runtime by Lokyy when a User-Skill needs a specific Lokyy write
 *     path (e.g. Producer-Skill saving to one Dashboard). Capability
 *     validation lives in src/capabilities.ts (next slice — ISC-85).
 *
 * For ISC-82–84 (skeleton) only the System Bearer path is implemented.
 */
import type { Context, Next } from "hono";

const SYSTEM_SECRET = process.env.LOKYY_SYSTEM_SECRET ?? "";

if (!SYSTEM_SECRET) {
  console.error(
    "[lokyy-mcp] FATAL: LOKYY_SYSTEM_SECRET not set — every request will be denied"
  );
}

export type Principal =
  | { kind: "system"; label: "system" }
  | { kind: "capability"; tokenId: string; scope: string; target?: string };

const PRINCIPAL_KEY = "__lokyy_principal__";

export function getPrincipal(c: Context): Principal | null {
  return (c.get(PRINCIPAL_KEY) ?? null) as Principal | null;
}

export const requireBearer = async (c: Context, next: Next) => {
  const header = c.req.header("Authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return c.json({ error: "missing_bearer" }, 401);

  const token = m[1]!.trim();

  if (SYSTEM_SECRET && timingSafeEqual(token, SYSTEM_SECRET)) {
    c.set(PRINCIPAL_KEY as never, { kind: "system", label: "system" } as never);
    return next();
  }

  // Capability tokens — placeholder for ISC-85. Anything matching the
  // 'Capability-' shape gets rejected for now until the validator lands.
  if (token.startsWith("Capability-")) {
    return c.json({ error: "capabilities_not_implemented_yet" }, 501);
  }

  return c.json({ error: "invalid_token" }, 401);
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
