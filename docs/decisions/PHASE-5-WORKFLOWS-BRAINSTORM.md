# Phase-5 Workflows — Architektur-Brainstorming

> **Status:** WIP — wird zu ADR-009 destilliert nachdem alle 7 Fragen beantwortet sind
> **Date:** 2026-05-18

## Goal

Visuelle Komposition von **Skills + Tools + Agents + Dashboards** zu einem persönlichen "AI-Workflow-OS". n8n/Zapier-Analogie, aber AI-native und self-hosted. **DAS** ist Lokyys USP-Punkt: nicht ein weiteres AI-Tool, sondern das Tool **das die anderen Tools verkabelt**.

## Was wir schon haben (Bausteine, die nicht neu gebaut werden)

| Baustein | Status | Rolle in Workflows |
|---|---|---|
| `lokyy-mcp` tool-registry | ✓ | Jedes Tool = potentieller Node |
| Capability-Tokens | ✓ | Pro-Workflow scoped permissions |
| Audit-log | ✓ | Workflow-Run-Audit "for free" |
| Cron-Scheduler | ✓ | Trigger-Source #1 |
| Hermes-LLM-Bridge | ✓ | LLM-Nodes (87 Skills, 40+ Tools) |
| Dashboards-Pipeline | ✓ | Output-Surface von Workflows |
| `run_now` + `save_data` | ✓ | Schreib-Patterns für Workflow-Outputs |

→ Wir bauen **Editor + Runtime + Schema**, nicht Foundation.

---

## Die 7 Architektur-Fragen

### Q1. Workflow-Schema: DAG / Sequence / State-Machine?

| Option | Pro | Con |
|---|---|---|
| **DAG** (gerichtet, branching) | Parallele Branches, Conditional (if-LLM-says-X), n8n-Style | Komplexer im Editor |
| Sequence (linear) | Einfacher | Kann keine Verzweigungen, langweilig |
| State-Machine | Mächtigst | Komplex, lädt zu over-engineering ein |

**Empfehlung: DAG**. AI-Workflows haben echt branching ("wenn-Mail-actionable → Antwort, sonst → archivieren"). React Flow rendert DAGs nativ. Kein Grund hier Komplexität abzuwerfen.

### Q2. Runtime-Lokation: Eigener Service oder in `lokyy-mcp`?

| Option | Pro | Con |
|---|---|---|
| **In `lokyy-mcp`** | Re-use Tool-Registry, Capability-Tokens, Audit. Ein Trust-Modell. | lokyy-mcp wächst, mehr Verantwortung |
| Eigener `lokyy-engine` Service | Clean separation | Duplikation Auth/Audit/Tool-Routing |

**Empfehlung: in `lokyy-mcp`**. Workflows komponieren System-Skills — also gehören sie in den System-Bus. Konsistent mit ADR-008.

### Q3. Visual-Editor: Library?

| Option | Pro | Con |
|---|---|---|
| **xyflow / React Flow** | De-facto Standard, MIT, n8n/Langflow nutzen es | Bundle-Size +200kb |
| Custom | Volle Kontrolle | 4-6 Wochen Edge-Cases |
| Drawflow / Rete.js | Existieren | Weniger Beispiele, kleinere Community |

**Empfehlung: xyflow**. Reife Library, alle gängigen Features (zoom, pan, minimap, custom nodes), wird von Langflow & co. benutzt.

### Q4. Trigger-Sources — welche im ersten Schritt?

**Liste der möglichen Trigger:**
1. **Cron** (schon da) — täglich/stündlich/etc.
2. **Manual "Jetzt laufen"** — Button am Workflow
3. **Webhook** (extern callable URL) — andere Services pushen Lokyy
4. **Dashboard-Widget-Klick** — User klickt Card → Workflow läuft
5. **Chat-Intent** — User chattet, Hermes matched intent → Workflow läuft
6. **Event-Bus** — interner Events: "neuer Dashboard-Run done" triggert Folge-Workflow
7. **File-Watch** — neue Mail / neue Datei im Vault → Workflow

**Empfehlung Phase-5.0**: 1+2 (Cron + Manual) und 3+4 (Webhook + Dashboard-Click) — alles andere kommt incrementell.

→ Brauche deine Entscheidung welche du tatsächlich nutzen willst.

