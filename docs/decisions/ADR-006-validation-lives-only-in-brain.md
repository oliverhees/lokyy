# ADR-006 — Frontmatter Validation Lives Only in lokyy-brain

- **Status**: Proposed
- **Date**: 2026-05-16
- **Authors**: Winston (BMAD-Architect), commissioned by Orchestrator
- **Closes**: Issue #81 (Phase-0.5 — Frontmatter-Validation Location ADR)
- **Relates to**: [ADR-004](ADR-004-lokyy-brain-mcp-contract.md), [ADR-005](ADR-005-service-auth-and-audit.md), [ISA.md](../../ISA.md) (ISC-29, ISC-43, ISC-59)

---

## Context

`lokyy-brain` enforces a strict frontmatter contract on every note in the vault:

- `id` — ULID (26 chars, stable across renames)
- `type` — from a closed list: `note | capture | project | task | decision | meeting | customer | workflow | intervention | content`
- `title` — non-empty
- `created` — ISO-8601, immutable
- `updated` — ISO-8601, brain-managed
- per-type fields per `00_meta/schemas/*.json` (e.g. `task` may require `status`)

A pre-commit hook in the vault repo rejects any commit that violates these rules. The advisor cross-check on 2026-05-16 flagged the **single biggest contract-leak risk** in this design:

> External AI outputs (Cross-AI Bridge) get coerced into lokyy-brain's frontmatter schema by lokyy-os adapters. Validation logic is now FORKED. lokyy-brain's pre-commit hook is bypassed if adapters generate "almost-valid" frontmatter that brain accepts. Validation MUST live exclusively in lokyy-brain.

If validation lives in two places — once in lokyy-os adapters (constructing frontmatter for writes) and once in brain (rejecting at pre-commit) — the schemas drift. Adapters become a parallel source of truth that *might* match brain's actual rules.

The fix is structural: **adapters NEVER construct frontmatter. They submit intent. Brain renders frontmatter and runs validation.**

ADR-004 already specifies the mechanism (`notes.create_managed` MCP tool). This ADR locks it as policy and defines the enforcement.

## Decision

### 1. The rule

> **No code outside `lokyy-brain` may construct frontmatter, generate ULIDs, choose vault paths, or set `created` / `updated` timestamps.**

All writes from lokyy-os, Hermes subagents, Cross-AI Bridge, and any future client go through `notes.create_managed` (MCP) or its HTTP equivalent `POST /api/notes/create-managed`. They submit a `NoteCreateIntent` (ADR-004 §2):

```ts
interface NoteCreateIntent {
  title: string;
  body: string;
  type: NoteType;
  tags?: string[];
  folder_hint?: string;
}
```

Brain receives the intent, generates the ULID, picks the path based on `type`, fills `created`/`updated`, validates against `00_meta/schemas/{type}.json`, and either persists or returns a structured error.

### 2. Convenience endpoint contract

`lokyy-brain` ships a new endpoint (Phase-0.5 deliverable in the brain repo):

```
POST /api/notes/create-managed
Authorization: Bearer <agent-jwt>      (per ADR-005)
Content-Type: application/json

{
  "title": "Weekly retrospective notes",
  "body": "# Retrospective\n\n- We shipped Phase-0\n- ...",
  "type": "meeting",
  "tags": ["retro", "team"],
  "folder_hint": "20_areas/team"
}
```

Responses:

| Status | Meaning |
|--------|---------|
| 201 | Created. Body = full `Note` including assigned `id`, `path`, `created`, `updated`. |
| 400 | Intent invalid (missing field, bad type, body empty). Body = `{ error: "...", field: "..." }`. |
| 403 | Agent's scope (per `mcp-scopes.yaml`) doesn't allow `create` for this `type`. |
| 409 | Conflict — path collision or stale state. |
| 422 | Intent valid but rendered frontmatter fails per-type schema. Body = validation error detail. |

The MCP tool `notes.create_managed` (ADR-004) is a thin wrapper over this endpoint.

### 3. Lint enforcement (Phase-1 work)

A custom lint rule in lokyy-os codebase (and any adapter package) blocks the forbidden patterns. Two layers:

**Layer A — fast grep-based CI check** (`scripts/check-no-frontmatter-leak.sh`):

