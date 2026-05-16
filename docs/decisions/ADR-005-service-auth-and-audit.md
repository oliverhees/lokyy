# ADR-005 — Service-to-Service Auth + Audit Trail

- **Status**: Proposed
- **Date**: 2026-05-16
- **Authors**: Winston (BMAD-Architect), commissioned by Orchestrator
- **Closes**: Issue #80 (Phase-0.5 — Auth-Model Decision)
- **Relates to**: [ADR-002](ADR-002-auth-and-gateway-binding.md), [ADR-003](ADR-003-docker-topology-etappe-2.md), [ADR-004](ADR-004-lokyy-brain-mcp-contract.md), [ISA.md](../../ISA.md) (ISC-44, ISC-62)

---

## Context

When multiple Hermes-Subagents (Phase-2/4) and Cross-AI Bridge clients (Phase-6) write to `lokyy-brain`, the question "who wrote what" matters for:

1. **Audit & debugging** — when a bad note appears, we need to know which agent created it.
2. **Scope enforcement** — `mcp-scopes.yaml` (ADR-004 §3) declares per-identity permissions; brain must verify the requester's identity to apply them.
3. **Trust boundary** — lokyy-brain has `CORS=*` and no auth layer of its own (per ADR-003); a network-internal-only deployment is acceptable as a baseline, but per-agent identity gives a second, defence-in-depth layer.

Two natural options:

| | **Stateful tokens** (brain owns token table) | **Stateless JWT** (lokyy-os-be signs, brain verifies) |
|---|---|---|
| Source of truth | brain SQLite | shared secret |
| Revoke speed | immediate (delete row) | rotate secret OR denylist |
| Brain complexity | + token CRUD | none beyond JWT-verify |
| Bootstrap | "who creates first token?" problem | lokyy-os-be mints on startup |
| Audit ownership | brain naturally | brain still does it |
| Multi-process safety | row-locked | stateless |

Lokyy is single-server, single-user, single-tenant — there's no horizontal-scaling pressure. The decisive factors are **brain simplicity** (brain stays a thin layer over Forgejo) and **bootstrap clarity** (`lokyy-os-be` is the authority that mints tokens). Stateless JWT wins.

## Decision

### 1. Token format

- **JWT (HS256)** signed and verified with a shared symmetric secret `LOKYY_AGENT_JWT_SECRET` (32-byte random, in `.env.local`, chmod 0600).
- Claims:
  ```json
  {
    "iss": "lokyy-os-be",
    "sub": "<agent-identity>",          // e.g. "conductor", "researcher", "bridge-claude"
    "iat": 1747400000,
    "exp": 1747403600,                  // 1-hour lifetime
    "scope_v": 1                        // matches schema_version in mcp-scopes.yaml
  }
  ```
- `sub` MUST match an entry in `00_meta/mcp-scopes.yaml` (ADR-004 §3). brain rejects otherwise.
- `scope_v` lets us version the scope schema; brain rejects tokens minted against an older schema version.

### 2. Issuance

- `lokyy-os-be` exposes an **internal-only** endpoint: `POST /api/internal/agent-token`
  - Internal-only = bound to `lokyy-net` Docker network; no Traefik label → not reachable from outside (same pattern as `lokyy-brain` per ISC-44).
  - Body: `{ agent_id: string, ttl_seconds?: number }` (default TTL 3600).
  - Response: `{ token: string, exp: number }`.
- Each agent container has an `AGENT_ID` env var set at compose time (e.g. `AGENT_ID=conductor`). The agent calls `agent-token` on startup, caches the result, and refreshes ~5min before `exp`.
- For Phase-0.5 / Phase-2 bootstrap, the agent's startup script gets a one-shot token via `MCP_BOOTSTRAP_TOKEN` env var (minted at compose-up). Once running, it auto-refreshes from the live endpoint.

### 3. Verification

`lokyy-brain` middleware (every MCP call, every HTTP API call when called from internal agents):

1. Extract bearer token from `Authorization: Bearer <jwt>`.
2. Verify HS256 signature against `LOKYY_AGENT_JWT_SECRET`.
3. Check `exp` not passed.
4. Check `scope_v` matches current `00_meta/mcp-scopes.yaml` `schema_version`.
5. Look up `sub` in scopes → if absent, 403.
6. Apply scope to the requested tool + payload (read/write/type filter).
7. On success, log the call to `mcp-audit.jsonl`.

The shared secret lives in BOTH containers' env (`lokyy-os-be` to sign, `lokyy-brain` to verify). Same `.env.local`, same secret. Rotation = redeploy both with new secret.

### 4. Audit log

Format: append-only JSONL at `/data/mcp-audit.jsonl` inside the brain container (volume-mounted).

```json
{"ts":"2026-05-16T12:30:00.123Z","agent_id":"researcher","action":"notes.create_managed","target_type":"capture","target_id":"01J...","status":"ok","duration_ms":47}
{"ts":"2026-05-16T12:30:05.401Z","agent_id":"writer","action":"notes.read","target_type":"capture","target_id":"01J...","status":"ok","duration_ms":3}
{"ts":"2026-05-16T12:31:02.001Z","agent_id":"coder","action":"notes.create_managed","target_type":"decision","status":"scope_denied","duration_ms":1}
```

