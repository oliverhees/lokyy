# ADR-008 — Lokyy System Bus (MCP), System Skills, Capability-Tokens

- **Status:** accepted
- **Date:** 2026-05-17
- **Phase:** Phase-4 (Custom Dashboards is the first consumer, but the bus itself is platform-wide)

## Context

Up through Phase-2b, Lokyy components talk to each other over an internal HTTP-API (`lokyy-os-be`). That works while Lokyy is just an FE-with-backend. But two new requirements pulled us past that surface:

1. **Agent-driven system operations.** Hermes-LLM should be able to call privileged Lokyy operations (e.g. "create a Dashboard") as native tools, not by hand-rolling HTTP curl-calls inside skill code.
2. **System vs User trust boundary.** Lokyy ships its own *System Skills* (DashboardBuilder, MemoryCurator, NotificationRouter, …). They are platform-managed, immutable from the user, and need privileged Lokyy-state access. *User Skills* are whatever a user writes — they should not have automatic access to internal state.

Without a clean trust boundary, "User-Skill exfiltrates dashboard data of another user / silently rewrites system config" is one prompt-injection away.

## Decision

Three architectural constants:

### 1. `lokyy-mcp` is the System Bus
- New Bun service `lokyy-mcp` exposing the MCP protocol (SSE over the lokyy-net)
- Binds **only** to `lokyy-net` — not reachable from the public internet, not even via Traefik
- Hosts all System Skills as registered MCP tools
- Authentication: Bearer token (`LOKYY_SYSTEM_SECRET`) for full privilege; `Capability-<scope-token>` for narrow scopes (see §3)
- This is the *single* sanctioned channel for agents to mutate Lokyy state

### 2. System Skills are Lokyy-owned TypeScript code
- Live in `lokyy-mcp/src/system-skills/{SkillName}/`
- Versioned with the Lokyy release, committed to the Lokyy repo, **immutable** from the user
- They are not Hermes-skill-format — they are Bun/TS workflows. Hermes sees them only as MCP tool signatures, never their source
- They may call any service over lokyy-net (`lokyy-os-be`, `lokyy-brain`, Hermes' chat-completion API, etc.) — this is where privileged work happens
- Examples for the first release: `DashboardBuilder`, `MemoryCurator`, `NotificationRouter`, `ConversationIndexer`, `TelosReader`

### 3. Capability-Tokens for narrow-scoped User-Skill access
- User Skills (Hermes-skill format, user-editable) have **no** default MCP access
- When a System Skill creates an artifact that needs a User-Skill to write back (e.g. DashboardBuilder generates a Producer-Skill that needs to save data), Lokyy-MCP issues a **capability token** with a hard-coded narrow scope:
  - `scope: "lokyy.dashboards.save_data"`
  - `target: "ki-news"` (specific dashboard id, not all)
  - `revocable: true`
- The token is injected into the User-Skill at run-time (env var)
- Lokyy-MCP validates: token → scope check → target check → allow/deny per call
- Token is auditable (every call records token-id + skill-id)
- Revoke = delete dashboard, rotate, or operator action

```
                    Privilege ladder

  ───────────────────────────────────────────────────────────────────
   System-Skill (Lokyy-TS in lokyy-mcp)     ←  Bearer LOKYY_SYSTEM_SECRET
                                                (one secret, full access)

   User-Skill with capability               ←  Bearer Capability-<scope>
                                                (many, scoped per use-case)

   User-Skill (plain Hermes-skill)          ←  no auth
                                                → 401
  ───────────────────────────────────────────────────────────────────
```

## Why these choices

| Aspect | Two Hermes-Containers | Skill-Sandbox (in Hermes) | **System-Skill = Lokyy-TS (chosen)** |
|---|---|---|---|
| Token leakage risk | Low (container boundary) | High (runtime-only trust) | **Eliminated** — token never in Hermes |
| Resource cost | 2× Hermes | 1× Hermes | 1× Hermes + thin `lokyy-mcp` |
| Routing complexity | High ("which Hermes?") | Medium | **Trivial** (one MCP endpoint) |
| Dependency on Hermes features | None | Requires per-skill ENV isolation | **None** |
| Audit surface | Two places | Hermes-internal | **One place** (`lokyy-mcp/src` in git) |

## Topology (target state, Phase-4)

```
┌────────────────┐         ┌──────────────────────────────┐
│  Hermes        │         │  lokyy-mcp                   │
│  (LLM-side)    │         │  - MCP server (SSE)          │
│                │  MCP    │  - System Skills (TS code)   │
│  user-skills   │ ──────► │    • DashboardBuilder        │
│  + capability  │         │    • MemoryCurator           │
│    tokens      │         │    • NotificationRouter      │
│  + std tools   │         │    • ConversationIndexer     │
└────────┬───────┘         │    • TelosReader             │
         │                 │  - Capability-token validator│
         │                 └────────────┬─────────────────┘
         │                              │ HTTP (lokyy-net)
         │                              ▼
         │                 ┌──────────────────────────────┐
         │                 │  lokyy-os-be                 │
         └────────────────►│  (HTTP-API for FE)           │
            HTTP for chat  │  + auth + activity + ...     │
            completion     └──────────────────────────────┘
```

## Consequences

### Positive
- **One sanctioned write path** for agent-driven Lokyy state changes (mirrors ADR-006's "validation lives only in brain" principle, here for state writes)
- **System Skills become first-class** — versioned, audited, easy to add more (one TS-folder per skill)
- **User Skills stay sandboxed** by default, only get capability when explicitly granted
- **MCP is now an asset**, not just for Dashboards — Phase-5+ can use the same bus

### Negative
- New service (`lokyy-mcp`) to operate, secure, version
- Capability-token system is a small auth-substrate to build and maintain
- System-Skill development is TS-only — no Hermes-skill-format reuse for these (intentional)

### Migration / Phasing
- **Phase-4** introduces `lokyy-mcp` with first System Skill (`DashboardBuilder`) + capability-token mechanism (one scope: `dashboards.save_data`)
- **Phase-5+** adds more System Skills incrementally; same bus
- **Phase-3 (lokyy-brain)** will be reachable from System Skills over lokyy-net once it's live

## Out of scope (deferred)

- mTLS between Hermes and lokyy-mcp — Bearer-on-internal-net is enough for v1
- Per-user Capability-tokens — single-user MVP doesn't need it yet
- Audit log surface in the FE — for now the audit-log is JSONL on the lokyy-os-db volume

## Related ADRs

- **ADR-005** — service auth and audit (Bearer-token pattern reused here)
- **ADR-006** — validation lives only in brain (parallel doctrine: "system writes live only in lokyy-mcp")
- **ADR-007** — supervisor as container (same container-first pattern)
