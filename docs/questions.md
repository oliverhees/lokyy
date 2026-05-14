# Open Questions for Oliver

Items that require Oliver's decision before work can proceed.

---

## Lizenz (OFFEN — für Anwaltsgespräch)

**Status:** Offen
**Wer entscheidet:** Oliver (juristische Beratung empfohlen)

Lokyy soll später kommerziell angeboten werden. Die Hermes-Workspace-MIT-Lizenz erlaubt Forks und kommerzielle Nutzung, verlangt aber Beibehaltung des Copyright-Vermerks. Die strategische Frage — ob Lokyy selbst Open Source bleibt (Open Core), proprietär wird, oder ein anderes Modell — ist offen. Diese Entscheidung sollte **vor dem ersten öffentlichen Release** mit juristischer Beratung getroffen werden.

**Kontext:** `docs/licensing-todo.md` (wird in Step 2 befüllt) enthält die Lizenzinventarisierung aller Stack-Komponenten als Entscheidungsgrundlage.

---

## Visuelle Verifikation auf Linux (Q-002 — RESOLVED ✅)

**Status:** Geschlossen am 2026-05-14 — Oliver wählte **Option B (Playwright)** in [Issue #22](https://github.com/oliverhees/lokyy/issues/22).
**Umsetzung:** `scripts/verify-ui.ts` (Playwright headless Chromium), Setup via `bun install` + `bunx playwright install chromium`. Workflow dokumentiert in `scripts/README.md`. Baseline-Screenshot der Pre-Reskin Hermes-Optik unter `docs/verification-shots/baseline-hermes-look.png`.
**Override:** Lokyy/Linux-spezifischer Override der CLAUDE.md-Regel "Interceptor for ALL web verification". Als Project-Memory hinterlegt.
**Trifft auf:** Issue [#14](https://github.com/oliverhees/lokyy/issues/14) (Phase A) und alle nachfolgenden Reskin-Issues — ab jetzt nutzen alle `bun run scripts/verify-ui.ts`.
**Aufgetaucht in:** Issue [#3](https://github.com/oliverhees/lokyy/issues/3)

CLAUDE.md (global, Oliver's PAI-Regel) schreibt vor: **„Interceptor for ALL web verification."** Aber: Interceptor CLI ist auf diesem Linux-System (Pop!_OS) nicht installiert — die Skill-Installations-Pfade sind Mac-spezifisch (`/opt/homebrew/bin/`, `~/Projects/interceptor`). Chrome läuft (PID 14304), aber die Extension + Native Messaging Bridge fehlen.

**Für Issue #3** (Workspace startet) reicht HTTP-Level-Verifikation (curl + Dev-Server-Log) — siehe Closing-Comment.

**Für Phase A onward** (Token-Layer, UI-Primitives, Layout-Shell) brauchen wir echte visuelle Verifikation. Optionen:

| Option | Aufwand | Treue |
|--------|---------|------|
| A: Interceptor auf Linux installieren (Chrome-Extension + Daemon + Native-Messaging-Manifest selbst bauen) | ~1h Setup, eigenes Issue | Real Chrome ✅ |
| B: Playwright nutzen (ist bereits als Dep im Workspace, `node_modules/playwright`) | 5min, ein kleines TS-Script | Headless Chromium (verstößt gegen CLAUDE.md-Regel) |
| C: agent-browser CLI (Browser-Skill) | mittlerer Aufwand | Headless via CDP (verstößt gegen CLAUDE.md-Regel) |
| D: Manuelle Chrome-Screenshots durch Oliver pro Phase | 0 für mich, etwas für Oliver | Real Chrome ✅ |

**Empfehlung:** Option A separat als Setup-Issue tracken und VOR Issue #14 abschließen. Alternativ Option D als pragmatischer Fallback.

**Bitte entscheiden:** A, B, C oder D — und ob jetzt oder erst kurz vor Phase A.

---

## In-Component-UI-Strings "Hermes Workspace" (Q-003 — Etappe-2-Kandidat)

**Status:** Offen, Brief-konformes Carry-Over aus Etappe 1
**Aufgetaucht in:** Issue [#18](https://github.com/oliverhees/lokyy/issues/18) (Phase E)

Phase E hatte Scope: **README.md + CONTRIBUTING + SECURITY + Bilder/Assets/Favicon/OG/manifest**. Inside-Component-JSX-Strings (z.B. "Hermes Workspace" im Chat-Empty-State, Login-Modal-Texte, Onboarding-Karte, Settings-Section-Labels) waren **nicht** im Brief-Scope von Phase E.

Sichtbar im Phase-E-After-Screenshot: das Chat-Empty-State zeigt noch "HERMES WORKSPACE / Begin a session / Agent chat · live tools · memory · full observability". Ähnlich in Mobile-Komponenten, Sound-Library-Labels.

**Optionen:**
- A: Etappe 2 — eigenes Issue für "Komplett-Sweep aller sichtbaren UI-Strings"
- B: Spätere Phase D-2 nach Etappe-1-Closeout
- C: Pro-Komponente bei nächstem Upstream-Merge mitziehen

**Empfehlung:** A (eigenes klares Etappe-2-Issue), weil Brief-Regel "Lokyy überall wo ein Mensch es sieht" sonst nicht erfüllt ist. Aktuell sichtbar-Hermes-Texte sind: chat-empty-state, login/onboarding, „Hermes Agent" als Backend-Label in Settings, einige mobile-tab-bar Labels, Skill-Marketplace-Titles.

## Hermes-Marketing-Routen referenzieren gelöschte Assets (Q-004 — bewusst akzeptiert)

**Status:** Bewusst akzeptiert für Etappe 1
**Aufgetaucht in:** Issue [#18](https://github.com/oliverhees/lokyy/issues/18) (Phase E)

`src/screens/hermes-world/hermes-world-landing.tsx` + `playground-screen.tsx` referenzieren Assets aus `public/assets/hermesworld/**` — die Phase E gelöscht hat. Wenn jemand die Routen direkt aufruft (`/world`, `/playground`), gibt's 404er für die Bilder.

Brief-Recommendation für diese Routen war "hide" → Sidebar führt sie nicht auf, in der Lokyy-Navigation **unerreichbar**. Direct-URL bleibt theoretisch möglich. Trade-off bewusst gewählt: lieber 404er auf hidden routes als 24MB Hermes-Branding im Repo.

**Empfehlung:** keine Aktion in Etappe 1. Falls in Etappe 2 die Marketing-Routen ganz entfernt werden (via routes/ delete + routeTree regenerate), ist das Problem weg. Bis dahin: hidden + 404 ist akzeptabel.

---

## Swarm-Page Redesign (Q-005 — Etappe-2-Kandidat)

**Status:** Offen
**Aufgetaucht in:** Issue [#26](https://github.com/oliverhees/lokyy/issues/26)

Olivers Feedback nach #25-Fixup: "Ich weiß noch nicht wie aber Swarm
müssen wir irgendwie Moderner gestalten das sieht so null gut aus und
ist null übersichtlich."

Phase D hatte Swarm-Frame restyled, aber die innere Komposition
(Main-Agent-Card, Mission-Input, Tabs, Worker-Cards mit Hermes-
Avataren, Active-Swarm/Office-Toggle) ist visuell unruhig — viele
kleine Sub-Cards ohne klare visuelle Hierarchie.

**Empfehlung Etappe 2:** UX-Designer-Session (Sally) für eine
strukturelle Neuordnung. Möglicherweise:
- Mission-Input + Routing prominent als 1 Hero-Card
- Worker-Liste tabular oder kompakter Grid
- Aktive Worker visuell vom Roster trennen
- Cleaner Status-Indicators

---

## Weitere Fragen (werden laufend ergänzt)

*Noch keine weiteren offenen Punkte.*