### Q5. Workflow ↔ Dashboard — bidirektional?

| Richtung | Was es bedeutet |
|---|---|
| Workflow → Dashboard | Workflow schreibt Daten in dein Dashboard (haben wir: `save_data`) |
| Dashboard → Workflow | Klick auf Card / Button im Dashboard triggert einen Workflow |

**Beide Richtungen** = Lokyy wird wirklich ein OS, nicht nur ein Dashboard-Tool. Beispiel: KI-News-Card mit "📰 Lange-Form analysieren" Button → triggert Workflow "fetch full article → Claude summary → write to Brain → notify".

**Empfehlung: BEIDE**, von Anfang an. Aber UI-Design dafür ist nicht trivial — Dashboard-Templates müssten Action-Slots haben.

→ Brauche deine Entscheidung wie tief das gehen soll.

### Q6. Wo leben Workflows physikalisch?

**Empfehlung: gleiches Muster wie Dashboards.**
```
/app/data/workflows/{id}/
  spec.json          ← Schema-Definition (nodes + edges + triggers)
  runs/YYYY-MM-DD-T.json  ← Run-History (input + output per node)
```
Phase-3 Swap-Target: lokyy-brain.

### Q7. Error / Retry / Audit

**Empfehlung:**
- **Audit**: jeder Node-Call landet im audit-log via capability-token-pattern (schon da)
- **Retry**: configurable per Node, default 0 (fail-fast)
- **Failure-Policy**: per Node — `halt | skip | continue`
- **Run-Record**: input/output jeder Node pro Run gespeichert (in `runs/{run-id}.json`)
- **Error-Surface**: in der UI ein "letzter Fehler"-Status pro Workflow, klickbar zu Detail-View

---

## Vorschlag für Phase-5 Sub-Slice-Plan

```
5.0  Schema + Runtime + Backend-API     ← in lokyy-mcp; pure backend, no UI
5.1  Workflow-Library (List, CRUD)      ← lokyy-os-be REST + lokyy-app /workflows route
5.2  Visual Editor                      ← xyflow integration, custom node types
5.3  Triggers: Manual + Cron            ← reuse Phase-4.5 cron infra
5.4  Triggers: Webhook + Dashboard-Click
5.5  Workflow → Dashboard Action-Slots  ← UI-design + binding (volle Bidi)
5.6  Workflow-Library (Template-Gallerie) ← KI-News-Pipeline als erstes Beispiel
```

Estimated: 3-5 Tage je Sub-Slice. Phase-5 als ganzes: 2-3 Wochen wenn fokussiert.

---

## Entscheidungen (2026-05-18 — Brainstorming-Session)

| Q | Antwort | Begründung |
|---|---|---|
| **Q1** Schema | **DAG** | Branching ist real für AI-Workflows. xyflow rendert nativ. |
| **Q2** Runtime | **In `lokyy-mcp`** | Tool-Registry, Capabilities, Audit alle schon da. Konsistent mit ADR-008. |
| **Q3** Editor | **xyflow / React Flow** | De-facto Standard, reife Library, in Langflow & co. bewährt. |
| **Q4** Trigger-Sources v1 | **Cron + Manual + Dashboard-Click + Webhook** (alle vier) | Oliver will full coverage von Anfang an. Chat-Intent + Event-Bus + File-Watch kommen Phase-5.x. |
| **Q5** Dashboard↔Workflow | **Volle Bidirektionalität mit Action-Slots im Template** | Macht Lokyy zum echten OS. Cards bekommen Action-Slots, jeder Slot triggert Workflow mit Card-Kontext als Input. UI-Design-Heavy aber genau das was differenziert. |
| **Q6** Workflow-Storage | **`/app/data/workflows/{id}/` Pattern wie Dashboards** | Konsistent, Phase-3-brain-Swap-target gleich vorbereitet. |
| **Q7** Error-Handling | **Audit + per-Node Retry + Failure-Policy + Run-Record** | Pragmatic, granular wo nötig, default fail-fast. |

**Timing-Decision**: Brainstorming heute fertig, ADR-009 + Issue heute, Phase-5.0 morgen.

→ Dieses Dokument wird zu **ADR-009** verdichtet (entscheidungs-zentriert, ohne Diskussion der verworfenen Optionen).
→ Phase-5-Master-Issue mit ISCs landet danach.
