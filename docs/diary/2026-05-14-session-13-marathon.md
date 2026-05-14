# Session 13 (Marathon) — 2026-05-14 → 2026-05-15

> Diese Session lief von Vormittag 2026-05-14 bis tief in 2026-05-15. Sie covered die letzten Polish-Iterationen + setup-Saga + customization-philosophy. Dokumentiert als eine Session weil zusammenhängender Flow.

## Was angegangen wurde

Nach den 12 Etappe-1-Sessions die Phase A–E durchzogen + Smoke + Merge-Probe, fokussierte diese Session sich auf:

1. **Visual-Polish-Iterationen** auf Olivers Live-Feedback (8+ Iterationen)
2. **Hermes-Setup-Saga** — Gateway + Dashboard + Provider-Config (3 separate Services musste man aktivieren)
3. **Customization-Philosophy** — `docs/customization-guide.md` als wiederverwendbare Decision-Tool

## Issues durchgezogen (#25 → #37 = 13 Issues an einem Tag)

| Issue | Was | Pattern (Customization-Guide-Ref) |
|-------|-----|-------------------------------|
| **#25** | Phase-A-Fixup: Hermes-Tokens auf Lokyy-Bridge aliased (23 vars × 8 themes) | F — Bridge-Marker |
| **#26** | Phase-A++: composer/chat/tool-Tokens aliased (16 vars), BackendUnavailable + Memory restyled | B + Class-Restyle |
| **#27** | Inspector-Panel Lokyy-Tokens (bg-emerald → bg-primary), OrchestratorAvatar-Reference durch Initial-Circle ersetzt | B |
| **#28** | Swarm-Redesign-Proposal mit 3 Optionen; Oliver wählte C (Two-Pane) + Worker-Vereinfachung | Spec-only, Implementation Etappe 2 |
| **#29** | Chat-Empty-State auf Canonical-Card-Style + Inspector-Toggle-Button | B |
| **#30** | Inspector "white frame" gefixt (border-primary-200/20 + Gradient → bg-card border-border) | B |
| **#31** | AppSidebar User/Profile/Settings-Footer ergänzt | A — Pure-Add |
| **#32** | Hermes-Gateway-Setup: API_SERVER_ENABLED + HERMES_API_URL + `hermes gateway run --replace` | Doc + Config |
| **#33** | Configured-Provider-Cards weiß-auf-weiß-Bug → Lokyy-Tokens, Edit/Delete als Phase-B-Buttons | B |
| **#34** | `docs/customization-guide.md` ~290 Zeilen mit gemessenen Merge-Costs | Doc-Add |
| **#35** | Thinking-Box Lokyy-Card-Anatomie + UsageMeter-Top-Stripe weg + UsageMeterCompact in Composer | B + Pattern-C |
| **#36** | ContextBar Top-Stripe weg + Lokyy-Tokens + UsageMeterCompact-Duplikat raus | B + #35-Cleanup |
| **#37** | McpScreen entsperrt — Add-UI war schon gebaut, nur Catch-22-Gating dahinter; dashboardAvailable-Check ergänzt | B — Mini-Patch |

## Setup-Erkenntnisse (für die Onboarding-Dokumentation)

Hermes hat **zwei separate Services** die parallel laufen müssen:

| Service | Port | Was es liefert | Aktivierung |
|---------|------|---------------|-------------|
| `hermes gateway run` | 8642 | Chat-API (OpenAI-kompatibel) | `API_SERVER_ENABLED=true` in `~/.hermes/.env` muss vorher gesetzt sein, sonst hört Gateway HTTP nicht |
| `hermes dashboard --no-open` | 9119 | "Extended APIs": Sessions, Memory, Skills, Jobs, Config, MCP, Provider-Setup | nur Dashboard im Browser/Workspace, kein extra env |

Workspace braucht in `.env`:
```
HERMES_API_URL=http://127.0.0.1:8642
HERMES_DASHBOARD_URL=http://127.0.0.1:9119
```

→ Alles in `docs/setup-hermes-gateway.md` festgehalten.

## Strategische Erkenntnisse

### Anti-Pattern-Detail: Hermes-Capability-Probing
Hermes meldet Features als "unavailable" wenn sie 0 Instanzen haben (Beispiel: `capabilities.mcp = false` weil 0 MCP-Server). Das ist UX-irreführend — die Funktion EXISTIERT, sie ist nur leer. Lokyys Lösung in #37: zusätzlicher Check ob das Dashboard-Service generell erreichbar ist; wenn ja, render die Screen-Komponente trotzdem mit ihrem eigenen Empty-State. **Pattern für künftige Etappen:** Hermes-Capability-Reports ≠ Workspace-Availability — wenn das UI bereits einen Empty-State hat, sollte das Route-Gating nur das Backend-Service prüfen, nicht das Feature-Inventar.

### Pattern-Validierung
`docs/customization-guide.md` Pattern B (Class-Restyle) und Pattern A (Pure-Add) haben sich in #25-#37 durchgehend bewährt. Pattern H (Anti-Pattern: JSX-Rewrite) wurde NICHT verwendet — Class-Strings tauschen reicht in 95% der Fälle.

