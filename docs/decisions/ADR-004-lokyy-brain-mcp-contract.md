# ADR-004 — lokyy-brain MCP Contract

- **Status**: Proposed
- **Date**: 2026-05-16
- **Authors**: Winston (BMAD-Architect), commissioned by Orchestrator
- **Closes**: Issue #78 (Phase-0.5 — MCP-Contract Specification)
- **Relates to**: [ADR-001](ADR-001-pivot-to-greenfield.md), [ADR-003](ADR-003-docker-topology-etappe-2.md), [ISA.md](../../ISA.md) (ISC-47, ISC-56, ISC-60, ISC-63)

---

## Context

`lokyy-brain` is a separate repo (Hono/TypeScript service, Forgejo-backed, strict frontmatter contract) that already exposes a JSON-HTTP API on port 8787. Its **Epic 5** plans an MCP layer for agent access via `@modelcontextprotocol/sdk` with scopes declared in `00_meta/mcp-scopes.yaml`.

The Advisor cross-check on 2026-05-16 identified this as the **single load-bearing assumption** of the Lokyy architecture:

> If Hermes agents ship before the MCP layer is contractually fixed, the HTTP-adapter ossifies as the de-facto agent API and parallel surfaces accumulate. Define a minimal MCP contract NOW and ship a stub MCP server in lokyy-brain before Hermes lands — even if Epic 5 isn't fully baked.

This ADR freezes the contract so Hermes-Subagents (Phase-2/4) have a stable target, and the Cross-AI Bridge (Phase-6) consumes the same surface — eliminating contract drift.

## Decision

### 1. MCP tool surface (minimum stub, Phase-0.5)

Eight tools, grouped into four namespaces. Each tool is a thin wrapper around an existing lokyy-brain HTTP endpoint (no new server logic in Phase-0.5; just MCP-protocol translation).

#### `notes.*`

| Tool | Input | Output | HTTP equivalent |
|------|-------|--------|-----------------|
| `notes.read` | `{ id: string }` | `Note` | `GET /api/notes/:id` |
| `notes.list_by_type` | `{ type: NoteType, limit?: number, cursor?: string }` | `{ items: NoteSummary[], next_cursor?: string }` | `GET /api/notes?type=...` (Phase-0.5 adds query param) |
| `notes.search` | `{ query: string, type?: NoteType, limit?: number }` | `NoteSummary[]` | `GET /api/notes/search?q=...` (Phase-0.5 adds endpoint) |
| `notes.create_managed` | `NoteCreateIntent` | `Note` | `POST /api/notes/create-managed` (Phase-0.5 adds endpoint — **this is the contract-leak fix from ISC-59**) |
| `notes.update_content` | `{ id: string, body: string, expected_updated_at?: string }` | `Note` | `PUT /api/notes/:id` (existing) |

#### `vault.*`

| Tool | Input | Output | HTTP equivalent |
|------|-------|--------|-----------------|
| `vault.tree` | `{ root?: string }` | `TreeNode[]` | `GET /api/vault/tree` |

#### `graph.*`

| Tool | Input | Output | HTTP equivalent |
|------|-------|--------|-----------------|
| `graph.get` | `{}` | `{ nodes: GraphNode[], edges: GraphEdge[] }` | `GET /api/graph` |

#### `pipes.*`

| Tool | Input | Output | HTTP equivalent |
|------|-------|--------|-----------------|
| `pipes.import` | `{ url: string, type?: PipeType }` | `PipeJob` | `POST /api/pipes/import` (existing) |
| `pipes.status` | `{ job_id: string }` | `PipeJob` | `GET /api/pipes` filtered by id |

**Critical**: `notes.create_managed` is **the only sanctioned write path for new notes**. It accepts an intent (`title`, `body`, `type`, optional `tags`) and lokyy-brain owns ULID generation + `created`/`updated` timestamps + frontmatter assembly + closed-list-type validation. Agents NEVER construct frontmatter (ISC-59).