Fields:
- `ts` — ISO-8601 UTC
- `agent_id` — from JWT `sub`
- `action` — MCP tool name (or HTTP method+path for legacy callers)
- `target_type` — note type (where applicable)
- `target_id` — ULID (where applicable; only on existing notes)
- `status` — `ok | scope_denied | not_found | conflict | error`
- `duration_ms` — server-side processing time
- `error` (optional) — error code string when `status` != `ok`

**Never logged**: note `body`, request payload contents, token contents. Privacy by construction.

The activity log displayed in the Lokyy UI (Phase-5 ISC-21) is a read of this file, surfaced via lokyy-os-be (which is the only client trusted to read brain's audit).

### 5. Cross-AI Bridge

Bridge agents identify themselves the same way Hermes subagents do:

| Bridge | `AGENT_ID` | Scope entry needed in `mcp-scopes.yaml` |
|--------|------------|------------------------------------------|
| Claude Code | `bridge-claude` | yes — typically `notes.create [content, note]`, `notes.read [*]` |
| OpenClaw | `bridge-openclaw` | yes — same profile or tighter, per use case |

Their tokens are minted on the same `/api/internal/agent-token` flow by lokyy-os-be. No bridge-specific path.

### 6. Anti-patterns

| Forbidden | Why | Allowed instead |
|-----------|-----|-----------------|
| Passing the Lokyy user cookie or session JWT through to lokyy-brain | brain doesn't know about users; mixing user-auth with service-auth creates a privilege-escalation surface | Mint a separate agent token with `sub: <agent-id>` |
| Hardcoding a single shared API key for all agents | Defeats audit + scope enforcement | One identity per agent, one scope block per identity |
| Embedding the secret in a Docker image layer | Secret leaks via image pull | Inject at runtime via env from `.env.local` |
| Issuing tokens with TTL > 24h | Long TTL defeats rotation as a revocation mechanism | Default 1h; max 24h documented |
| Logging full request payloads | Privacy + log-bloat | Audit-log fields above only |

### 7. Bootstrap & rotation

- **Initial deploy**: `lokyy-installer` generates `LOKYY_AGENT_JWT_SECRET` as `openssl rand -hex 32` and writes it to `.env.local`. Same `.env.local` consumed by both `lokyy-os-be` and `lokyy-brain` containers.
- **Rotation**: `lokyy-installer rotate-secrets` generates a new value, writes it, `docker compose up -d` to redeploy. All outstanding tokens become invalid (1h pain window max).
- **Compromise response**: rotate immediately. Optionally add a `denylist.txt` of `(sub, iat-range)` pairs to brain config — rejects matching tokens even if still within `exp`.

## Consequences

### Positive

- Brain stays thin (no token CRUD, no DB beyond Forgejo).
- Bootstrap is trivial — lokyy-installer handles secret generation.
- Audit lives where the writes happen (single source of truth, no cross-container correlation).
- Cross-AI Bridge slots in without new infrastructure.
- Defence-in-depth: even if lokyy-brain becomes briefly reachable (network misconfig), agents without a valid token can't talk to it.

### Negative

- 1h pain window for revoke unless denylist is added. Acceptable for single-user; would need rethinking for multi-tenant.
- Shared secret must propagate to two containers. `.env.local` handles it cleanly today; a future Docker-Swarm or Kubernetes deploy would use a proper secret store.
- JWT library dependency in both lokyy-os-be (sign) and lokyy-brain (verify). Manageable — many small libs available.

### Mitigations

- `LOKYY_AGENT_JWT_SECRET` is required at startup; both containers fail-loud if absent (no silent fallback to a dev default).
- A brain-side counter logs "tokens-verified-since-startup" — drops in this metric flag a clock-skew or rotation issue early.
- `mcp-audit.jsonl` rotates daily (Phase-5 follow-up).

## Open questions (resolve before Phase-5)

1. **Audit-log retention** — daily-rotate is one answer; 30 days then compress is another. Decide when activity UI ships.
2. **Denylist mechanism** — file-watched yaml or env-list? Defer until first real rotation event.
3. **Per-agent token TTL override** — some agents (long-running curator) might want 6h, some (one-shot bridge) 5min. Trivially supported via the `ttl_seconds` request param; default stays 1h.

## Cross-references

- [ADR-002](ADR-002-auth-and-gateway-binding.md) — User-facing Better-Auth (separate concern; this ADR is service-to-service)
- [ADR-003](ADR-003-docker-topology-etappe-2.md) — Network isolation that makes `/api/internal/agent-token` safe to expose internally
- [ADR-004](ADR-004-lokyy-brain-mcp-contract.md) — Scopes (§3) that this ADR's tokens reference
- [ISA.md](../../ISA.md) — ISC-44 (network isolation), ISC-62 (per-agent tokens)
- Issues: #80 (this ADR closes), #79 (Concurrency-Audit will load-test under JWT-auth)
