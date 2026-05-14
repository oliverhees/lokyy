# Recon: Routen-Inventar (Issue #8)

> Read-only Recon der TanStack-Router-Routen unter `lokyy-workspace/src/routes/`.
> Quelle: `src/routes/**/*` + `src/routeTree.gen.ts` (canonical paths).
> Stand: 2026-05-14 · Owner: Mary (Business Analyst)

## 2.5 Routen

### Vollständige Page-Route-Tabelle (sichtbare UI)

Nur **Page-Routen** (User-sichtbar). API-Routen (`src/routes/api/**`) sind in Issue #9 (API-Inventar) Sache und hier ausgeklammert.

| # | File (relativ zu `src/routes/`)         | TanStack URL-Pfad         | Screen-Komponente                                  | Zweck (1-Liner)                                                          |
|---|------------------------------------------|---------------------------|----------------------------------------------------|--------------------------------------------------------------------------|
|  1| `__root.tsx`                             | (Layout-Root)             | `WorkspaceShell` (CSP-Setup)                       | Root-Layout: globales Shell, CSP-Header, Sidebar, Terminal-Mount.        |
|  2| `index.tsx`                              | `/`                       | redirect → `/chat`                                 | Landing — leitet via `beforeLoad` permanent auf `/chat` weiter.          |
|  3| `dashboard.tsx`                          | `/dashboard`              | `DashboardScreen` (`@/screens/dashboard/`)         | Übersicht: Metriken, Status-Karten, Schnellzugriffe.                     |
|  4| `chat/index.tsx`                         | `/chat/`                  | redirect → letzter Session-Key (localStorage)      | Chat-Index: stellt zuletzt aktive Session wieder her oder erzeugt neue.  |
|  5| `chat/$sessionKey.tsx`                   | `/chat/$sessionKey`       | `ChatScreen` (lazy)                                | Chat-Detail: SSE-Streaming-Konversation pro Session.                     |
|  6| `operations.tsx`                         | `/operations`             | `OperationsScreen` (`@/screens/agents/`)           | Operations-Cockpit: Agent-Runs, laufende Aufträge.                       |
|  7| `swarm.tsx`                              | `/swarm`                  | `Swarm2Screen` (`@/screens/swarm2/`)               | Multi-Agent-Swarm (alias auf swarm2 — siehe Notiz unten).                |
|  8| `swarm2.tsx`                             | `/swarm2`                 | `Swarm2Screen` (`@/screens/swarm2/`)               | Multi-Agent-Swarm v2 (Kanban, Roster, Tmux-Panes).                       |
|  9| `conductor.tsx`                          | `/conductor`              | `Conductor` (`@/screens/gateway/`)                 | Conductor Multi-Agent-Orchestrator (Gateway-Ansicht).                    |
| 10| `tasks.tsx`                              | `/tasks`                  | `TasksScreen` (`@/screens/tasks/`)                 | Task-Board: Claude-Tasks Verwaltung & Assignees.                         |
| 11| `jobs.tsx`                               | `/jobs`                   | `JobsScreen` (`@/screens/jobs/`)                   | Jobs/Cron-Übersicht: geplante & laufende Jobs.                           |
| 12| `memory.tsx`                             | `/memory`                 | (Tabs in-route) + `BackendUnavailableState`        | Memory-Browser: Listen/Read/Search/Write/Graph.                          |
| 13| `files.tsx`                              | `/files`                  | (Inline File-Tree + Editor)                        | Files-Workspace: Projekt-Filetree, Editor, "Insert as reference".        |
| 14| `skills.tsx`                             | `/skills`                 | `SkillsScreen` (`@/screens/skills/`)               | Skills-Verwaltung: install/uninstall/toggle, Hub-Suche.                  |
| 15| `mcp.tsx`                                | `/mcp`                    | `McpScreen` (`@/screens/mcp/`)                     | MCP-Server-Konfiguration: discover, configure, presets, logs.            |
| 16| `terminal.tsx`                           | `/terminal`               | (null — Terminal mounts in `WorkspaceShell`)       | Terminal-Route: persistent in Shell gerendert, Route bleibt mount-stabil.|
| 17| `playground.tsx`                         | `/playground`             | `HermesWorldEmbed` (`@/screens/playground/`)       | Playground: Embed der Hermes-World-Sandbox.                              |
| 18| `profiles.tsx`                           | `/profiles`               | `ProfilesScreen` + `CrewScreen`                    | Profile/Crew: Agent-Profile aktivieren/erstellen/umbenennen.             |
| 19| `settings.tsx`                           | `/settings`               | Layout (`<Outlet />`)                              | Settings-Layout-Route (Sidebar + Outlet für Sub-Routes).                 |
| 20| `settings/index.tsx`                     | `/settings/`              | `SettingsRoute` (General)                          | Settings: allgemeine Einstellungen (Default-Tab).                        |
| 21| `settings/providers.tsx`                 | `/settings/providers`     | `SettingsProvidersRoute` (inline)                  | Settings → Providers: Modelle/Provider/Connection-Settings.              |
| 22| `agora.tsx`                              | `/agora`                  | `AgoraScreen` (`@/screens/agora/`)                 | Agora-Marktplatz (Hermes-Ökosystem-Feature, Plugins/Hub).                |
| 23| `hermes-world.tsx`                       | `/hermes-world`           | `HermesWorldLanding` (`@/screens/playground/`)     | Hermes-World-Landing (Marketing/Embed-Einstieg).                         |
| 24| `world.tsx`                              | `/world`                  | `HermesWorldLanding` (`@/screens/playground/`)     | World-Alias auf Hermes-World-Landing (Kurz-URL).                         |
| 25| `vt-capital.tsx`                         | `/vt-capital`             | `VtCapitalScreen` (`@/screens/vt-capital/`)        | VT-Capital-Feature (Investor/Cap-Tabelle, Hermes-spezifisch).            |
| 26| `reserve.tsx`                            | `/reserve`                | `ReserveRoute` (Marketing-Landing)                 | Reserve-Landingpage (Hermes-World Reservation, Brand-Styling).           |
| 27| `reserve/confirm.tsx`                    | `/reserve/confirm`        | `ReserveConfirmRoute`                              | Reserve-Bestätigung (Confirmation-Step der Reservation).                 |
| 28| `early-access.tsx`                       | `/early-access`           | (inline) → GitHub + Discord Links                  | Early-Access-Gate für nicht freigeschaltete Features.                    |
| 29| `$.tsx`                                  | `/$` (Catch-all)          | (inline 404)                                       | 404-Fallback für unbekannte URLs.                                        |

