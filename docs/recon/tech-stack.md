## 2.1 Tech-Stack & Repo-Struktur

**Quelle:** `lokyy-workspace/` @ Tag `v2.3.0` (commit `15fa9cd7`) — Hermes Workspace Fork, Read-only Inspektion am 2026-05-14.

**Analyst:** Mary (bmad-agent-analyst) · Issue #4 · Step 2.1 von Etappe 1.

---

### Tech-Stack Verifikation

Alle erwarteten Stack-Komponenten der Issue-Vorgabe wurden bestätigt. Versionen aus `package.json` (`^`-Caret Ranges; tatsächlich installierte Versionen wurden nicht aus `pnpm-lock.yaml` geprüft — empfohlen für späteren Sub-Step).

| Komponente | Erwartet | Bestätigt? | Version (deklariert) | Evidence |
|---|---|---|---|---|
| React | 19 | Ja | `^19.2.0` | `lokyy-workspace/package.json:61` |
| React DOM | 19 | Ja | `^19.2.0` | `lokyy-workspace/package.json:62` |
| TypeScript | strict | Ja | `^5.7.2`, `"strict": true` | `lokyy-workspace/package.json:98`, `lokyy-workspace/tsconfig.json:11,25` |
| Vite | aktuelle Major | Ja | `^7.3.2` | `lokyy-workspace/package.json:99` |
| Tailwind CSS | v4 | Ja | `^4.1.18` (+ `@tailwindcss/vite ^4.1.18`) | `lokyy-workspace/package.json:40,70`, Import via `@import 'tailwindcss'` in `lokyy-workspace/src/styles.css:2` |
| `@base-ui/react` | vorhanden (nicht Radix) | Ja | `^1.1.0` | `lokyy-workspace/package.json:30`, Import-Beispiel `lokyy-workspace/src/components/ui/button.tsx:3-4` |
| TanStack Router | vorhanden | Ja | `^1.132.0` | `lokyy-workspace/package.json:42`, `lokyy-workspace/src/router.tsx:1` |
| TanStack Start | vorhanden | Ja | `^1.132.0` | `lokyy-workspace/package.json:45`, Vite-Plugin `tanstackStart()` in `lokyy-workspace/vite.config.ts:10,556` |
| Zustand | vorhanden | Ja | `^5.0.11` | `lokyy-workspace/package.json:80`, Import `lokyy-workspace/src/stores/workspace-store.ts:1` |
| Paket-Manager | pnpm | Ja | — | `lokyy-workspace/pnpm-lock.yaml` (Existenz) |

**Zero Radix:** Grep nach `@radix-ui` in `package.json` liefert keine Treffer — der Stack ist konsistent auf `@base-ui/react` ausgerichtet, wie in der Issue spezifiziert.

---

### Repo-Struktur (Highlights)

Top-Level `lokyy-workspace/src/` enthält folgende relevante Verzeichnisse und Dateien:

| Konzern | Pfad | Datei-Beispiele / Inhalt |
|---|---|---|
| **Routes (File-based)** | `lokyy-workspace/src/routes/` | `__root.tsx` (Root-Layout, setzt `.dark` Class), `index.tsx`, `dashboard.tsx`, `chat/`, `settings/`, `agora.tsx`, `conductor.tsx`, `jobs.tsx`, `mcp.tsx`, `memory.tsx`, `skills.tsx`, `swarm.tsx`, `tasks.tsx`, `api/` (Server-Routes) |
| **Generated Route Tree** | `lokyy-workspace/src/routeTree.gen.ts` | Auto-generiert durch TanStack Router Plugin — Hard-Constraint: nicht editieren |
| **Router Setup** | `lokyy-workspace/src/router.tsx` | `createRouter(...)` Bootstrap — Hard-Constraint: nicht editieren |
| **Zustand Stores** | `lokyy-workspace/src/stores/` | `workspace-store.ts`, `chat-store.ts`, `agent-swarm-store.ts`, `mission-store.ts`, `session-model-store.ts`, `task-store.ts`, `terminal-panel-store.ts`, `chat-activity-store.ts` (alle via `create()` aus `zustand`) |
| **UI Primitives** | `lokyy-workspace/src/components/ui/` | Shadcn-style Layer auf Base UI: `button.tsx`, `dialog.tsx`, `tabs.tsx`, `tooltip.tsx`, `command.tsx`, `menu.tsx`, `switch.tsx`, `toast.tsx`, `alert-dialog.tsx`, `autocomplete.tsx`, `collapsible.tsx`, `input.tsx`, `preview-card.tsx`, `scroll-area.tsx`, `braille-spinner.tsx`, `three-dots-spinner.tsx` |
| **Feature-Komponenten** | `lokyy-workspace/src/components/` (top-level + Sub-Ordner) | `agent-chat/`, `agent-swarm/`, `agent-view/`, `cron-manager/`, `file-explorer/`, `inspector/`, `command-palette.tsx`, `chat-panel.tsx`, plus diverse Status- und Banner-Komponenten |
| **Global CSS (Tailwind v4 Entry)** | `lokyy-workspace/src/styles.css` | 1533 Zeilen, `@import 'tailwindcss'` (Zeile 2), `@variant dark (...)` Setup (Zeile 5), CSS-Variablen wie `--tabbar-h`, `--chat-content-max-width` ab Zeile 7 |
| **Sci-Fi Theme CSS** | `lokyy-workspace/src/scifi-theme.css` | 394 Zeilen — separates Theme-Layer (relevant für Reskin-Tokens) |
| **Hooks** | `lokyy-workspace/src/hooks/` | React Hooks — Hard-Constraint: nicht editieren |
| **Lib / Utils** | `lokyy-workspace/src/lib/`, `lokyy-workspace/src/utils/` | Util-Layer — `src/lib` ist Hard-Constraint |
| **Server (SSR / API)** | `lokyy-workspace/src/server/` | Server-seitiger Code inkl. `pty-helper.py` (siehe `vite.config.ts:721-728`) |
| **Screens** | `lokyy-workspace/src/screens/` | Composite Screen-Komponenten (Layer zwischen Routes und Komponenten) |
| **Types** | `lokyy-workspace/src/types/` | TypeScript-Typdefinitionen |
| **Logo (aktuell)** | `lokyy-workspace/src/logo.svg` | Hermes Logo — Ziel-Reskin-Asset für Lokyy-Branding |

