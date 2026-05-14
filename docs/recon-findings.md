# Recon-Findings — Etappe 1, Step 2

> **Stand:** 2026-05-14
> **Scope:** `lokyy-workspace/` @ `v2.3.0` (commit `15fa9cd7`)
> **Methode:** 7 parallele Mary-Agents (BMAD `bmad-agent-analyst`), je ein Aspekt, **read-only** auf den Workspace. Orchestrator hat Findings konsolidiert.
> **Folge-Gate:** [Issue #11](https://github.com/oliverhees/lokyy/issues/11) — Olivers Freigabe nötig vor Step 3.

---

## Inhaltsverzeichnis

| § | Thema | Quell-Datei | Gh-Issue |
|---|-------|-------------|----------|
| 2.1 | Tech-Stack & Repo-Struktur | [`recon/tech-stack.md`](recon/tech-stack.md) | [#4](https://github.com/oliverhees/lokyy/issues/4) |
| 2.2 | **Theming-System (KRITISCH)** | [`recon/theming.md`](recon/theming.md) | [#5](https://github.com/oliverhees/lokyy/issues/5) |
| 2.3 | UI-Komponenten-Inventar | [`recon/ui-components.md`](recon/ui-components.md) | [#6](https://github.com/oliverhees/lokyy/issues/6) |
| 2.4 | Layout-Shell & Sidebar | [`recon/layout-shell.md`](recon/layout-shell.md) | [#7](https://github.com/oliverhees/lokyy/issues/7) |
| 2.5 | Alle Routen | [`recon/routes.md`](recon/routes.md) | [#8](https://github.com/oliverhees/lokyy/issues/8) |
| 2.6 | Bildmaterial & Doku | [`recon/assets.md`](recon/assets.md) | [#9](https://github.com/oliverhees/lokyy/issues/9) |
| 2.7 | Lizenz-Inventar | [`recon/licenses.md`](recon/licenses.md) + [`licensing-todo.md`](licensing-todo.md) | [#10](https://github.com/oliverhees/lokyy/issues/10) |
| **2.8** | **Einordnung & Strategie-Check (Orchestrator)** | unten in dieser Datei | — |

---

## 2.1 Tech-Stack & Repo-Struktur

Alle 7 Erwartungen aus dem Etappe-1-Brief bestätigt. Versionen: **React `19.2`, TypeScript `5.7` (strict), Vite `7.3`, Tailwind `4.1`, `@base-ui/react 1.1`, TanStack Router/Start `1.132`, Zustand `5.0`**. Kein `@radix-ui`. File-based Routing in `src/routes/` (gen → `routeTree.gen.ts`). 8 Zustand-Stores in `src/stores/`. UI-Primitives unter `src/components/ui/`.

**Drei nicht-offensichtliche Befunde:**
1. **Dual-CSS-Setup:** `src/styles.css` (1533 Z.) + `src/scifi-theme.css` (394 Z., importiert in `styles.css:1533`) — Phase A muss beide tokenisieren.
2. **Erweiterter Stack ausserhalb Reskin-Scope:** Electron + Three.js/R3F + Monaco + xterm + Playwright im Workspace selbst — alles im Stack, alles `keep`.
3. **`pnpm dev` startet zwei Backend-Sidecars** (hermes-agent :8642, workspace-daemon :3099). Für Reskinning irrelevant, aber gut zu wissen.

Vollständige Tabelle und Evidence → [`recon/tech-stack.md`](recon/tech-stack.md).

---

## 2.2 Theming-System (KRITISCH)

**Mechanismus:** Plain CSS Custom Properties, gewechselt über `[data-theme='…']` auf `<html>`. Tailwind 4 ist nur via `@import 'tailwindcss'` (`styles.css:2`) + `@variant dark` (`styles.css:5`) drin — **kein `@theme`-Block**. Die Theme-Engine ist komplett custom.

**Themes:** 8 in der Whitelist (`__root.tsx:51-60`), `claude-nous` ist Default (`__root.tsx:50`). 4 Familien × {dark, light}. `matrix`/`matrix-light` existieren in CSS aber sind Whitelist-Outside → Dead-Code.

**Bootstrap:** Inline-Script `themeScript` in `__root.tsx:49-85` liest `localStorage['claude-theme']`, validiert, fällt auf `claude-nous` zurück, setzt `data-theme` + `.dark`/`.light` + `color-scheme` synchron.

**Token-Volumen:** **27 `--theme-*`-Variablen pro Theme** (bg, sidebar, panel, card, card2, border, accent-Familie, text/muted, shadow-1/2/3, glass, success/warning/danger, header, input) plus chat-/composer-/tool-/code-Tokens. Mehr als der Brief erwartet hat — aber unkritisch.

**Bridge-Mapping Hermes → Shadcn (Phase A):** Architekt-Output liegt als Tabelle in [`recon/theming.md`](recon/theming.md). Strategie: **additiver** Lokyy-Layer pro `[data-theme=…]`-Block, der die Shadcn-Tokens (`--background`, `--primary`, `--card`, `--popover`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`) aliased. Zero functional change, reversibel, propagiert automatisch über alle 8 Themes.

**Drei offene Punkte für Phase A:**
- `shadow-1/2/3` haben keine kanonische Shadcn-Entsprechung — als Lokyy-Eigentokens stehen lassen
- `--radius`-Skala muss neu eingeführt werden (Hermes hat keine zentrale)
- `--success`/`--warning`/`--info` haben keinen Shadcn-Default — als Lokyy-Eigentokens stehen lassen

Volle Variablen-Tabelle + Bridge-Mapping → [`recon/theming.md`](recon/theming.md).

---

## 2.3 UI-Komponenten-Inventar

**16 Komponenten** unter `src/components/ui/`. **13/16 importieren `@base-ui/react`** (sanity-checked: `dialog.tsx:3` bestätigt).

**Konsequenz für Phase B:** Shadcn-CLI-Komponenten sind **nicht 1:1 kopierbar** — sie sind Radix-basiert. Wir müssen Klassen-Strings abgucken und auf Base-UI portieren.

**Patterns:** Nur `button.tsx:5` nutzt `cva()`. Andere Variants laufen über `cn()`-Bedingungen → in Phase B Konsistenz-Entscheidung treffen (alles auf `cva()` ziehen oder Status quo lassen?).

**3 Komponenten ohne Base UI:** `braille-spinner`, `three-dots-spinner`, `toast` (Eigenbau, kein Sonner).

**7 Komponenten mit `style={{}}`-Inline-Styles** — alle für Base-UI-`Positioner`-Sizing, **nicht für Optik**. Beim Reskin nicht entfernen.

**Shadcn-Gap P1 (essentiell für Phase D):** `card`, `badge`, `separator`, `table`, `skeleton`, `label`.
**Shadcn-Gap P2:** `sheet`, `alert`.

Vollständige Tabelle → [`recon/ui-components.md`](recon/ui-components.md).

---

## 2.4 Layout-Shell & Sidebar

- **Shell:** `src/components/workspace-shell.tsx` (463 Z.). CSS Grid, dynamisches Template (`md:grid-cols-[auto_1fr]`, kollabiert zu `md:grid-cols-1` bei chat-focus / chrome-free).
- **Sidebar:** `src/screens/chat/components/chat-sidebar.tsx` (1314 Z.) — 48px collapsed / 300px expanded auf Desktop, 85vw als Mobile-Overlay.

**13 Nav-Items in 2 Sections + 3 Standalone** — file:line-dokumentiert in [`recon/layout-shell.md`](recon/layout-shell.md). Display-Order Main: Dashboard, Chat, Files, Terminal, Jobs, Kanban, Conductor, Operations, Swarm. Knowledge: Memory, Skills, MCP, Profiles.
**Memory und Knowledge bleiben unverändert.** (Brief-Regel)

**Mobile:** **kein separates Layout-Root.** Gleiche Shell + `matchMedia('(max-width: 767px)')` + zusätzliche Komponenten (`MobileTabBar`, `MobileHamburgerMenu`, `MobilePageHeader`, `MobileTerminalInput`). `MobileTabBar` hat eine **eigene** `MOBILE_NAV_TABS`-Liste (`mobile-tab-bar.tsx:48-134`) → Phase C muss Nav-Items potenziell zweifach spiegeln.

---

## 2.5 Routen

**29 Page-Routen** inventarisiert (read-only via Glob + cross-check mit `routeTree.gen.ts`). **10 Domain-Gruppen**: Core-Shell, Dashboard, Multi-Agent, Task/Job, Capabilities, Daten, Chat, Terminal, Settings, Hermes-Marketing.

API-Routen (`routes/api/**`) bewusst **nicht** in dieser Liste — gehört nicht zu Etappe 1 (Brief: API-Routes nicht anfassen).

**8-Tier-Priorisierung für Phase D** (in [`recon/routes.md`](recon/routes.md) ausgeschrieben): `__root` → `dashboard` → `chat` → `operations`/`conductor`/`swarm*` → `tasks`/`skills`/`mcp` → `jobs`/`memory`/`files`/`profiles` → Settings → Terminal → Hermes-Marketing-Routen → Edge.

**Drei offene Punkte für Oliver** (siehe auch 2.8):
- Hermes-Brand-Routen (`/world`, `/hermes-world`, `/reserve`, `/vt-capital`, `/agora`, `/playground`) — keep, remove, oder hide?
- Lokyy-eigene Repo/Discord-Links in `/early-access` — auf Lokyy-Quellen umbiegen?
- `/swarm` ist nur Alias auf `Swarm2Screen` → in Phase D als eine Page zählen.

---

## 2.6 Bildmaterial & README

**22 Hermes-Brand-Assets** + `manifest.json` zur Ersetzung in Phase E. Komplettes Claude-/Hermes-Logo-Set, Favicon-Set (6 Dateien), Banner/Cover/OG, Default-DA-Avatar, `assets/icon.png` (Electron-Builder).

**~18 MB Hermesworld-Material zum Entfernen:** `public/assets/hermesworld/**` (22 Dateien), `docs/hermesworld/**` (19 Docs + 7 Reference-Bilder), 4 Hermesworld-Screenshots in `screenshots/`.

**Doku-Rewrites:**
- `README.md` — **123 Hermes-Mentions** → Hauptarbeit von Phase E
- `CONTRIBUTING.md` (4 Mentions), `SECURITY.md` (4), `FEATURES-INVENTORY.md` (24)
- 6 Partial-Rewrites in `docs/` (docker, troubleshooting, naming-contract, etc.)

**Preserve (Brief-Constraints):**
- `LICENSE` **verbatim** (MIT, Eric/outsourc-e, niemals anfassen)
- 9 Conductor-Avatare inkl. `hermes.png` (Code-Identifier, kein Branding-Visual)
- 16 ASCII-Portraits, 19 Provider-Drittlogos
- `package.json` `name`/`description` (Code-Identifier, per CLAUDE.md-Branding-Regel)

Vollständige Asset-Tabelle → [`recon/assets.md`](recon/assets.md).

---

## 2.7 Lizenz-Inventar

Strikt **Faktensammlung, keine Bewertung**. Entscheidungsgrundlage für Olivers Anwaltsgespräch.

| Komponente | Lizenz | Bemerkenswert |
|------------|--------|---------------|
| Hermes Workspace | MIT | (lokale LICENSE bestätigt) |
| Hermes Agent | MIT | — |
| Cognee | Apache-2.0 | NOTICE-Mitliefer­pflicht |
| **Forgejo** | **GPL-3.0-or-later** | **einziges Copyleft im Stack** (Lizenzwechsel ab v9.0) |
| Traefik | MIT | Enterprise / Hub separat proprietär |
| **Authentik** | **Dual: MIT Core + proprietäre EE** | Enterprise-Pfad ist nicht MIT |

Volle Quellen-URLs + SPDX-Zitate → [`recon/licenses.md`](recon/licenses.md). Befüllte Anwalt-Tabelle → [`licensing-todo.md`](licensing-todo.md).

**Drei Punkte für Anwaltsgespräch hervorgehoben:** Forgejo als einziges Copyleft, Authentik-Dual-License-Scope, Cognee NOTICE-Compliance.

---

## 2.8 Einordnung & Strategie-Check

**Frage des Briefs:** *„Deckt sich der reale Code mit den Annahmen aus der Reskin-Strategie?"*

**Antwort: Ja — mit drei dokumentierten Anpassungen.**

### Was bestätigt ist
- Tech-Stack matcht Erwartungen über die ganze Bandbreite (React 19 / TS strict / Vite / Tailwind 4 / Base UI / TanStack / Zustand)
- Theming basiert auf Plain-CSS-Custom-Properties mit `[data-theme=…]`-Attribut-Switching → Bridge-Mapping-Strategie funktioniert mechanisch
- Base UI als UI-Primitive-Layer → Shadcn-Token-Layer integriert sich ohne zweite UI-Library
- 13/16 UI-Komponenten sind bereits Base UI → grosser Teil von Phase B ist „nur" Re-Styling
- Default-Theme-Bootstrap ist eine 1-File-Anpassung (`__root.tsx:49-85`) → kein Risiko

### Was die Strategie anpassen muss
1. **Phase A wird ~25% grösser.** `scifi-theme.css` (394 Z.) muss zusätzlich zu `styles.css` (1533 Z.) tokenisiert werden — Bridge-Mapping deckt beide ab. Kein Architektur-Wechsel nötig.
2. **Phase B Komponenten-Neuanlage = Hand-Port, nicht Shadcn-CLI-Copy.** Die fehlenden Shadcn-Standards (`card`, `badge`, `separator`, `table`, `skeleton`, `label`, `sheet`, `alert`) müssen aus den Shadcn-Quellen abgekuckt und auf Base UI portiert werden. Mehraufwand ~+30% gegenüber „Shadcn-CLI installieren".
3. **Phase C muss Mobile-Nav potenziell zweifach pflegen.** `MobileTabBar` führt eine eigene Item-Liste in `mobile-tab-bar.tsx:48-134`. Optionen für Phase C: (a) Listen synchron halten (Disziplin-Anfälligkeit), (b) Liste zur Single-Source-of-Truth-Konstante extrahieren (kleine Refactor, ein zusätzlicher Touchpoint in `LOKYY.md`), (c) Akzeptanz der Duplikation (Status quo).

### Was Oliver **vor Phase D** entscheiden muss
- **Hermes-Marketing-Routen** (`/world`, `/hermes-world`, `/reserve`, `/vt-capital`, `/agora`, `/playground`) — keep (nur reskin), remove (löschen + Sidebar-Eintrag entfernen), oder hide (Conditional Render hinter Lokyy-Branding-Flag)?
  → Empfehlung: **hide** über ein einzelnes Lokyy-Branding-Flag, da das Entfernen sonst pro Upstream-Merge wieder reverted werden kann.
- **`/early-access`-Links** auf Hermes-Discord/Repo → auf Lokyy umbiegen oder belassen?
  → Empfehlung: **umbiegen**, kleiner Edit, gehört zu Phase E (README).

### Was komplett offen bleibt (Oliver + Anwalt)
- Lizenz-Strategie für Lokyy (`docs/questions.md` Q-001, [Issue #22-Folgekontext]). Nicht Etappe 1.

### Bottom line
Die Reskin-Strategie (Token-Layer + selektiver Layout-Austausch + Page-by-Page) **hält**. Kein Architektur-Wechsel nötig. Die drei Anpassungen oben sind Scope-Erweiterungen innerhalb der bestehenden Phasen, nicht neue Phasen. Empfehlung an Oliver: **Checkpoint 1 freigeben**, mit Notiz dass Phase A 25% länger und Phase B 30% mehr Komponenten-Arbeit ist als der Brief geschätzt hat.

---

## Folgeschritte

1. **Oliver schliesst [#11](https://github.com/oliverhees/lokyy/issues/11)** ("Freigegeben" oder mit Änderungswünschen) → Issue #12 (Design-Konzept) kann starten.
2. Orchestrator: Issue #12 an **Sally (bmad-agent-ux-designer)** + **Paige (bmad-agent-tech-writer)** delegieren. Output: `docs/lokyy-design.md` (Akzentfarbe, Logo, Radius) → Checkpoint #13.
