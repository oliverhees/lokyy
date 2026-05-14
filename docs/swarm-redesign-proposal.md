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

## Olivers Entscheidung (2026-05-14)

- [ ] Option A — Hero Mission + Compact Roster
- [ ] Option B — Single-Column Conversation-First
- [x] **Option C — Two-Pane Worker-List + Mission** ✅
- [ ] Andere

### Plus Olivers Worker-Vereinfachungs-Insight

> "Wenn ich das richtig sehe sind die Worker nix anderes als vorkonfigurierte Agents. Da reicht ja dann auch der name ein bild und was er macht etc. und beim drauf klicken geht der rest einfach auf etc."

**Spec-Ergänzung für Option-C-Implementation in Etappe 2:**

Die linke Worker-Pane wird **minimalistisch**. Pro Worker-Row:

```
┌──────────────────────────────────┐
│ ●  [📷]   Apollo                 │   ← Status-Dot, Avatar/Icon, Name
│           Research · GPT-5       │   ← Function · Model
└──────────────────────────────────┘
```

- **Status-Dot** (8px): grün=live, grau=idle, indigo=on-mission, rot=error
- **Avatar** (28px): rundes Bild ODER Initial-in-Circle (`bg-primary/15`) wenn kein Bild
- **Name** (`text-sm font-medium`)
- **Function · Model** (`text-xs text-muted-foreground`) auf zweiter Zeile

**Click-Behavior:** Click auf Worker-Row öffnet ein **Sheet (Drawer von rechts)** mit allen Details:

- Voll-Profil (Name, Avatar, Funktion, Model, Memory, Skills)
- Recent Activity (letzte Missions/Outputs)
- Edit-Config-Button (führt zu Profile-Settings)
- "Send Solo-Mission"-Button

So bleibt die linke Pane immer ruhig (eine Liste, ein Scroll), und die Detail-Komplexität versteckt sich hinter dem Sheet-Click — exakt das was Oliver gemeint hat: minimaler Roster oben-sichtbar, Details on-demand.

**Right-Pane** bleibt wie in Option C beschrieben: Mission-Editor + Routing + Active-Streams.

### Implications für die Cons-Liste oben

Olivers Vereinfachung neutralisiert zwei der Option-C-Cons:

- ~~Worker-Card-Details brauchen Sheet/Drawer — UX-Komplexität steigt~~ → **gewünscht und elegant**: die Komplexität WANDERT in den Sheet, statt die linke Pane vollzustopfen
- ~~Linke Pane konkurriert mit der globalen Lokyy-Sidebar~~ → wird durch die minimalistische Row-Struktur (Avatar + 2 Zeilen Text, ~64px hoch) so kompakt, dass die zwei vertikalen Bars als zwei Hierarchie-Ebenen lesbar werden (global nav vs. domain-list)

Verbleibender Real-Trade-off: **Laptop-Width <1280px** — bei sehr schmalen Viewports muss die linke Pane collapsen können (Icon-only mit Hover-Tooltip, ähnlich der existing LokyyShell-Sidebar).

---

## Status

✅ **Spec entschieden. Implementation = Etappe 2.**

Wenn Etappe 1 abgeschlossen ist (Issue #21), öffnet Lokyy ein Etappe-2-Issue:

- Worker-Profil-Schema definieren (Name / Avatar / Function / Model — Daten-Felder + woher kommen sie?)
- Page-Level-Two-Pane-Layout für `/swarm` (eigener Layout-Wrapper, NICHT die LokyyShell anfassen)
- Worker-Sheet-Detail-View implementieren (Phase-B `<Sheet>` aus `src/components/ui/sheet.tsx`)
- Collapse-Verhalten der linken Pane für Viewports <1280px
- Migration: alte Swarm-Tabs (Control/Board/Inbox/Runtime) ggf. konsolidieren

Sally + Amelia werden delegiert sobald Etappe 1 zu ist.