**Page-Routen total: 29** (inkl. `__root` Layout, 2 redirects, 1 Catch-all).
Davon **echte sichtbare Pages: 25** (ohne `__root`, `index` redirect, `chat/index` redirect, `$` 404).

### Hilfs-Dateien (nicht gerendert)

Diese Dateien liegen unter `src/routes/`, sind aber **keine Routen** (TanStack-Konvention: `-prefix` = nicht-routable):

- `-root-layout-state.ts` / `-root-layout-state.test.ts` — Layout-State-Helpers für `__root.tsx`.
- `-root-layout-utils.test.ts` — Utility-Tests für Root-Layout.
- `-root-runtime-guards.test.ts` — Runtime-Guard-Tests.
- `-swarm-routes.test.ts` — Tests für Swarm-Routing-Logik.

---

## Domain-Gruppierung

Gruppierung nach Funktionszweck — relevant für Phase D (Page-by-Page-Reskin-Plan):

### A. Core-Shell & Entry
- `__root.tsx` — globales Layout
- `index.tsx` → `/chat` redirect
- `$.tsx` — 404
- `early-access.tsx` — Feature-Gate

### B. Dashboard / Übersicht (höchste sichtbare Wirkung)
- `dashboard.tsx` `/dashboard`

### C. Multi-Agent / Orchestrator-Familie
- `operations.tsx` `/operations`
- `swarm.tsx` `/swarm`
- `swarm2.tsx` `/swarm2`
- `conductor.tsx` `/conductor`

### D. Task & Job Management
- `tasks.tsx` `/tasks`
- `jobs.tsx` `/jobs`

### E. Capabilities-Verwaltung
- `skills.tsx` `/skills`
- `mcp.tsx` `/mcp`
- `profiles.tsx` `/profiles`

### F. Daten- & Kontext-Layer
- `memory.tsx` `/memory`
- `files.tsx` `/files`

### G. Chat
- `chat/index.tsx` `/chat/` (redirect)
- `chat/$sessionKey.tsx` `/chat/$sessionKey`

### H. Terminal
- `terminal.tsx` `/terminal`

### I. Settings
- `settings.tsx` `/settings` (Layout)
- `settings/index.tsx` `/settings/`
- `settings/providers.tsx` `/settings/providers`

### J. Hermes-spezifisch (Marketing / Brand-lastig, ggf. Lokyy-Sonderbehandlung)
- `agora.tsx` `/agora`
- `playground.tsx` `/playground`
- `hermes-world.tsx` `/hermes-world`
- `world.tsx` `/world`
- `vt-capital.tsx` `/vt-capital`
- `reserve.tsx` `/reserve`
- `reserve/confirm.tsx` `/reserve/confirm`

---

## Priorisierungs-Vorschlag für Phase D (Page-by-Page-Reskin)

**Kriterium:** sichtbare Wirkung in der täglichen Lokyy-Nutzung × Häufigkeit × Brand-Sichtbarkeit.

