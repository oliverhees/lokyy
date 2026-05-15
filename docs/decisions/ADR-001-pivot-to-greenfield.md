# ADR-001 — Etappe 1 stoppen, Lokyy als Greenfield-Frontend gegen Hermes-Gateway bauen

- **Status:** Accepted
- **Date:** 2026-05-15
- **Authors:** Oliver, Alice
- **Supersedes:** LOKYY-ETAPPE-1-RESKIN.md (Etappe 1 als aktive Strategie)

---

## Context

Etappe 1 hat das Hermes-Workspace-Fork visuell reskinnt. Während der Folge-Planung wurde klar, dass die Lokyy-Vision deutlich über Reskin hinaus geht — eigenständige Plattform-Identität mit:

1. Workflows (Skill-Verkettung)
2. Prompt Library
3. Second Brain (Obsidian-Vault Read-Integration)
4. Teams (Multi-Agent-Composition)
5. Schedule Jobs (eigene Ansicht)
6. Integrations (Google Calendar etc., bewusst getrennt von MCP)
7. Artefakte (Claude/OpenWebUI-Stil im Chat)
8. TTS / Spracheingabe
9. Erweiterbare Menüpunkte (n8n-Embed etc.)

6 von 9 Features erfordern strukturelle UI-Eingriffe, die im Fork-Rahmen jeden Upstream-Sync zu Merge-Konflikten machen würden. Die Hard-Constraint „Internal Code Identifiers bleiben `hermes`" verwässert die Lokyy-Markenidentität dauerhaft.

## Decision

**Wir stoppen Etappe 1 und bauen Lokyy ab Etappe 2 als eigenständiges Frontend gegen die stabile Hermes-Gateway-API.**

### Stack

- **Frontend Framework:** Vite + TanStack Router + TanStack Start
- **UI:** React 19, Tailwind 4, shadcn (basierend auf `/media/oliver/Platte 2 (Netac)/shadcn-ui-kit-dashboard/`)
- **Auth:** Better Auth (Single-User Login-Wall, `organizations`-Plugin für späteren SaaS-Pfad offenlassen)
- **Backend:** Hermes-Agent als Backend bleibt unverändert, Lokyy spricht via Gateway-API (`localhost:8642`)

### Multi-Tenancy-Modus: Drei Produkte, nicht eine Architektur

| Modus | Zielgruppe | Architektur | Bau-Reihenfolge |
|---|---|---|---|
| **Lokyy Personal** | Selbstständige, Solo-User | Single-Tenant, 1 Lokyy + 1 Hermes pro Installation | **Jetzt (Etappe 2)** |
| **Lokyy Team** | 2–10 User | 1 Lokyy + 1 Hermes mit User-Layer im Frontend, je User ein Hermes-Profile | Später |
| **Lokyy Enterprise** | 100+ Mitarbeiter | Lokyy-Backend-Service vor Hermes (Hermes als Skill-Engine, nicht per-User-Backend) | Wenn Enterprise-Deal kommt |

**Begründung gegen universal-Architektur:** Hermes-Profile sind 1-User-Multi-Persona, nicht Multi-Tenant. Gateway-weite Locks (`gateway.lock`, `state.db`, single `API_SERVER_KEY`) brechen bei 100+ concurrent Usern. Echte Enterprise-Architektur = Lokyy-Backend-Service davor, eigenes Produkt-SKU.

### UI-Kit-Migration

Das gekaufte `shadcn-ui-kit-dashboard` ist Next.js (App Router). Migration zu Vite/TanStack:
- `components/ui/*`, `components/layout/*`, `lib/*`, `hooks/*` → 1:1 portierbar
- `app/layout.tsx` → TanStack `__root.tsx` umschreiben
- `app/dashboard/(auth)/default/page.tsx` → `routes/dashboard.tsx`
- `next/link`, `next/navigation` → TanStack-Router-Äquivalente
- Gesamt-Migrations-Aufwand: 2–4 Stunden

## Doctrine Updates (2026-05-15, post-decision)

Während der ersten Phase-0-Planung hat Oliver zwei Non-Negotiable-Regeln verankert:

### Visibility-First

Oliver muss von Tag 1 sehen und kontrollieren können was passiert. Reihenfolge in jeder Phase: **Auth + sichtbares Dashboard zuerst**, Backend-Anbindung danach. Kein „Backend-only Sprint". Phase-0-Reihenfolge wird entsprechend angepasst: **0.1 (Scaffold) → 0.2 (UI-Migration) → 0.3 (Auth) → 0.5 (Branding) → 0.4 (Chat) → 0.6 (ADR-002)**.

### Playwright-Verification ist Done-Gate

Jedes Issue gilt nur dann als done, wenn Playwright es im echten Browser nachgewiesen hat. Format:
- Pro Issue: ein E2E-Test in `lokyy-app/tests/e2e/<issue-slug>.spec.ts`
- Issue-Close erst nach `pnpm test:e2e` grün
- Screenshot des erfolgreichen Pfads als Verification-Evidence in der Issue

Forbidden: „done" ohne Playwright-Evidence.

## Consequences

### Positiv
- 100% UI/UX-Freiheit, Lokyy-eigene Architektur und Komponentennamen
- Marken-Sauberkeit: kein "hermes" im sichtbaren Code
- Phase-1-MVP nach 3 Wochen vorzeigbar
- Hermes-Engine-Updates fließen über Gateway durch, kein Frontend-Merge-Aufwand
- Enterprise-Pfad bleibt offen, ohne Personal-Architektur zu verbiegen

### Negativ
- ~3 Wochen bis Personal-MVP, in denen Lokyy funktional unter dem Fork liegt
- Eigene Wartung für Frontend-Bugs (vorher: Upstream-Hermes-Team)
- Lock-in auf Hermes-Gateway-API-Stabilität

### Mitigation
- Fork (`lokyy-workspace/`) bleibt als Referenz-Implementation stehen — Komponenten und Logik können selektiv übernommen werden
- Upstream weiter beobachten via `git fetch upstream`, aber nicht mehr mergen
- Phasen-Plan minimiert SOS-Risiko (jedes Plateau ist released-fähig)

## Alternatives Considered

| Pfad | Bewertet | Verworfen weil |
|---|---|---|
| **Fork weiterführen** | Ja | 6+ strukturelle Features = Merge-Hölle; Branding-Constraint vereitelt Plattform-Identität |
| **Komplett selbst bauen (Backend + Frontend)** | Ja | 9–12 Monate Backend-Eigenbau; SOS-Pattern aus TELOS triggert; Hermes-Engine ist gut genug |
| **Next.js statt Vite** | Ja | Client-Shell-Architektur braucht keine Server Components; Komponenten aus Fork-Referenz wären inkompatibel; langsamere Dev-Experience |

## Rollback

Wenn Etappe 2 nach Phase 0 (1 Woche) zu schmerzhaft ist, kann ohne Verlust auf den Fork zurückgekehrt werden — `lokyy-workspace/` ist intakt, Upstream-Branch existiert, keine destruktiven Operationen durchgeführt.

## Related

- Diary heute: `docs/diary/2026-05-15-session-01.md`
- ADR-002 (folgt): Auth + Gateway-Anbindung detail
- Master-Issue: GitHub `oliverhees/lokyy` „Etappe 2 — Lokyy Personal Eigenbau"
