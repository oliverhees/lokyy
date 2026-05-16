# lokyy-app

Lokyy Personal — Greenfield-Frontend gegen Hermes-Gateway. **Etappe 2** (siehe [ADR-001](../docs/decisions/ADR-001-pivot-to-greenfield.md)).

## Stack

- Vite 6 + React 19 + TypeScript-strict
- TanStack Router (file-based routing)
- Tailwind 4 (CSS-first config via `@tailwindcss/vite`)
- Playwright für E2E-Tests — **Done-Gate für jedes Issue**

## Dev

```bash
pnpm install
pnpm dev                # Vite-Dev-Server auf http://127.0.0.1:3100
pnpm typecheck          # TS-Check
pnpm test:e2e:install   # Chromium für Playwright installieren (einmalig)
pnpm test:e2e           # E2E-Tests
```

## Phasen

Siehe Master-Issue #38 und Phase-0-Sub-Issues #39–#44. Reihenfolge laut Visibility-First-Doctrine:

1. Scaffold (#39) ← **dies hier**
2. UI-Migration aus shadcn-ui-kit-dashboard (#40)
3. Better Auth (#41)
4. Lokyy-Branding (#43)
5. Hello-World-Chat gegen Hermes-Gateway (#42)
6. ADR-002 + Diagram (#44)