### Token-Coverage final
Nach #25 + #26: 39 Hermes-Custom-Tokens werden pro Theme aliased (23 main `--theme-*` + 16 component-level `--composer-*`/`--chat-*`/`--code-*`/`--tool-card-*`). Plus Bridge-Layer pro `[data-theme=…]`-Block. Plus `@theme inline` für Tailwind-Utility-Klassen. **Coverage ist komplett.**

## Olivers konkrete Feedback-Loops (für Etappe 2 zu wissen)

Oliver iteriert **visuell** — er macht Screenshots der Live-App, oft mit DevTools offen die das problematische Element markiert. Beispiel:
- DevTools-Selektor zeigte exakt `<div class="shrink-0 w-full h-2 ... bg-emerald-100">` → ich konnte 1-Grep-Run die Komponente finden → 18 min Resolution

Das ist **schnell und präzise**. Für Etappe 2 verlasse ich mich darauf statt zu raten.

## Berührte Dateien (diese Session)

**Outer Repo:**
- `LOKYY.md` aktualisiert (Touched-Categories ≈11 jetzt — knapp über der 8-10-Schwelle, aber alle pattern-konform)
- `docs/customization-guide.md` (neu, ~290 Zeilen)
- `docs/setup-hermes-gateway.md` (neu in #32, ~95 Zeilen)
- `docs/questions.md` (Q-005 für Swarm-Redesign ergänzt — jetzt mit Option-C-Spec + Olivers Worker-Vereinfachung)
- `docs/swarm-redesign-proposal.md` (mit Olivers Wahl Option C markiert)
- `scripts/screenshot-with-click-domready.ts` (neuer Helper für SSE-Pages)
- `scripts/screenshot-providers.ts` (one-shot helper)
- `docs/verification-shots/phase-a-fixup-{1..9}/` (9 Phase-Polish-Shot-Sets)
- `docs/verification-shots/hermes-connected/` (Setup-Diagnostic-Shots)

**Inner Repo (lokyy-workspace, lokyy/main):**
- 13 Inner-Commits zwischen `690778d3` und `c54d6c27`
- ~12 weitere Workspace-Files berührt (alle in src/components, src/screens, src/routes — keine Stores, keine Hooks, keine Lib)

## Stand am Ende

### Pipeline
| Status | Issues |
|--------|--------|
| Closed | #1–#10, #11–#20, #22–#37 (= **28 Issues** zu) |
| Open | **#21 — Etappe-1 Abschluss-Summary** (last item) |

### Visuelle Lokyy-Maturity
Alle 13 Sidebar-Routen plus Inspector + Composer + Settings-Subroute + MCP-Page-Empty-State rendern Lokyy-konsistent. Hermes-Marketing-Routen (`/world` etc.) absichtlich nicht reskinned (Brief-Recommendation "hide" via Sidebar).

### Backend-Stack
- Hermes Gateway läuft auf `:8642` (mit `API_SERVER_ENABLED=true`)
- Hermes Dashboard läuft auf `:9119` (via `nohup` damit's Session-Ende überlebt)
- Workspace dev (`pnpm dev`) ist **gestoppt** — Oliver muss morgen frisch starten, dann kommt Vite auf den nächsten freien Port (3000–3004 sind in der Umgebung teilweise belegt, daher gerne `:3005+`)

### Bekannte Carry-Overs für Etappe 2
1. **Q-003** — JSX-Hermes-String-Sweep ("HERMES WORKSPACE / Hermes Agent gateway / etc." in Component-Texten)
2. **Q-004** — Marketing-Routen referenzieren gelöschte Assets (akzeptiert)
3. **Q-005** — Swarm-Redesign-Implementation (Option C + Worker-Vereinfachung)
4. **#21 selbst** — Etappe-1-Final-Summary noch zu schreiben

## Nächster Schritt für morgen

**Option 1:** Issue #21 (Etappe-1-Summary) schreiben — `docs/etappe-1-summary.md` als zentrales Etappe-1-Recap-Doc, dann Etappe 1 offiziell durch.

**Option 2:** Etappe 2 spec-en — was sind die ersten 3-5 Etappe-2-Issues? Realistisch:
- Swarm-Implementation (Q-005, biggest)
- JSX-String-Sweep (Q-003, viele Files aber kleiner Aufwand pro File)
- Hermes-Agent-Update-Notification stylen oder hiden
- Optional: API_KEY-Validation-UX (so dass invalid keys früh erkannt werden statt 35s-Thinking)

**Option 3:** Hermes-Gateway als Daemon installieren via `hermes gateway install` so dass es bei System-Reboot auto-starts. Beides Services könnten dann via systemd-user statt nohup laufen.

Oliver entscheidet welcher Pfad zuerst.

## Wie morgen sauber wieder einstigen

```bash
# 1. Workspace-Dev wieder hochfahren
cd /media/oliver/Volume1/eigene_projekte_neu/lokyy/lokyy-workspace
pnpm dev    # nimmt nächsten freien Port

# 2. Browser auf http://localhost:<port>/ → Skip setup → Dashboard
# 3. Hermes Gateway + Dashboard sollten noch laufen (via nohup gestartet)
# 4. Falls Hermes Dashboard down: nohup hermes dashboard --no-open &
# 5. Falls Hermes Gateway down: hermes gateway run --replace (im Foreground oder eigenem Terminal)
```

Issue #21 oder Etappe-2-Issue erstellen, dann normal weitermachen mit den 3 Patterns aus `customization-guide.md`.
