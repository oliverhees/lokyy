# ADR-003 — Docker Topology (Etappe-2 Greenfield)

- **Status**: Accepted
- **Date**: 2026-05-16
- **Authors**: Winston (BMAD-Architect), commissioned by Orchestrator
- **Relates to**: [ADR-001-pivot-to-greenfield](ADR-001-pivot-to-greenfield.md), [ADR-002-auth-and-gateway-binding](ADR-002-auth-and-gateway-binding.md), [ISA.md](../../ISA.md) (ISC-41 / ISC-44 / ISC-54 / ISC-72)

---

## Context

Etappe-2 (per ADR-001 pivot) is a greenfield rebuild for the self-hosted **Lokyy KI-Betriebssystem**. The artefacts of Etappe-1 (`lokyy-app/`, `lokyy-workspace/`) are transitional state and will be replaced by Etappe-2 components in Phase-1. ADR-002 documents the Etappe-1 auth-gateway binding to the Hermes-Workspace fork; that binding is superseded by Phase-1 of Etappe-2 (Auth-Gateway in `lokyy-os-be`).

Etappe-2 deploys all components as Docker containers on a Linux server. **Phase-0** (the subject of this ADR) establishes the topology, the reverse-proxy, the network layout, and the secrets-handling pattern — the foundation that Phase-1+ layers onto without churn.

This ADR is the materialisation of the architecture decisions already locked in `ISA.md` (see Constraints + Decisions sections). It does **not** introduce new architectural choices — it documents how Phase-0 fulfils them.

## Decision

### Container inventory (Phase-0 active vs reserved)

| Container | Image | Phase | Role |
|-----------|-------|-------|------|
| `traefik` | `traefik:latest` (v3.7.1+) | 0 ✅ | Reverse-proxy, auto-TLS, dashboard |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:latest` | 0 ✅ | Sanitized Docker API for Traefik (anti-privilege gate, Phase-8 doctrine pulled forward) |
| `lokyy-os-fe` | `nginx:alpine` (placeholder) | 0 ✅ → 1 | Frontend (real build replaces placeholder in Phase-1) |
| `lokyy-os-be` | `nginx:alpine` (placeholder) | 0 ✅ → 1 | Backend auth-gateway (real build in Phase-1) |
| `lokyy-brain` | `nginx:alpine` (placeholder) | 0 ✅ → 3 | Second-brain HTTP-API (separate repo; real image replaces placeholder in Phase-3) |
| `hermes` | `nousresearch/hermes-agent` | 2 🔒 | Agent core (commented block in compose) |
| `lokyy-heartbeat-supervisor` | (own build) | 2 🔒 | Layer-3 watchdog (commented block in compose) |

**Forgejo is NOT a container in this stack.** A remote Forgejo instance already exists and is used by `lokyy-brain` as its `GIT_REMOTE`. Configured via `LOKYY_BRAIN_FORGEJO_URL` in `.env.local`. Bringing Forgejo into the lokyy stack would duplicate working remote infrastructure — see Decision below.

The five active containers must be `healthy` after `docker compose up -d` to satisfy the Phase-0 done-gate (ISC-41).

### Networks

- **`lokyy-net`** — internal bridge. All Lokyy services attach here for inter-service communication.
- **`traefik-public`** — external bridge. Only Traefik attaches and exposes ports `80` / `443`.

This split enforces **ISC-44**: `lokyy-brain` and any future internal service are unreachable from the public internet because they have no Traefik labels and live only on `lokyy-net`.

### Volumes (named, persistent)

Active in Phase-0:
- `lokyy-traefik-letsencrypt` — `acme.json` (TLS certs)

Reserved (declared as commented blocks in compose, activated per phase): `lokyy-brain-vault` (Phase-3 working clone of remote Forgejo repo), `lokyy-os-db`, `hermes-data`, `heartbeat-state`.

### Secrets pattern (ISC-54)

- `.env.local` — single source of truth for the single-server deploy. **chmod 0600**, **gitignored**.
- `.env.example` — committed template, documents every variable, **never holds real values**.
- All compose values use `${VARIABLE}` expansion from `.env.local`. Zero plaintext secrets in `docker-compose.yml`.
- Docker Swarm `secrets:` blocks are intentionally **out of scope** for Phase-0 (single-host) but the topology is designed to migrate cleanly when multi-host deployment becomes relevant.

### Traefik configuration

- **Static config** (`infrastructure/traefik/traefik.yml`):
  - Entry-points: `web` (`:80`, permanent redirect to `websecure`), `websecure` (`:443`).
  - Docker provider: `exposedByDefault: false` — services opt-in via labels.
  - Certificate resolver: Let's Encrypt with HTTP-01 challenge (staging CA in `docker-compose.dev.yml`).
- **Dynamic config**: routing + middlewares declared as Docker labels on the services they affect. This keeps service routing co-located with the service definition and aligns with the **Phase-8** vision (Docker-MCP spawns containers that announce themselves via labels — no Traefik restart needed).
- **Dashboard**: served at `https://traefik.${DOMAIN}/`, protected by `basicauth` middleware reading credentials from `${TRAEFIK_DASHBOARD_AUTH}` (htpasswd-hashed). Subdomain (not path-prefix) chosen to avoid collision with `lokyy-os-fe`'s catch-all `Host` rule.

