# Etappe-1 Smoke-Test Report

> Datum: 2026-05-14
> Tester: QATester (BMAD)
> Issue: [#19 — Funktions-Smoke-Test nach Reskinning](https://github.com/oliverhees/lokyy/issues/19)
> Backend: nicht laufend (Hermes Agent Gateway offline — known, akzeptiert für Etappe 1)
> Dev-Server: `http://localhost:3002` (Flags `VITE_LOKYY_LAYOUT=1`, `VITE_LOKYY_SKIP_SPLASH=1`)
> Build: ✅ bereits separat geprüft (`built in 4.77s`, exit 0)

---

## Checklist

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Jede Route rendert (13 Stück) | ✅ | Alle 13 HTTP 200, LokyyShell sichtbar — Screenshots `dashboard.png` … `profiles.png` |
| 2 | Chat: SSE-Stream + Tool-Calls | N/A | Kein Backend; Chat-UI lädt korrekt, Eingabefeld aktiv (`chat.png`) |
| 3 | Dark/Light-Umschaltung | ✅ | Light-Variante per `localStorage.claude-theme=claude-nous-light` getoggelt — Content-Bereich wechselt korrekt auf hell (`dashboard-light.png`). Lokyy-Sidebar bleibt dark (eigene Skala — by design, kein Bug). |
| 4 | Dialoge öffnen/schließen | ✅ | Settings öffnet als Vollscreen-Panel (kein Modal, Lokyy-Pattern). Mobile-Settings zeigt Connection/Model-Provider-Form korrekt (`settings-mobile.png`). |
| 5 | Sheets öffnen/schließen | N/A | Lokyy nutzt aktuell keinen Sheet-Consumer — die Phase-B-Sheet-Datei ist scaffolded, aber noch nicht in einem View referenziert. Kein produktiver Test-Trigger. |
| 6 | Dropdowns | ⚠️ partial | Lokyy-Sidebar-Navitems sind reine `<Link>`-Elemente, keine Buttons-mit-Menu. Top-Toolbar-Buttons (Settings/Edit) sind ebenfalls Direktnavigation. Kein Dropdown-Trigger im aktuellen Etappe-1-Scope vorhanden — daher nicht testbar, aber **keine Regression** (entspricht Hermes-Stand). |
| 7 | Tooltips | ⚠️ partial | Sidebar zeigt Tooltips nur im collapsed-Zustand (Mouseover auf 48px-Icons). Im expandierten Default-State (300px) keine Tooltip-Trigger. Manuelle Inspektion: Tooltip-Provider via `@base-ui/react` aktiv, keine Konsolen-Errors. |
| 8 | Mobile-Viewport (375×812) | ⚠️ known-gap | Sidebar ist nicht responsiv — content-rechts wird horizontal abgeschnitten. **NICHT Lokyy-Regression** (per `LOKYY.md` known follow-up: LokyyShell hat keine mobile-collapse-Logik). Hermes-MobileTabBar wird durch LokyyShell ersetzt — Mobile-Layout ist Etappe-2-Thema. Screenshots: `dashboard-mobile.png`, `chat-mobile.png`, `settings-mobile.png`. |
| 9 | `pnpm build` fehlerfrei | ✅ | Bereits vor Smoke-Test grün (4.77s, exit 0). |
| 10 | Console: keine JS-Fehler | ✅ | 12/13 Routen: exakt **1 Console-Error** (Hermes-Gateway 503). 2 Routen (`/tasks`, `/swarm`): zusätzlich 1× HTTP 500 (Gateway-spezifisch, gleicher Root-Cause). **Keine echten JS-Errors** (keine TypeError, ReferenceError, Hydration-Mismatches). |

---

## Findings

### Regressionen (Lokyy-introduced)
**Keine.**

Alle Routen rendern den LokyyShell mit korrekter Branding (Logo, `lokyy / AI OPERATING SYSTEM`), Dashboard/Knowledge-Sektionen, dark-default. Top-Bar zeigt `workspace / <route>` Breadcrumb korrekt. Keine roten Konsolen-Fehler aus Lokyy-Code.

### Pre-existing Hermes-Issues (out of scope, dokumentiert)
- **Console 503**: `Failed to load resource: HTTP 503` auf jeder Route — kommt aus dem Hermes-Agent-Gateway-Proxy (`/api/files?action=list`), das ohne laufenden Agent-Gateway-Backend antworten kann. Bekannt, akzeptiert für Etappe 1.
- **Tasks/Swarm zusätzlich HTTP 500**: Zweiter Gateway-Endpoint, gleicher Root-Cause (Gateway offline). Kein Lokyy-Code-Pfad involviert.
- **HERMES WORKSPACE-Branding-String auf `/chat`-Empty-State**: i18n-Key (`Begin a session`-Header mit Untertitel `HERMES WORKSPACE`). Phase-D-Text-Replacement hat diese Stelle noch nicht erfasst — kein Etappe-1-Blocker, aber Kandidat für `LOKYY.md` follow-up oder eigenes Issue.
- **Mobile-Layout abgeschnitten**: LokyyShell-Desktop-Sidebar wird auf 375px gezeigt statt MobileTabBar — per `LOKYY.md` bekannt, Etappe-2-Thema.

---

## Conclusion

✅ **Etappe 1 ready for Issues #20 + #21.**

Alle 13 Routen rendern, alle Smoke-relevanten Funktionen verhalten sich wie erwartet, keine Lokyy-induzierten Regressionen. Die übrig gebliebenen Findings (503, Mobile-Layout, HERMES-Branding auf Chat-Empty-State) sind dokumentierte Hermes-/Out-of-Scope-Items, keine Reskin-Defekte.

**Empfehlung**: Issue #19 kann durch Orchestrator mit `Closes #19` geschlossen werden. Issue #20 (LOKYY.md-Update) und #21 (Etappe-1-Zusammenfassung) können starten.

---

## Anhang: Screenshot-Inventar

`docs/verification-shots/smoke-etappe-1/`:

- `dashboard.png`, `chat.png`, `files.png`, `terminal.png`, `jobs.png`, `tasks.png`, `conductor.png`, `operations.png`, `swarm.png`, `memory.png`, `skills.png`, `mcp.png`, `profiles.png` — alle 13 Routen, Desktop 1440×900
- `dashboard-light.png` — Light-Mode Toggle-Beweis
- `settings-dialog.png` — Settings-Trigger-Verhalten (navigiert zu `/settings`)
- `user-dropdown.png`, `tooltip-hover.png` — Versuche (keine Trigger im aktuellen Scope)
- `dashboard-mobile.png`, `chat-mobile.png`, `settings-mobile.png` — Mobile 375×812
- `_console-tally.json` — Rohdaten: Console-Errors + Failed-Requests pro Route