```bash
#!/usr/bin/env bash
# Fail the build if any forbidden patterns appear in lokyy-os source.
# Whitelist: scripts/ and docs/ are exempt (they may discuss the rule).
set -euo pipefail

VIOLATIONS=$(rg --type ts --type js \
  -g '!scripts/**' -g '!docs/**' -g '!**/*.test.ts' \
  -e 'import\s+\{?\s*ulid\b' \
  -e 'new\s+Date\(\)\.toISOString\(\)\s*//.*(?:created|updated)' \
  -e '`---\\n.*id:\s*\$\{' \
  -e "from\s+['\"]simple-git['\"]" \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "🚫 ADR-006 violation detected — frontmatter logic outside lokyy-brain:"
  echo "$VIOLATIONS"
  exit 1
fi
```

Runs in CI on every PR. Adapter code that needs to write notes MUST go through the BrainAdapter (which only ever calls `create-managed`).

**Layer B — TypeScript-level barrier**: the `BrainAdapter` in lokyy-os exports only methods that map 1:1 to MCP tools. There is no `BrainAdapter.makeFrontmatter()` or `BrainAdapter.generateId()`. The barrier is the type system itself — there's no API surface for the forbidden operations.

### 4. Migration of existing code

Audit performed during this ADR drafting: the lokyy-os codebase has **zero** existing manual frontmatter construction. (Etappe-1 code in `lokyy-app/` does not write to lokyy-brain at all; it talks to the Hermes-Workspace gateway.) Therefore no migration is required — this ADR sets policy for code that doesn't exist yet, which is the right time.

When Phase-3 implements `BrainAdapter`, it MUST be reviewed against this ADR before merge.

### 5. Telos and Memory exemption

A subtle case: PAI Telos files (`MISSION.md`, `GOALS.md`, `BELIEFS.md`, …) and Lokyy's own session diaries live OUTSIDE the lokyy-brain vault — they're in `~/.claude/PAI/USER/TELOS/` and `docs/diary/` respectively. Those files are NOT subject to this ADR's contract. They have their own conventions (PAI Telos schema, manual diary format).

This ADR governs **content in the lokyy-brain vault**, full stop. Other files in the repo are governed by their own rules.

## Consequences

### Positive

- Single source of validation truth. Brain's pre-commit hook + JSON schemas are the only place rules live.
- Adapters are simple — they translate user intent into a JSON payload, send it, and surface what brain returns.
- The contract-leak risk identified by Advisor is structurally eliminated, not just documented.
- Future schema changes ship in lokyy-brain alone — no coordinated release with lokyy-os.
- CI lint rule catches drift before review.

### Negative

- More HTTP round-trips than embedding ULID generation in the client. For Lokyy's scale (single user, low-frequency agent writes) this is irrelevant; for high-throughput multi-tenant SaaS it would matter — explicitly out of scope (ISA Out-of-Scope).
- One new endpoint (`POST /api/notes/create-managed`) required in the lokyy-brain repo. Coordinates with brain-repo development.

### Mitigations

- `BrainAdapter` caches read-side responses (`/api/notes`, `/api/graph`) per ADR-004; the write path is the only one that pays the round-trip every time.
- The lint rule has a whitelist for `scripts/` and `docs/` — discussing the rule in markdown doesn't violate it.

## Open questions

1. **Schema migration in lokyy-brain** — when a per-type schema field is added, what happens to old notes that lack it? Brain's `00_meta/schemas/*` versioning is a brain-repo decision; flagged for Epic 5 design.
2. **Linter authoring** — Layer A is a shell script; do we eventually want a proper ESLint plugin? Defer until the codebase is large enough that the shell script's false-positive rate becomes annoying.

## Cross-references

- [ADR-004](ADR-004-lokyy-brain-mcp-contract.md) — defines `notes.create_managed` (this ADR locks it as the only sanctioned write path)
- [ADR-005](ADR-005-service-auth-and-audit.md) — the JWT auth that gates the endpoint
- [ISA.md](../../ISA.md) — ISC-29 (Telos read-only for agents), ISC-43 (no direct git from lokyy-os), ISC-59 (this ADR's policy)
- Issues: #81 (this ADR closes), #78 (ADR-004 enables this), #80 (ADR-005 secures it)
