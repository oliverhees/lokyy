# Swarm-Page Redesign — Proposal

> Status: Vorschlag zur Auswahl (Issue #28)
> Autor: Sally (bmad-agent-ux-designer)
> Datum: 2026-05-14
> Audience: Oliver — zur Auswahl einer Richtung für Etappe 2

---

## Part 1 — Problem-Analyse

Die aktuelle `swarm2`-Seite hat **keine klare visuelle Hierarchie**. Vier konkurrierende Zonen kämpfen gleichzeitig um den ersten Blick: die View-Tabs oben (Control/Board/Inbox/Runtime), die zentrale Orchestrator-Karte mit Avatar und Worker-Counts, der grosse Mission-Input, und unten zwei volle Spalten Worker-Karten in `min-height: 30rem`. Dazu kommen drei Routing-Pills, fünf Status-Filter, zwei View-Toggles und amber-gefärbte "Roster-only"-Warnungen — alles auf einer Höhe, ohne Primär/Sekundär-Trennung. Das Resultat ist Hermes-typischer Sci-Fi-Power-User-Look mit dichten grünen Frog-Avataren und Wires, der für Lokyys "ruhiges Cockpit, korrekt nicht cool, Pitch-Deck-fähig"-Mood **nicht funktioniert**. Die Hauptaktion (Mission routen) verschwindet zwischen Status-Indikatoren. Information-Density ist hoch, aber ohne Lesepfad. Decision-Overload entsteht weil **alle Steuerelemente gleichzeitig sichtbar** sind, statt progressiv enthüllt.

---

## Part 2 — Drei Optionen

### Option A — Hero Mission + Compact Roster

**One-liner:** Mission-Input wird zum vollbreiten Hero oben, Workers schrumpfen zu einem kompakten Status-Grid darunter.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SWARM                                            Control · Board · Logs │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  MISSION                                                        │   │
│   │  ┌───────────────────────────────────────────────────────────┐  │   │
│   │  │  Was soll der Swarm tun?                                  │  │   │
│   │  │                                                           │  │   │
│   │  └───────────────────────────────────────────────────────────┘  │   │
│   │                                                                 │   │
│   │  Routing:  [● Auto]  [ One Agent ]  [ Broadcast ]      [Route] │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ACTIVE  ─────────────────────────────────────────────  4 / 13 online  │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                           │
│   │ ● W1   │ │ ● W2   │ │ ◐ W3   │ │ ○ W4   │                           │
│   │ Build  │ │ PR     │ │ Review │ │ Idle   │                           │
│   │ sonnet │ │ qwen   │ │ opus   │ │ —      │                           │
│   └────────┘ └────────┘ └────────┘ └────────┘                           │
│                                                                         │
│   ROSTER  ──────────────────────────────────────────────  9 available   │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                          │
│   │W5│ │W6│ │W7│ │W8│ │W9│ │10│ │11│ │12│ │13│                          │
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                          │
│                                                                         │
│   Filter:  [ All ] [ Run ] [ Review ] [ Blocked ] [ Ready ]             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pros**
- Klare Hierarchie: Mission ist Primär, Roster ist Sekundär, Filter ist Tertiär.
- Kompakte Worker-Cards skalieren auf 13+ Workers ohne Scroll.
- Active-vs-Roster-Trennung beantwortet "wer arbeitet jetzt" auf einen Blick.
- Status-Filter inline als Segmented Control statt eigener Toolbar-Reihe.
- Niedrigste Migrations-Kosten — wiederverwendbare `Card`, `Badge`, `Separator` aus Phase B.

**Cons**
- Worker-Detail nur über Hover/Click (Drawer nötig für vollen Worker-State).
- Roster-Section kann auf grossen Screens leer/verlassen wirken wenn viele Workers active sind.
- Tabs (Board/Logs/Runtime) bleiben oben als sekundäre Navigation — nicht eliminiert.

**Implementation-Cost:** **Small**

---

### Option B — Single-Column Conversation-First

**One-liner:** ChatGPT/Linear-style: Mission zentriert, Activity-Stream als zeitliche Chronik, Workers im Bottom-Tray.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SWARM                                                       4 / 13      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│         ╭───────────────────────────────────────────────────╮           │
│         │  Was soll der Swarm tun?                          │           │
│         │                                                   │           │
│         │  [Auto ▾]                                [Route]  │           │
│         ╰───────────────────────────────────────────────────╯           │
│                                                                         │
│   ──────────────────────────────────────────────────────────────        │
│                                                                         │
│   14:02   You         → "Refactor router auth flow"                     │
│   14:02   Orchestr.   → routed to W1 + W5 (auto, parallel)              │
│   14:03   W1          ◐ analyzing files… 12 candidates                  │
│   14:04   W5          ● drafting test plan                              │
│   14:05   W1          ✓ patch ready (3 files) → [Review]                │
│                                                                         │
│   ──────────────────────────────────────────────────────────────        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ ● W1  ● W2  ◐ W3  ○ W4  ○ W5  ○ W6  ○ W7 …    [+ open roster sheet]    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pros**
- Maximal ruhig — eine zentrale Spalte, ein primärer Lesepfad, sehr Pitch-Deck-fähig.
- Activity-Stream ist Audit-Trail + Status in einem — eliminiert Reports-View für 80% der Fälle.
- Workers im Bottom-Tray sind ambient präsent, blockieren aber keinen Platz.
- Mental-Model "Chat mit Swarm" ist für Nicht-Techniker sofort verständlich.

**Cons**
- Worker-Details brauchen alle einen Sheet/Drawer — mehr Click-to-Reveal.
- Stream-Sortierung verliert spatial memory ("wo war Worker 7?").
- Kanban-Mental-Model (Backlog → Running → Done) verschwindet als Default-View.
- Verlangt neuen Activity-Stream-Component (`swarm2-activity-feed.tsx` existiert — muss aber zentral werden).

**Implementation-Cost:** **Medium**

---

### Option C — Two-Pane: Worker-List Links, Mission Rechts

**One-liner:** Slack-ähnlich. Schmale Worker-Liste links, Mission + Output rechts. Click auf Worker öffnet Detail-Sheet.

```
┌────────────────────┬────────────────────────────────────────────────────┐
│ WORKERS  4/13      │  MISSION                                           │
├────────────────────┤  ┌──────────────────────────────────────────────┐  │
│ ● W1   Build       │  │  Was soll der Swarm tun?                     │  │
│ ● W2   PR          │  │                                              │  │
│ ◐ W3   Review      │  │                                              │  │
│ ○ W4   Idle        │  └──────────────────────────────────────────────┘  │
├────────────────────┤                                                    │
│ Roster             │  Routing:  [● Auto]  [ One ]  [ Broadcast ]        │
│ ○ W5   —           │                                              [Route]│
│ ○ W6   —           │                                                    │
│ ○ W7   —           │  ──────────────────────────────────────────────    │
│ ○ W8   —           │                                                    │
│ ○ W9   —           │  Last run                                          │
│ ○ W10  —           │  14:02  Routed to W1 + W5                          │
│ ○ W11  —           │  14:05  W1 ✓ patch ready                           │
│ ○ W12  —           │  14:07  W5 ✓ test plan                             │
│ ○ W13  —           │                                                    │
├────────────────────┤  ──────────────────────────────────────────────    │
│ Filter             │                                                    │
│ [All|Run|Block]    │  Tabs:  Output · Board · Runtime                   │
└────────────────────┴────────────────────────────────────────────────────┘
```

**Pros**
- Worker-Liste links ist permanent sichtbar — kein Tab-Switch um Status zu sehen.
- Skaliert auf 50+ Workers (vertikal scrollbar) ohne Layout-Bruch.
- Mission-Bereich rechts bleibt fokussiert, klar primär.
- Familiarity: jeder kennt Slack/Discord/Linear-Sidebar-Pattern.

**Cons**
- Verlangt neuen Page-Level-Layout (zwei-Pane statt single-flow) — Tabs/Sub-Routes müssen sich an die rechte Pane anpassen.
- Linke Pane konkurriert mit der globalen Lokyy-Sidebar — zwei vertikale Bars nebeneinander wirken eng.
- Worker-Card-Details brauchen Sheet/Drawer (rechts-überlagernd) — UX-Komplexität steigt.
- Auf Laptop-Width (<1280px) wird die linke Pane sehr schmal oder die rechte zu eng.

**Implementation-Cost:** **Large**

---

## Part 3 — Sally's Empfehlung

**Ich empfehle Option A — Hero Mission + Compact Roster.**

Lokyys Mood-Statement verlangt "ruhiges Cockpit", "korrekt nicht cool", "Pitch-Deck-fähig". Option A liefert genau das mit der geringsten Migrations-Risk: die Mission-Aktion ist eindeutig primär (vollbreiter Hero-Block), Active-Workers sind klar von Roster getrennt (zwei Section-Headings statt zwei volle Spalten), und Filter werden zu einem ruhigen Segmented-Control statt eigener Toolbar-Reihe. Wir behalten den bestehenden Tab-Layer (Control/Board/Logs) — das ist funktional korrekt und muss nicht neu erfunden werden.

Option B (Conversation-First) ist visuell am ruhigsten, opfert aber das Kanban-Mental-Model, das für die Backend-Logik (Routing-Lanes) wichtig ist. Option C (Two-Pane) skaliert am besten, kollidiert aber mit der globalen Lokyy-Sidebar und verlangt einen Page-Level-Layout-Rewrite, den wir in Etappe 2 nicht brauchen. **A ist der pragmatische Pfad: höchster visueller Lift, kleinste Implementation-Surface, vollständig mit Phase-B-Komponenten (`Card`, `Badge`, `Separator`, `Sheet`, `Skeleton`, `Tabs`) realisierbar.**

---

## Olivers Entscheidung

- [ ] Option A — Hero Mission + Compact Roster
- [ ] Option B — Single-Column Conversation-First
- [ ] Option C — Two-Pane Worker-List + Mission
- [ ] Andere: [eigener Vorschlag — Oliver formuliert]

Sobald Oliver hier markiert: Implementation-Issue für Etappe 2 öffnen, Sally + Amelia delegieren.