### 2. Type definitions (locked, breaking changes require ADR amendment)

```ts
type NoteType =
  | 'note'
  | 'capture'
  | 'project'
  | 'task'
  | 'decision'
  | 'meeting'
  | 'customer'
  | 'workflow'
  | 'intervention'
  | 'content';

interface NoteCreateIntent {
  title: string;
  body: string;
  type: NoteType;
  tags?: string[];
  // optional location hint; brain decides final path based on type:
  folder_hint?: string;
}

interface Note {
  id: string;          // ULID assigned by brain
  path: string;        // brain-owned
  title: string;
  body: string;
  tags: string[];
  links: string[];     // resolved wikilinks
  type: NoteType;
  created: string;     // ISO-8601, immutable
  updated: string;     // ISO-8601, brain-managed
}

type NoteSummary = Omit<Note, 'body'>;
type PipeType = 'youtube' | 'voice' | 'url' | 'crawl' | 'unknown';
```

### 3. Scoping model (`00_meta/mcp-scopes.yaml`)

Each agent identity gets a scope block. Lokyy provides the default set; users can edit. Brain enforces server-side — never trusts client-claimed scope.

```yaml
# 00_meta/mcp-scopes.yaml — lokyy-brain
schema_version: 1

scopes:
  conductor:
    description: Orchestrator (parent Hermes instance); decomposes user requests
    notes:
      read: [note, capture, project, task, decision, meeting]
      create: [note, decision, project]
      update: [note, decision, project]
    pipes:
      trigger: true
      poll: true
    vault: { read: true }
    graph: { read: true }

  researcher:
    description: Web research + source verification
    notes:
      read: [note, capture]
      create: [note, capture]
      update: [capture]   # researcher refines captures into clean notes
    pipes:
      trigger: true
      poll: true
    vault: { read: true }
    graph: { read: true }

  writer:
    description: Drafts long-form content
    notes:
      read: [note, capture, decision, project, content]
      create: [content]
      update: [content]
    pipes:
      trigger: false
    vault: { read: true }
    graph: { read: true }

  coder:
    description: Code-related notes; delegates actual coding to Claude/OpenClaw
    notes:
      read: [note, decision, project, task]
      create: [task]
      update: [task]
    pipes:
      trigger: false
    vault: { read: true }
    graph: { read: true }

  curator:
    description: Maintains the second-brain — re-tag, re-classify, archive
    notes:
      read: [*]
      create: [*]
      update: [*]
      delete: [capture]   # only inbox cleanup, never user-curated content
    pipes:
      trigger: false
      poll: true
    vault: { read: true }
    graph: { read: true }
```

The scope file is read at startup; changes require restart. Phase-3+ may add hot-reload.

### 4. Authentication & audit (anticipates Issue #80)