### Hostname layout

| Hostname | Routes to |
|----------|-----------|
| `lokyy.local` | `lokyy-os-fe` (catch-all) |
| `lokyy.local/api/*` | `lokyy-os-be` |
| `traefik.lokyy.local` | Traefik dashboard (auth-protected) |

For local dev, `/etc/hosts` carries one line: `127.0.0.1 lokyy.local traefik.lokyy.local`. In production, real DNS records replace it. Forgejo lives at its own remote URL (configured via `LOKYY_BRAIN_FORGEJO_URL`) and is not part of Lokyy's hostname routing.

### Anti-decisions (constraint enforcement)

- **ISC-44**: `lokyy-brain` has **no** Traefik label and **no** published port. It is reachable only from other services on `lokyy-net`.
- **ISC-43**: `lokyy-os-be` will be built in Phase-1 without `git` in the image. The Phase-0 placeholder (`traefik/whoami`) has no `git`, so the constraint already holds trivially.
- **ISC-29**: Telos mount (`${HOME}/.claude/PAI/USER/TELOS`) is reserved in the `lokyy-os-be` block as a commented-out **`:ro`** mount, to be activated in Phase-3b.
- **ISC-54**: All secrets live in `.env.local` (chmod 0600), referenced as `${VAR}` in compose. No plaintext secrets in the compose file under any circumstances.

## Consequences

### Positive

- Clean greenfield topology, no Etappe-1 legacy carried forward.
- Traefik dashboard hidden behind basic-auth from day 1 (visibility-first satisfied through visible-but-secured infrastructure).
- Named volumes + networks survive `docker compose down`; no data loss on re-deploy.
- `docker compose -f docker-compose.yml config` validates without errors, and `docker compose up -d` brings all five active services healthy in well under 60 s.
- Adding containers in Phase-1..9 requires small edits (uncomment a block, replace `image:` with `build:`), never a topology refactor.
- Phase-8 readiness: Docker-label-discovery means future Docker-MCP-spawned services can register themselves with Traefik without orchestrator changes.

### Negative

- Two compose files coexist in the repository (`lokyy-workspace/docker-compose.yml` from Etappe-1 + `infrastructure/docker-compose.yml` Etappe-2). This can confuse contributors. **Mitigation**: `infrastructure/README.md` flags the transitional state; Etappe-1 files are scheduled for removal as Phase-1 lands.
- Traefik has a steeper learning curve than Caddy. **Mitigation**: minimal static config (only entrypoints + cert-resolver + docker provider); everything else is declared as labels next to the service — locally optimal for understanding.
- Placeholder containers consume a few MB of RAM and a network slot. **Mitigation**: `traefik/whoami` is ~5 MB image, negligible footprint; replaced in Phase-1+.
- Subdomain routing requires three `/etc/hosts` entries in dev. **Mitigation**: documented as a single one-line copy-paste in `infrastructure/README.md`. Acceptable trade-off for clean path separation.

### Mitigations and follow-ups

- `infrastructure/README.md` is the operator's runbook (setup, migration, common ops, troubleshooting).
- ADR-003 (this document) is the architecture record — future iterations always reference back here.
- GitHub Issues created at branch push track each acceptance criterion against an ISC.
- Phase-0.5 (Contract Sprint) is mandatory before Phase-1 begins (per Advisor cross-check); four issues opened in parallel with Phase-0.

## Revisions (2026-05-16 post-deploy)

1. **Forgejo removed from stack** — a remote Forgejo instance already exists; spinning up a local container duplicates working infrastructure. `lokyy-brain` will be configured with `LOKYY_BRAIN_FORGEJO_URL` (set in `.env.local`) as its `GIT_REMOTE` when Phase-3 activates it. Removed: `forgejo` service, `forgejo-data` + `forgejo-config` volumes, `forgejo.lokyy.local` hostname route, `FORGEJO_*` env vars.
2. **Traefik image bumped to `traefik:latest`** — pinned versions v3.2 and v3.5 advertised an old Docker client API (1.24) which Docker 29.4.1's daemon (minimum API 1.40) rejects. `traefik:latest` (v3.7.1 at deploy time) negotiates correctly.
3. **`docker-socket-proxy` sidecar added** — Traefik now reaches Docker via the proxy (`tecnativa/docker-socket-proxy:latest`) instead of mounting `/var/run/docker.sock` directly. This is the Phase-8 anti-privilege gate pulled forward; net architectural improvement.
4. **Placeholder images normalised** — `traefik/whoami` lacks a shell so wget-based healthchecks fail. All three placeholders (`lokyy-os-fe`, `lokyy-os-be`, `lokyy-brain`) now use `nginx:alpine` consistently.

## Cross-references

- [ADR-001-pivot-to-greenfield](ADR-001-pivot-to-greenfield.md) — why Etappe-2 exists
- [ADR-002-auth-and-gateway-binding](ADR-002-auth-and-gateway-binding.md) — Etappe-1 auth-gateway state (superseded by Phase-1 of Etappe-2)
- [ISA.md](../../ISA.md) — system of record for all 81 ISCs
- `infrastructure/README.md` — operator runbook
- `infrastructure/docker-compose.yml` — production compose file
- `infrastructure/docker-compose.dev.yml` — dev overrides (Let's Encrypt staging, debug logs)