**Build-Pfad-Alias:** `@/*` → `./src/*` definiert in `lokyy-workspace/vite.config.ts:452` (Resolve-Alias) und via `vite-tsconfig-paths` Plugin (Zeile 552-554).

**Dev-Server-Port:** 3000 (`vite.config.ts:478`), Host `0.0.0.0` für LAN-Zugriff (Zeile 473).

---

### Abweichungen / Auffälligkeiten

1. **Dual-CSS-Setup:** Es existieren zwei globale Stylesheets — `src/styles.css` (Tailwind v4 Entry, 1533 Zeilen) und `src/scifi-theme.css` (394 Zeilen, separates Theme-Layer). Für das Etappe-1-Reskin müssen beide auf Lokyy-Tokens geprüft werden. Die Issue-Vorgabe nannte nur "global CSS" Singular — relevant für Step 3.1 (Design-Konzept).

2. **Bonus-Stack über Issue-Erwartung hinaus** (nicht abweichend, aber für Recon-Vollständigkeit dokumentiert):
   - **Electron Desktop-Shell** (`electron ^40.8.2`, `electron-builder ^26.8.1`) — `package.json:91-92`, Entry `electron/main.cjs` via `"main"` Feld Zeile 9. Etappe 1 ist webonly, Electron-Build steht ausserhalb des Reskin-Scopes.
   - **Three.js / R3F** (`three ^0.184.0`, `@react-three/fiber ^9.6.1`, `@react-three/drei`, `@react-three/rapier`, `ecctrl`) — `package.json:36-39,50,71`. Lebt vermutlich in `src/routes/hermes-world.tsx`. Reskin-irrelevant, aber Performance-Footprint.
   - **Monaco Editor** (`@monaco-editor/react ^4.7.0`), **xterm** (5.3.0 + 3 Addons), **Playwright + Stealth Plugin** — alle Backend-/Tooling-fokussiert, ausserhalb des sichtbaren UI-Reskins.
   - **Framer Motion / motion** parallel installiert (`framer-motion ^12.36.0` + `motion ^12.29.2`) — möglicherweise Übergang im Upstream; nicht reskin-kritisch.
   - **`@hugeicons/react` + `@lobehub/icons`** als Icon-Libraries — für Lokyy-Branding ggf. ersetzen oder Logo-Tokens anpassen.

3. **`hermes-agent` Auto-Start im Dev-Server:** `vite.config.ts:27-212` startet automatisch einen Python-Backend (`hermes gateway run` oder `uvicorn`) auf Port 8642. Pure UI-Reskin-Arbeit lässt sich trotzdem isolieren — relevant für reibungslose lokale `pnpm dev`-Sessions.

4. **`workspace-daemon` Sidecar:** Zusätzlich startet ein zweiter Hilfsprozess auf Port 3099 (`vite.config.ts:231-326`) — TypeScript via `tsx watch`. Erneut Backend-Layer, kein UI-Bezug.

5. **`package.json` Felder `"name": "hermes-workspace"`, `"author"`, `"description"`** sind laut CLAUDE.md Hard-Constraint und dürfen **nicht** geändert werden — bestätigt vorhanden in `package.json:2-5`. Lokyy-Branding bleibt visuell-only.

6. **Tag/Commit:** Lokales `git describe` zeigt sauberes `v2.3.0` auf Commit `15fa9cd7` — passt exakt zum Pin in `CLAUDE.md`. Kein Drift.

---

**Fazit:** Stack-Erwartung der Issue zu 100% bestätigt. Repo-Struktur klar gegliedert. Reskin-relevante CSS-Layer und UI-Primitive-Ordner sauber lokalisiert. Empfehlung für Step 3.1: Design-Tokens beidseitig in `styles.css` **und** `scifi-theme.css` mappen.