- Each agent has a token issued by lokyy-brain (Phase-3 work, tracked in Issue #80).
- MCP server validates token → resolves agent identity → checks scope → executes or rejects.
- Audit log entry per call: `{ ts, agent_id, tool, input_hash, result_status }`. Body content is NOT logged (privacy).
- Brain rejects requests where token agent_id doesn't match a scope entry.

### 5. Stub MCP server (Phase-0.5 deliverable in lokyy-brain repo)

Goal: Hermes agents can integrate against this stub before Epic 5 ships full features. Minimum:

- `@modelcontextprotocol/sdk` server over stdio
- Implements the 8 tools above by calling existing HTTP endpoints internally
- Reads `00_meta/mcp-scopes.yaml` and enforces it
- Reads a static `MCP_TOKENS` env var (Phase-0.5 only) → maps tokens to agent identities; gets replaced by stateful tokens in Phase-3
- Logs every call to `mcp-audit.jsonl` in the brain working directory

Stub does NOT need: hot-reload, fine-grained quota limits, schema migration, MCP resources/prompts. Those land in Epic 5.

### 6. Cross-AI Bridge contract (ISC-60)

The Cross-AI Bridge (Phase-6, Claude Code + OpenClaw adapters) writes external AI outputs into lokyy-brain. **It uses the same `notes.create_managed` MCP tool** every Hermes-Subagent uses. There is **no parallel write path** — Bridge agents identify themselves as `bridge-claude` / `bridge-openclaw` scopes in `mcp-scopes.yaml`, and brain validates the schema on the way in. Contract integrity preserved.

## Anti-patterns (forbidden in lokyy-os and adapter code)

| Forbidden | Why | Allowed instead |
|-----------|-----|-----------------|
| `ulid()` call in lokyy-os | Frontmatter ownership belongs to brain (ISC-59) | Send `NoteCreateIntent`; brain assigns id |
| Manual frontmatter assembly in adapters | Contract leak risk | `notes.create_managed` |
| Direct git operations against the vault repo | Bypasses promise-lock + validation | All writes via brain HTTP/MCP |
| Hardcoded path construction (`daily/YYYY-MM-DD.md`) | Brain owns paths from `type` | Set `type: note`; brain places it |
| Bypassing `mcp-scopes.yaml` (raw HTTP from agents) | Defeats audit + scope enforcement | Agents speak MCP; humans/operators speak HTTP |

A lint rule (Phase-1 task) scans the lokyy-os codebase for `import { ulid }`, manual frontmatter strings, and direct `simple-git` usage outside the BrainAdapter. Anything matching = build failure.

## Consequences

### Positive

- Hermes agents have a stable target for write surface — no scramble in Phase-2 to figure out "how do agents talk to brain".
- ISC-59 (frontmatter-validation-location) is structurally enforced: `notes.create_managed` is the only sanctioned write, and it lives in brain.
- Scoping doctrine is concrete (yaml file) — easy to review, easy to extend per-agent.
- Cross-AI Bridge can reuse infrastructure rather than building parallel write logic (ISC-60).
- Phase-0.5 stub-server is implementable in <2 days in the lokyy-brain repo (just MCP-translation over existing endpoints).

### Negative

- One new HTTP endpoint required in lokyy-brain (`POST /api/notes/create-managed`). Coordinates with brain-repo development.
- Coupling between this ADR's stub and Epic 5 — when Epic 5 changes the scope schema, both sides need migration. Mitigation: `schema_version: 1` in yaml allows graceful detection.
- Tokens via env var in Phase-0.5 is a known compromise; full token lifecycle in Issue #80.

### Mitigations

- Issue #79 (Concurrency-Audit) verifies `notes.create_managed` under multi-agent load before Phase-2 starts using it.
- Issue #80 (Auth-Model) defines the token lifecycle that replaces the Phase-0.5 env-var approach.
- Issue #81 (Validation-Location) cross-references this ADR's anti-pattern table as canonical.

## Open questions (resolve before Phase-2)

1. **Cursor pagination format** in `notes.list_by_type` — opaque cursor vs page+limit? Recommend opaque cursor (brain internal detail).
2. **Search backend** — for now naive substring match in brain; future: BM25 (per ISA Constraints). Stub uses naive.
3. **PipeJob lifecycle** — current brain pipe queue is in-process, not restart-safe. Stub MCP just polls; durable queue is a brain-repo follow-up.
4. **Wikilink resolution** in `Note.links` — current brain returns resolved IDs. Confirmed acceptable for agent consumption.

## Cross-references

- [ADR-001-pivot-to-greenfield](ADR-001-pivot-to-greenfield.md)
- [ADR-003-docker-topology-etappe-2](ADR-003-docker-topology-etappe-2.md)
- [ISA.md](../../ISA.md) — ISC-47, ISC-56, ISC-59, ISC-60, ISC-63
- lokyy-brain repository (separate; coordination required for Epic 5 timing)
- Issues: #78 (this ADR closes), #79 (Concurrency-Audit), #80 (Auth-Model), #81 (Validation-Location)