### Tier 1 — Maximum Visibility (zuerst reskinnen)
1. `__root.tsx` — globales Layout & Shell. **Muss zuerst**, sonst keine konsistente Basis.
2. `dashboard.tsx` `/dashboard` — Startseite nach Login-Erlebnis (auch wenn `/` → `/chat`, ist Dashboard der "Heroshot" der Sidebar).
3. `chat/$sessionKey.tsx` `/chat/$sessionKey` — Default-Landing via `/` redirect, höchste Nutzung.
4. `chat/index.tsx` — minimal (nur Redirect), aber Logo/Loading evtl. sichtbar.

### Tier 2 — Operations Core (Lokyy = "KI-Betriebssystem" — diese Routen tragen die Hauptbotschaft)
5. `operations.tsx` `/operations`
6. `conductor.tsx` `/conductor`
7. `swarm2.tsx` `/swarm2` (sowie `swarm.tsx` als Alias — gleicher Screen, einmal stylen reicht visuell)

### Tier 3 — Workflow / Task-Layer
8. `tasks.tsx` `/tasks`
9. `skills.tsx` `/skills`
10. `mcp.tsx` `/mcp`

### Tier 4 — Background-Mechanik
11. `jobs.tsx` `/jobs`
12. `memory.tsx` `/memory`
13. `files.tsx` `/files`
14. `profiles.tsx` `/profiles`

### Tier 5 — Settings (vergleichsweise selten geöffnet)
15. `settings.tsx` + `settings/index.tsx` + `settings/providers.tsx`

### Tier 6 — Terminal (rendert in Shell, eigene Route fast leer)
16. `terminal.tsx` — visuell stark, aber gerendert via `WorkspaceShell`. Reskin-Aufwand liegt in Shell-Komponente, nicht in Route-Datei.

### Tier 7 — Hermes-spezifische Marketing/Brand-Routen (Lokyy-Sonderfall — siehe Notiz)
17. `agora.tsx` `/agora`
18. `playground.tsx` `/playground`
19. `hermes-world.tsx` `/hermes-world` + `world.tsx` `/world`
20. `vt-capital.tsx` `/vt-capital`
21. `reserve.tsx` `/reserve` + `reserve/confirm.tsx` `/reserve/confirm`

### Tier 8 — Edge & Fallback
22. `$.tsx` 404
23. `early-access.tsx`
24. `index.tsx` (reiner Redirect — wenig zu tun)

---

## Notizen für Etappe-1-Reskin

1. **`/swarm` vs `/swarm2`**: Beide importieren denselben `Swarm2Screen` aus `@/screens/swarm2/swarm2-screen` (vgl. `src/routes/swarm.tsx` Z.1-3 & `src/routes/swarm2.tsx` Z.1-3). Reskin am Screen, nicht an der Route — beide URLs bleiben erhalten.
2. **`/world` vs `/hermes-world`**: Beide nutzen `HermesWorldLanding` (`src/routes/world.tsx` Z.1, `src/routes/hermes-world.tsx` Z.1). Marketing-Branding-Frage — **Oliver-Klärung** in `docs/questions.md` aufnehmen: Sollen Hermes-Brand-Routen bei Lokyy ganz raus, alias-weise umbenannt oder visuell überklebt werden?
3. **`/reserve` + `/vt-capital`**: Stark Hermes-gebrandet (`<h1>` mit `#fff6df` Cream-Beige + serif font in `src/routes/reserve.tsx` & `src/routes/reserve/confirm.tsx`). Wahrscheinlich Hermes-Marketing-Erbe — Etappe 1 Constraint "Lokyy everywhere a human sees it" greift hier. **Oliver-Klärung erforderlich.**
4. **`/playground` embeddet `HermesWorldEmbed`** — d.h. iframe oder ähnliches. Branding nur an der Embed-Hülle möglich, Inhalt evtl. fremde Domain.
5. **`/early-access`** linkt fest auf `https://github.com/outsourc-e/hermes-workspace` und `https://discord.com/invite/agentd` (Z.2-3). Beim Reskin Lokyy-eigene Repo-/Discord-Links eintragen — **Oliver-Eingabe erforderlich**.
6. **`/terminal` rendert `null`** und delegiert an `WorkspaceShell` (persistent Mount). Reskin-Arbeit für Terminal liegt nicht in `routes/terminal.tsx`, sondern in der Shell-Komponente.
7. **Tests unter `-prefix`** (z.B. `-swarm-routes.test.ts`) sind keine Routen — keine Reskin-Arbeit, aber bei UI-Test-Anpassungen nicht vergessen.

---

## Methodik

- `find lokyy-workspace/src/routes -type f` → 152 Files gesamt (inkl. `api/**`, Tests).
- Filter Page-Routen: `*.tsx` ohne `-prefix`, ohne `api/`.
- Pro Datei: `createFileRoute('...')` extrahiert für canonical URL-Pfad.
- Pro Datei: Import-Statements gegrept (`@/screens/...`) für Screen-Komponente.
- Canonical paths kreuzverglichen mit `src/routeTree.gen.ts` (Quelle der Wahrheit für TanStack-Routing).
- **Keine Änderungen** am `lokyy-workspace/` getätigt — Read-Only-Recon eingehalten.
