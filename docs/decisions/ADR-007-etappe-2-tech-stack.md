# ADR-007 — Etappe-2 Tech Stack (Frontend + Backend)

- **Status**: Accepted
- **Date**: 2026-05-16
- **Authors**: Winston (BMAD-Architect), commissioned by Orchestrator
- **Closes**: Part of Issue #86 (Phase-1 scaffold)
- **Relates to**: [ADR-001](ADR-001-pivot-to-greenfield.md), [ADR-002](ADR-002-auth-and-gateway-binding.md), [ADR-003](ADR-003-docker-topology-etappe-2.md), [ISA.md](../../ISA.md)

---

## Context

Phase-1 replaces the `nginx:alpine` placeholders for `lokyy-os-fe` and `lokyy-os-be` with real codebases. The Etappe-2 architecture is greenfield (per ADR-001), so we choose the stack now and lock it for the rest of Phase-1..7.

Two natural directions:

1. **Mirror the Etappe-1 lokyy-workspace stack** — React 19, Vite, Tailwind 4, `@base-ui/react`, TanStack Router/Start, Zustand, pnpm. The full Hermes-Workspace tool set.
2. **Mirror the lokyy-brain stack** — Bun, Hono, TypeScript strict. Lean, fast, minimal dependencies.

Lokyy-OS sits between two services: a small Gateway/UI layer that calls Hermes (Phase-2) and lokyy-brain (Phase-3). It does not need TanStack Start's full-stack rendering or `@base-ui/react`'s richer component library for the Phase-1 / Phase-4 scope; it does benefit from sharing the Bun + Hono + TS pattern with lokyy-brain (Hermes-OS's existing service).

## Decision

### Frontend (`lokyy-os-fe/`)

- **Vite + React 19 + TypeScript strict + Tailwind 4** as the SPA stack.
- `@vitejs/plugin-react` for JSX, `@tailwindcss/vite` for Tailwind 4.
- No router yet (Phase-1a is single page). React Router or TanStack Router added when navigation appears in Phase-1b.
- No state library yet. Zustand or context-only — decided when the first cross-page state shows up.
- Build = `bun run build` → static `dist/` served by `nginx:alpine` in the production image.
- Dev = `bun run dev` with Vite proxying `/api` to `lokyy-os-be`.

### Backend (`lokyy-os-be/`)

- **Bun + Hono + TypeScript strict** as the HTTP service stack.
- `hono/logger` + `hono/cors` baseline middleware.
- Routes anchored at `/health` and `/api/*`.
- Run = `bun src/index.ts`; built into the Docker image as-is (no transpile step).
- Future: auth middleware (Better-Auth, see ADR-002 for the Etappe-1 pattern we'll mirror for Etappe-2), agent-token middleware (ADR-005), Hermes-bridge client (Phase-2).

### Shared discipline

- TypeScript strict in both packages — no `any` waivers; explicit types at all module boundaries.
- No `npm`/`npx` — Bun for everything (matches the PAI rule + lokyy-brain stack).
- ESM only.
- Per-package `.gitignore` ignores `node_modules`, `dist`, `.env*`.
- Each app has its own `Dockerfile` + `.dockerignore`; `docker-compose.yml` builds them from `../<app>/`.

### What this ADR does NOT pick

- The user-auth library (Better-Auth from ADR-002 is the leading candidate but the actual decision lands in the Phase-1b auth ADR).
- The database (SQLite expected per ADR-002 pattern; locked when auth lands).
- The route layout for the frontend (will be designed when the dashboard work begins).
- A component library or design system (start lean with Tailwind primitives; reach for `@base-ui/react` or shadcn-style components only when the second screen needs them).

## Consequences

### Positive

- One language (TypeScript) and one runtime (Bun) across both lokyy-os apps + lokyy-brain. Less context-switching, easier to share types later.
- Vite + Tailwind 4 keeps the frontend fast to iterate. Hot-reload, no bundler config sprawl.
- Bun + Hono on the backend is minimal — fewer moving parts than Express/Fastify, fast cold start, native TypeScript.
- Production image is small: lokyy-os-fe = `nginx:alpine` + static files; lokyy-os-be = bun runtime + a few MB of source.
- Build pipelines stay simple — no monorepo tooling yet, each app is independently buildable.

### Negative

- Different stack from Etappe-1 (`lokyy-workspace/`) means knowledge from there partially transfers but UI components don't. Acceptable given Etappe-1 is being retired (ADR-001).
- No SSR / SSG yet (Vite SPA). If SEO or initial-paint-time becomes critical, we'd reach for TanStack Start or Astro later. Not a Phase-1 concern.
- Two `package.json` files mean two `bun install` runs in CI. Manageable; can be unified with a Bun workspace later if it bites.

### Mitigations

- The `vite.config.ts` proxy keeps the dev experience consistent with the production routing — same `/api` path resolves to the backend in both modes.
- Both Dockerfiles use `oven/bun:1` for installs; ensures Bun version consistency.

## Cross-references

- [ADR-001-pivot-to-greenfield](ADR-001-pivot-to-greenfield.md) — why Etappe-2 exists
- [ADR-002-auth-and-gateway-binding](ADR-002-auth-and-gateway-binding.md) — Etappe-1 Better-Auth pattern (template for Phase-1b)
- [ADR-003-docker-topology-etappe-2](ADR-003-docker-topology-etappe-2.md) — Docker stack this fits into
- [ADR-004](ADR-004-lokyy-brain-mcp-contract.md) — MCP contract `BrainAdapter` will implement (Phase-3)
- [ADR-005](ADR-005-service-auth-and-audit.md) — JWT service auth that `lokyy-os-be` mints (Phase-2/3)
- [ADR-006](ADR-006-validation-lives-only-in-brain.md) — anti-pattern table that `BrainAdapter` must satisfy
